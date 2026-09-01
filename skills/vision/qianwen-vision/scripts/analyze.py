#!/usr/bin/env python3
"""Visual analysis: image understanding, multi-image comparison, video understanding.

Supports single image, multiple images, video file, and video frame list input
via OpenAI-compatible API. Also supports JSON mode, JSON Schema structured
extraction, thinking mode (with streaming), fps control, and high-resolution mode.

Usage:
  python scripts/analyze.py --request '{"prompt":"Describe this image","image":"photo.jpg"}'
  python scripts/analyze.py --request '{"prompt":"Compare","images":["a.jpg","b.jpg"]}'
  python scripts/analyze.py --request '{"prompt":"What happens?","video":"https://...mp4","fps":2}'
  python scripts/analyze.py --request '{"prompt":"Describe","video_frames":["f1.jpg","f2.jpg","f3.jpg","f4.jpg"],"fps":2}'
  python scripts/analyze.py --request '{"prompt":"Analyze","image":"chart.png","enable_thinking":true}' --stream
  python scripts/analyze.py --request '{"prompt":"Fine text","image":"doc.jpg","vl_high_resolution_images":true}'
  python scripts/analyze.py --file request.json --schema schema.json --output result.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from vision_lib import (  # noqa: E402
    chat_url,
    extract_text,
    http_post,
    load_request,
    prompt_update_check_install,
    require_api_key,
    save_result,
    stream_sse,
    try_parse_json,
    build_content,
    validate_token_plan_model,
)

DEFAULT_MODEL = "qwen3.7-plus"
DEFAULT_MAX_TOKENS = 512
DEFAULT_TEMPERATURE = 0.2
DEFAULT_DETAIL = "auto"

def _analyze_sync(
    payload: dict[str, Any],
    api_key: str,
    req: dict[str, Any],
    model: str,
    json_mode: bool,
    schema_obj: dict | None,
) -> dict[str, Any]:
    data = http_post(
        chat_url(), api_key, payload,
        timeout=int(req.get("timeout_s", 120)),
        retries=int(req.get("max_retries", 2)),
    )
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("No choices returned by DashScope")

    message = choices[0].get("message", {})
    text = extract_text(message.get("content"))
    parsed = try_parse_json(text) if (json_mode or schema_obj) else None

    result: dict[str, Any] = {
        "text": text,
        "model": data.get("model", model),
        "usage": data.get("usage", {}),
    }
    if message.get("reasoning_content"):
        result["reasoning"] = message["reasoning_content"]
    if parsed is not None:
        result["json"] = parsed
    return result

def _analyze_stream(
    payload: dict[str, Any],
    api_key: str,
    req: dict[str, Any],
    model: str,
    json_mode: bool,
    schema_obj: dict | None,
) -> dict[str, Any]:
    payload["stream_options"] = {"include_usage": True}

    reasoning_content = ""
    answer_content = ""
    usage: dict[str, Any] = {}
    model_name = model
    is_answering = False

    for chunk in stream_sse(
        chat_url(), api_key, payload,
        timeout=int(req.get("timeout_s", 300)),
    ):
        if chunk.get("usage"):
            usage = chunk["usage"]
        if chunk.get("model"):
            model_name = chunk["model"]

        choices = chunk.get("choices") or []
        if not choices:
            continue
        delta = choices[0].get("delta") or {}

        rc = delta.get("reasoning_content") or ""
        if rc:
            reasoning_content += rc
            if not is_answering:
                print(rc, end="", flush=True, file=sys.stderr)

        ct = delta.get("content") or ""
        if ct:
            if not is_answering:
                is_answering = True
                if reasoning_content:
                    print("\n", file=sys.stderr)
            answer_content += ct
            print(ct, end="", flush=True, file=sys.stderr)

    if reasoning_content or answer_content:
        print("", file=sys.stderr)

    parsed = try_parse_json(answer_content) if (json_mode or schema_obj) else None

    result: dict[str, Any] = {
        "text": answer_content,
        "model": model_name,
        "usage": usage,
    }
    if reasoning_content:
        result["reasoning"] = reasoning_content
    if parsed is not None:
        result["json"] = parsed
    return result

def analyze(
    req: dict[str, Any],
    api_key: str,
    *,
    force_stream: bool = False,
    upload_files: bool = False,
) -> dict[str, Any]:
    prompt = req.get("prompt")
    if not prompt:
        raise ValueError("prompt is required")

    model = req.get("model", DEFAULT_MODEL)
    detail = req.get("detail", DEFAULT_DETAIL)
    json_mode = bool(req.get("json_mode", False))
    schema_obj = req.get("schema")

    if schema_obj is not None and not isinstance(schema_obj, dict):
        raise ValueError("schema must be a JSON object")

    if schema_obj:
        prompt = f"{prompt}\n\nReturn ONLY JSON that matches the provided schema. Do not include markdown or extra commentary."
    elif json_mode:
        prompt = f"{prompt}\n\nReturn ONLY valid JSON."

    upload_key = api_key if upload_files else None
    upload_model = model if upload_files else None
    content = build_content(req, detail, upload_key=upload_key, upload_model=upload_model)
    content.append({"type": "text", "text": prompt})

    enable_thinking = req.get("enable_thinking")
    thinking_budget = req.get("thinking_budget")
    use_stream = force_stream or bool(req.get("stream", False)) or enable_thinking is True

    payload: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": req.get("max_tokens", DEFAULT_MAX_TOKENS),
        "temperature": req.get("temperature", DEFAULT_TEMPERATURE),
        "stream": use_stream,
    }

    if enable_thinking is not None:
        payload["enable_thinking"] = bool(enable_thinking)
    if thinking_budget is not None:
        payload["thinking_budget"] = int(thinking_budget)
    if req.get("vl_high_resolution_images") is not None:
        payload["vl_high_resolution_images"] = bool(req["vl_high_resolution_images"])

    if schema_obj:
        payload["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": "vision_result", "schema": schema_obj},
        }
    elif json_mode:
        payload["response_format"] = {"type": "json_object"}

    if use_stream:
        return _analyze_stream(payload, api_key, req, model, json_mode, schema_obj)
    return _analyze_sync(payload, api_key, req, model, json_mode, schema_obj)

def main() -> None:
    prompt_update_check_install()
    parser = argparse.ArgumentParser(
        description="Analyze images/videos with Qwen VL models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
request JSON fields (--request / --file):
  prompt              (required) Analysis instruction or question
  image               Single image URL or local path
  images              Array of image URLs/paths for multi-image comparison
  video               Video URL or local path
  video_frames        Array of frame image URLs/paths (alternative to video)
  fps                 Frame sampling rate for video (default: auto)
  model               Model ID (default: qwen3.7-plus)
  detail              Image detail level: "auto" | "low" | "high"
  json_mode           true — request JSON-only output (also via --json-mode)
  schema              JSON Schema object for structured extraction
  enable_thinking     true — enable chain-of-thought reasoning (forces streaming)
  thinking_budget     Max thinking tokens
  vl_high_resolution_images  true — enable high-res mode for fine details
  max_tokens          Max output tokens (default: 512)
  temperature         Sampling temperature (default: 0.2)

input types (provide exactly one):
  image         Single image analysis
  images        Multi-image comparison (2+ images)
  video         Video understanding (URL or local file)
  video_frames  Video from extracted frames (array of image paths)

environment variables:
  DASHSCOPE_API_KEY   (required) API key — also loaded from .env
  QIANWEN_API_KEY        (alternative) Alias for DASHSCOPE_API_KEY
  QWEN_REGION         cn-beijing (default)

examples:
  # Describe an image
  python scripts/analyze.py --request '{"prompt":"Describe this","image":"photo.jpg"}'

  # Compare two images
  python scripts/analyze.py --request '{"prompt":"Differences?","images":["a.jpg","b.jpg"]}'

  # Video understanding
  python scripts/analyze.py --request '{"prompt":"What happens?","video":"clip.mp4","fps":2}'

  # Structured JSON extraction with schema
  python scripts/analyze.py --request '{"prompt":"Extract items","image":"receipt.jpg"}' \\
    --schema schema.json --output result.json

  # High-res mode for fine text/details
  python scripts/analyze.py --request '{"prompt":"Read all text",
    "image":"document.jpg","vl_high_resolution_images":true}' --print-response
""",
    )
    parser.add_argument("--request", help="Inline JSON: must contain 'prompt' + image/video input")
    parser.add_argument("--file", help="Path to JSON request file")
    parser.add_argument("--model", type=str, default=None,
                        help="Model ID (default: %s)" % DEFAULT_MODEL)
    parser.add_argument("--json-mode", action="store_true", help="Request JSON-only output")
    parser.add_argument("--schema", default="", help="JSON Schema file path or inline JSON string")
    parser.add_argument("--stream", action="store_true",
                        help="Enable streaming (auto-enabled with enable_thinking)")
    parser.add_argument("--upload-files", action="store_true",
                        help="Upload local files to temp storage (oss://) instead of base64 encoding")
    parser.add_argument("--output", default="", help="Save result JSON to this path")
    parser.add_argument("--print-response", action="store_true", help="Print result JSON to stdout")
    args = parser.parse_args()

    api_key = require_api_key()

    try:
        req = load_request(args)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if args.model:
        req["model"] = args.model
    elif "model" not in req or not req.get("model"):
        req["model"] = DEFAULT_MODEL

    validate_token_plan_model(api_key, req["model"])

    if args.json_mode:
        req["json_mode"] = True
    if args.schema:
        val = args.schema
        req["schema"] = json.loads(val) if val.startswith("{") else json.loads(Path(val).read_text(encoding="utf-8"))

    try:
        result = analyze(req, api_key, force_stream=args.stream,
                         upload_files=args.upload_files)
    except (ValueError, RuntimeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if args.output:
        save_result(result, args.output)
    if args.print_response:
        print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()