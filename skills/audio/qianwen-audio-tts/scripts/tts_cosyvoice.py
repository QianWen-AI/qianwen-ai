#!/usr/bin/env python3
"""Synthesize speech from text via CosyVoice models (WebSocket or HTTP NRT API).

CosyVoice models require the DashScope SDK.
Run with --help for usage.

Dependencies:
    pip install dashscope>=1.25.17

Or with venv:
    python3 -m venv .venv && source .venv/bin/activate && pip install dashscope>=1.25.17
"""
from __future__ import annotations

import sys

if sys.version_info < (3, 9):
    print(f"Error: Python 3.9+ required (found {sys.version}).", file=sys.stderr)
    sys.exit(1)

# Check dashscope dependency before other imports
try:
    import dashscope
    from dashscope.audio.tts_v2 import SpeechSynthesizer
except ImportError:
    print(
        "Error: dashscope SDK not installed.\n\n"
        "Install with:\n"
        "  pip install dashscope>=1.25.17\n\n"
        "Or use venv:\n"
        "  python3 -m venv .venv\n"
        "  source .venv/bin/activate  # Windows: .venv\\Scripts\\activate\n"
        "  pip install dashscope>=1.25.17",
        file=sys.stderr,
    )
    sys.exit(1)

import argparse
import json
import urllib.parse
from pathlib import Path
from typing import Any

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qianwen_lib import (  # noqa: E402
    build_source_config,
    download_file,
    is_token_plan_key,
    native_base_url,
    require_api_key,
    run_update_signal,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SKILL_USER_AGENT = "qianwenai-skill"
DEFAULT_MODEL = "cosyvoice-v3-flash"
DEFAULT_VOICE = "longanyang"

# Native endpoint paths appended to the shared native base URL (see qianwen_lib).
# Endpoints are derived at runtime so a custom QWEN_BASE_URL routes both the
# HTTP NRT and WebSocket paths through the configured host. With no override,
# native_base_url() defaults to https://dashscope.aliyuncs.com/api/v1, keeping
# the resolved endpoints identical to the previous hardcoded constants.
_HTTP_NRT_PATH = "/services/audio/tts/SpeechSynthesizer"
_WEBSOCKET_PATH = "/api-ws/v1/inference"


def _http_nrt_url() -> str:
    """HTTP NRT endpoint derived from the shared native base URL."""
    return f"{native_base_url()}{_HTTP_NRT_PATH}"


def _websocket_url() -> str:
    """WebSocket endpoint derived from the shared native base URL host.

    The ws/wss scheme mirrors the base URL's http/https scheme.
    """
    parsed = urllib.parse.urlparse(native_base_url())
    scheme = "wss" if parsed.scheme == "https" else "ws"
    return f"{scheme}://{parsed.netloc}{_WEBSOCKET_PATH}"

VOICES = {
    "longanyang": "Sunny young man (male)",
    "longanhuan": "Energetic cheerful female",
    "longhuhu_v3": "Innocent lively girl",
}

# System voices (built-in) — only supported by v3 models
SYSTEM_VOICES = set(VOICES.keys())

# Models that require custom voice IDs (no system voice support)
CUSTOM_VOICE_ONLY_MODELS = {
    "cosyvoice-v3.5-flash",
    "cosyvoice-v3.5-plus",
}

# Models that support the HTTP NRT API
NRT_MODELS = {
    "cosyvoice-v3.5-flash",
    "cosyvoice-v3.5-plus",
    "cosyvoice-v3-flash",
    "cosyvoice-v3-plus",
}

# Models that support the instruction parameter
INSTRUCTION_MODELS = {
    "cosyvoice-v3.5-flash",
    "cosyvoice-v3.5-plus",
    "cosyvoice-v3-flash",
}


def _build_headers(
    api_key: str,
    source_config: str | None,
) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": SKILL_USER_AGENT,
    }
    if source_config:
        headers["X-DashScope-Source-Config"] = source_config
    return headers


def _build_payload(
    *,
    model: str,
    text: str,
    voice: str,
    audio_format: str,
    sample_rate: int,
    instruction: str | None,
    language_hints: list[str] | None,
) -> dict[str, Any]:
    input_data: dict[str, Any] = {
        "text": text,
        "voice": voice,
        "format": audio_format,
        "sample_rate": sample_rate,
    }
    if instruction:
        input_data["instruction"] = instruction
    if language_hints:
        input_data["language_hints"] = language_hints
    return {"model": model, "input": input_data}


def _http_error(response: requests.Response, api_key: str) -> RuntimeError:
    request_id = response.headers.get("x-request-id", "")
    code = ""
    message = ""
    try:
        payload = response.json()
    except ValueError:
        payload = None
    if isinstance(payload, dict):
        code = str(payload.get("code") or "")
        message = str(payload.get("message") or "")
    if api_key:
        message = message.replace(api_key, "<redacted>")

    details = [f"HTTP {response.status_code}"]
    if code:
        details.append(f"code={code}")
    if request_id:
        details.append(f"request_id={request_id}")
    if message:
        details.append(f"message={message}")
    return RuntimeError("HTTP NRT request failed: " + ", ".join(details))


def _synthesize_http_nrt(
    *,
    api_key: str,
    model: str,
    text: str,
    voice: str,
    audio_format: str,
    sample_rate: int,
    instruction: str | None = None,
    language_hints: list[str] | None = None,
    source_config: str | None = None,
    timeout: int = 120,
) -> dict[str, Any]:
    headers = _build_headers(api_key, source_config)
    payload = _build_payload(
        model=model,
        text=text,
        voice=voice,
        audio_format=audio_format,
        sample_rate=sample_rate,
        instruction=instruction,
        language_hints=language_hints,
    )
    try:
        response = requests.post(
            _http_nrt_url(),
            headers=headers,
            json=payload,
            timeout=timeout,
        )
    except requests.RequestException as exc:
        detail = str(exc).replace(api_key, "<redacted>")
        raise RuntimeError(f"HTTP NRT request failed: {detail}") from exc

    if response.status_code != 200:
        raise _http_error(response, api_key)
    try:
        result = response.json()
    except ValueError as exc:
        raise RuntimeError("HTTP NRT response was not valid JSON") from exc
    if not isinstance(result, dict):
        raise RuntimeError("HTTP NRT response must be a JSON object")
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    run_update_signal(caller=__file__)

    parser = argparse.ArgumentParser(
        description="CosyVoice via DashScope SDK",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""\
models:
  cosyvoice-v3-flash     (PAYG default) High quality, fast, supports system voices
  cosyvoice-v3-plus      Highest quality, supports system voices
  cosyvoice-v3.5-flash   High-performance, instruction control, 11 langs
                         ⚠️  Custom voices only (no system voice support)
  cosyvoice-v3.5-plus    Ultra-expressive, instruction control, 11 langs
                         ⚠️  Custom voices only (no system voice support)

system voices (cosyvoice-v3-flash / v3-plus only):
  longanyang           (default) Sunny young man
  longanhuan           Energetic cheerful female
  longhuhu_v3          Innocent lively girl

note:
  cosyvoice-v3.5 models do NOT support system voices. You must provide a
  custom voice ID created via Voice Cloning or Voice Design on the platform.

  For Qwen-Audio-TTS (qwen-audio-3.0-tts-plus/flash), use tts.py instead.

examples:
  # Basic synthesis (v3, default)
  python {Path(__file__).name} --text "Hello, world!"

  # Chinese with specific voice (v3)
  python {Path(__file__).name} --text "你好世界" --voice longanhuan

  # v3.5 with custom voice ID
  python {Path(__file__).name} --text "Hello" --model cosyvoice-v3.5-flash --voice <your-custom-voice-id>

  # With instruction control (v3.5 + custom voice)
  python {Path(__file__).name} --text "欢迎光临" --model cosyvoice-v3.5-flash --voice <id> --instruction "用热情洋溢的声音"

  # Save to specific file
  python {Path(__file__).name} --text "Hello" --output hello.mp3
""",
    )
    parser.add_argument("--text", "-t", required=True, help="Text to synthesize")
    parser.add_argument("--model", "-m", default=None,
                        help=f"Model (PAYG default: {DEFAULT_MODEL}; Token Plan not supported \u2014 use tts.py)")
    parser.add_argument("--voice", "-v", default=None,
                        help=f"Voice (PAYG default: {DEFAULT_VOICE}; key-specific default when omitted)")
    parser.add_argument("--output", "-o", type=Path, default=Path("output/qianwen-audio-tts/cosyvoice.mp3"), help="Output file (default: output/qianwen-audio-tts/cosyvoice.mp3)")
    parser.add_argument("--format", "-f", default="mp3", choices=["mp3", "wav", "pcm"], help="Audio format (default: mp3)")
    parser.add_argument("--sample-rate", type=int, default=24000,
                        help="Sample rate in Hz (default: 24000; options: 8000/16000/22050/24000/44100/48000)")
    parser.add_argument("--instruction", type=str, default=None, help="Free-style instruction for speech control (v3.5 and v3-flash models)")
    parser.add_argument("--language-hints", type=str, default=None, help="Target language hint (e.g. zh, en)")
    args = parser.parse_args()

    api_key = require_api_key(script_file=__file__, domain="CosyVoice TTS")
    token_plan = is_token_plan_key(api_key)
    if token_plan:
        print(
            "Error: Token Plan is not supported by tts_cosyvoice.py.\n"
            "Use tts.py with a Token Plan supported TTS model instead.\n"
            "Read more: https://platform.qianwenai.com/docs/token-plan/overview",
            file=sys.stderr,
        )
        sys.exit(1)

    # Model priority: CLI > PAYG default
    model = args.model or DEFAULT_MODEL
    voice = args.voice or DEFAULT_VOICE

    # Validate: v3.5 models do not support system voices
    if model in CUSTOM_VOICE_ONLY_MODELS and voice in SYSTEM_VOICES:
        print(
            f'ERROR: Model "{model}" does not support system voices.\n'
            "You must provide a custom voice ID created via Voice Cloning or Voice Design.\n"
            "Steps: Visit https://platform.qianwenai.com/docs/developer-guides/speech/voice-cloning → Upload 10-20s audio → Get voice ID\n"
            f"Then: python3 {Path(__file__).name} -t \"text\" -m {model} -v <your-custom-voice-id>",
            file=sys.stderr,
        )
        sys.exit(1)

    # Setup
    dashscope.api_key = api_key
    websocket_url = _websocket_url()
    dashscope.base_websocket_api_url = websocket_url

    # Validate instruction parameter
    if args.instruction and model not in INSTRUCTION_MODELS:
        print(f"Warning: --instruction is not supported by model '{model}'. "
              f"Supported models: {', '.join(sorted(INSTRUCTION_MODELS))}",
              file=sys.stderr)

    # Choose API path: HTTP NRT for supported models, WebSocket for others
    if model in NRT_MODELS:
        # Use the public HTTP NRT API so the Skill User-Agent is preserved.
        print(f"Synthesizing (HTTP NRT): model={model}, voice={voice}", file=sys.stderr)
        try:
            result = _synthesize_http_nrt(
                api_key=api_key,
                model=model,
                text=args.text,
                voice=voice,
                audio_format=args.format,
                sample_rate=args.sample_rate,
                instruction=(
                    args.instruction
                    if args.instruction and model in INSTRUCTION_MODELS
                    else None
                ),
                language_hints=(
                    [args.language_hints] if args.language_hints else None
                ),
                source_config=build_source_config(__file__),
            )
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

        audio_url = (
            ((result.get("output") or {}).get("audio") or {}).get("url")
            if isinstance(result, dict)
            else None
        )
        if not audio_url:
            request_id = result.get("request_id", "") if isinstance(result, dict) else ""
            suffix = f" (request_id={request_id})" if request_id else ""
            print(f"Error: No audio URL in response{suffix}.", file=sys.stderr)
            sys.exit(1)

        # Download audio from URL
        output = args.output
        if output.suffix.lower() not in {".mp3", ".wav", ".pcm"}:
            output = output.with_suffix(f".{args.format}")

        try:
            download_file(audio_url, output)
        except Exception as e:
            print(f"Warning: Could not download audio: {e}", file=sys.stderr)
            print(f"Audio URL (manual download): {audio_url}", file=sys.stderr)
            print(json.dumps({"audio_url": audio_url}))
            return

        print(f"Audio saved to {output}", file=sys.stderr)
        print(json.dumps({"audio_file": str(output), "audio_url": audio_url,
                          "size_bytes": output.stat().st_size}))
    else:
        # Use WebSocket API (SpeechSynthesizer) for legacy or unsupported models
        print(f"Synthesizing (WebSocket): model={model}, voice={voice}", file=sys.stderr)
        try:
            headers = {"User-Agent": "qianwenai-skill"}
            source_config = build_source_config(__file__)
            if source_config:
                headers["X-DashScope-Source-Config"] = source_config
            synth_kwargs: dict = {
                "model": model,
                "voice": voice,
                "headers": headers,
                "url": websocket_url,
            }
            synthesizer = SpeechSynthesizer(**synth_kwargs)
            audio_data = synthesizer.call(args.text)
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

        if not audio_data:
            response = synthesizer.get_response()
            header = response.get("header", {}) if isinstance(response, dict) else {}
            if header.get("event") == "task-failed":
                error_code = header.get("error_code", "UnknownError")
                error_message = header.get("error_message", "Unknown error")
                task_id = header.get("task_id", "")
                suffix = f" (task_id={task_id})" if task_id else ""
                print(
                    f"Error: WebSocket task failed: {error_code}: "
                    f"{error_message}{suffix}",
                    file=sys.stderr,
                )
            else:
                print("Error: No audio data returned.", file=sys.stderr)
            sys.exit(1)

        # Save
        output = args.output
        if output.suffix.lower() not in {".mp3", ".wav", ".pcm"}:
            output = output.with_suffix(f".{args.format}")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(audio_data)

        print(f"Audio saved to {output}", file=sys.stderr)
        print(json.dumps({"audio_file": str(output), "size_bytes": len(audio_data)}))


if __name__ == "__main__":
    main()
