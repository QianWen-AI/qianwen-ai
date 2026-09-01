#!/usr/bin/env python3
"""Visual reasoning with QVQ and thinking-enabled VL models.

Chain-of-thought visual reasoning: the model thinks step-by-step before answering.
Best for math problems in images, complex chart analysis, video understanding,
and multi-step visual logic. Always uses streaming (required for QVQ models).

Usage:
  python scripts/reason.py --request '{"prompt":"Solve this problem","image":"math.png"}'
  python scripts/reason.py --request '{"prompt":"Analyze trends","image":"chart.jpg","model":"qwen3-vl-plus"}'
  python scripts/reason.py --request '{"prompt":"What happens?","video":"clip.mp4","fps":2}'
  python scripts/reason.py --request '{"prompt":"Describe","video_frames":["f1.jpg","f2.jpg"],"fps":2}'
  python scripts/reason.py --file request.json --output result.json
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
    load_request,
    prompt_update_check_install,
    require_api_key,
    save_result,
    stream_sse,
    build_content,
    validate_token_plan_model,
)

DEFAULT_MODEL = "qvq-max"
DEFAULT_MAX_TOKENS = 8192

def reason(req: dict[str, Any], api_key: str, *, upload_files: bool = False) -> dict[str, Any]:
    prompt = req.get("prompt")
    if not prompt:
        raise ValueError("prompt is required")

    model = req.get("model", DEFAULT_MODEL)
    upload_key = api_key if upload_files else None
    upload_model = model if upload_files else None

    content = build_content(req, upload_key=upload_key, upload_model=upload_model)
    content.append({"type": "text", "text": prompt})

    payload: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": req.get("max_tokens", DEFAULT_MAX_TOKENS),
        "stream": True,
        "stream_options": {"include_usage": True},
    }

    enable_thinking = req.get("enable_thinking")
    if enable_thinking is not None:
        payload["enable_thinking"] = bool(enable_thinking)
    thinking_budget = req.get("thinking_budget")
    if thinking_budget is not None:
        payload["thinking_budget"] = int(thinking_budget)

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

    result: dict[str, Any] = {
        "text": answer_content,
        "model": model_name,
        "usage": usage,
    }
    if reasoning_content:
        result["reasoning"] = reasoning_content
    return result

def main() -> None:
    prompt_update_check_install()
    parser = argparse.ArgumentParser(
        description="Visual reasoning with QVQ/thinking VL models (always streaming)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
request JSON fields (--request / --file):
  prompt            (required) Reasoning question or instruction
  image             Single image URL or local path
  video             Video URL or local path
  video_frames      Array of frame image URLs/paths (alternative to video)
  fps               Frame sampling rate for video (default: auto)
  model             Model ID (default: qvq-max)
  enable_thinking   true/false — override thinking mode (QVQ always thinks)
  thinking_budget   Max thinking tokens
  max_tokens        Max output tokens (default: 8192)
  timeout_s         Request timeout in seconds (default: 300)

input types (provide exactly one):
  image         Single image reasoning
  video         Video reasoning (URL or local file)
  video_frames  Video from extracted frames (array of image paths)

models:
  qvq-max           (default) Visual reasoning specialist (always-on thinking)
  qwen3-vl-plus     General vision with optional thinking mode
  qwen3.5-plus      Unified multimodal with thinking on by default

output:
  Result JSON contains: text (answer), reasoning (chain-of-thought), usage

environment variables:
  DASHSCOPE_API_KEY   (required) API key — also loaded from .env
  QIANWEN_API_KEY        (alternative) Alias for DASHSCOPE_API_KEY
  QWEN_REGION         cn-beijing (default)

examples:
  # Solve a math problem from image
  python scripts/reason.py --request '{"prompt":"Solve this","image":"math.png"}'

  # Chart analysis with thinking
  python scripts/reason.py --request '{"prompt":"Analyze trends","image":"chart.jpg",
    "model":"qwen3-vl-plus","enable_thinking":true}' --output result.json

  # Video reasoning
  python scripts/reason.py --request '{"prompt":"What happens and why?",
    "video":"clip.mp4","fps":2}' --print-response
""",
    )
    parser.add_argument("--request", help="Inline JSON: must contain 'prompt' + image/video input")
    parser.add_argument("--file", help="Path to JSON request file")
    parser.add_argument("--model", type=str, default=None,
                        help="Model ID (default: %s)" % DEFAULT_MODEL)
    parser.add_argument("--upload-files", action="store_true",
                        help="Upload local files to temp storage (oss://) instead of base64")
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

    try:
        result = reason(req, api_key, upload_files=args.upload_files)
    except (ValueError, RuntimeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if args.output:
        save_result(result, args.output)
    if args.print_response:
        print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()