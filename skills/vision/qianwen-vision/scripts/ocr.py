#!/usr/bin/env python3
"""OCR text extraction with qwen3.5-ocr (default) / qwen-vl-ocr.

Optimized for dense text: scanned documents, receipts, tickets, tables, formulas.
Supports pixel-level control (min_pixels/max_pixels) for resolution vs cost trade-off.

Usage:
  python scripts/ocr.py --request '{"image":"invoice.jpg"}'
  python scripts/ocr.py --request '{"prompt":"Extract the total amount","image":"receipt.png"}'
  python scripts/ocr.py --request '{"image":"doc.jpg","min_pixels":3072,"max_pixels":8388608}'
  python scripts/ocr.py --file request.json --output result.json
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
    resolve_file,
    save_result,
    try_parse_json,
    validate_token_plan_model,
)

DEFAULT_MODEL = "qwen3.5-ocr"
DEFAULT_PROMPT = "Please output only the text content from the image without any additional descriptions or formatting."
DEFAULT_MAX_TOKENS = 4096


def ocr(req: dict[str, Any], api_key: str, *, upload_files: bool = False) -> dict[str, Any]:
    image = req.get("image")
    if not image:
        raise ValueError("image is required")

    model = req.get("model", DEFAULT_MODEL)
    prompt = req.get("prompt", DEFAULT_PROMPT)
    json_mode = bool(req.get("json_mode", False))

    if json_mode:
        prompt = f"{prompt}\n\nReturn ONLY valid JSON."

    upload_key = api_key if upload_files else None
    upload_model = model if upload_files else None
    img_obj: dict[str, Any] = {"url": resolve_file(str(image), api_key=upload_key, model=upload_model)}
    if req.get("min_pixels"):
        img_obj["min_pixels"] = int(req["min_pixels"])
    if req.get("max_pixels"):
        img_obj["max_pixels"] = int(req["max_pixels"])

    payload: dict[str, Any] = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": img_obj},
                {"type": "text", "text": prompt},
            ],
        }],
        "max_tokens": req.get("max_tokens", DEFAULT_MAX_TOKENS),
        "stream": False,
    }

    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    data = http_post(
        chat_url(), api_key, payload,
        timeout=int(req.get("timeout_s", 120)),
        retries=int(req.get("max_retries", 2)),
    )

    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("No choices returned by DashScope")

    text = extract_text(choices[0].get("message", {}).get("content"))
    parsed = try_parse_json(text) if json_mode else None

    result: dict[str, Any] = {
        "text": text,
        "model": data.get("model", model),
        "usage": data.get("usage", {}),
    }
    if parsed is not None:
        result["json"] = parsed
    return result


def main() -> None:
    prompt_update_check_install()
    parser = argparse.ArgumentParser(
        description="OCR text extraction with qwen3.5-ocr",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
request JSON fields (--request / --file):
  image             (required) Image URL or local path
  prompt            Extraction instruction (default: extract all text)
  model             Model ID (default: qwen3.5-ocr; also supports qwen-vl-ocr)
  json_mode         true — output as structured JSON (also via --json-mode)
  min_pixels        Minimum image pixels (increase for fine text)
  max_pixels        Maximum image pixels (decrease to reduce cost)
  max_tokens        Max output tokens (default: 4096)
  timeout_s         Request timeout in seconds (default: 120)

pixel control:
  For dense/small text (invoices, contracts), increase min_pixels:
    "min_pixels": 3072, "max_pixels": 8388608
  For simple documents, lower max_pixels to save tokens.

environment variables:
  DASHSCOPE_API_KEY   (required) API key — also loaded from .env
  QIANWEN_API_KEY        (alternative) Alias for DASHSCOPE_API_KEY
  QWEN_REGION         cn-beijing (default)

examples:
  # Extract all text from image
  python scripts/ocr.py --request '{"image":"document.jpg"}' --print-response

  # Extract specific field
  python scripts/ocr.py --request '{"prompt":"Extract the total amount","image":"receipt.png"}'

  # High-res for dense text
  python scripts/ocr.py --request '{"image":"contract.jpg",
    "min_pixels":3072,"max_pixels":8388608}' --output result.json

  # JSON-structured output
  python scripts/ocr.py --request '{"image":"invoice.jpg"}' --json-mode --print-response
""",
    )
    parser.add_argument("--request", help="Inline JSON: must contain 'image'")
    parser.add_argument("--file", help="Path to JSON request file")
    parser.add_argument("--model", type=str, default=None,
                        help="Model ID (default: %s)" % DEFAULT_MODEL)
    parser.add_argument("--json-mode", action="store_true", help="Request JSON-only output")
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

    if args.json_mode:
        req["json_mode"] = True

    try:
        result = ocr(req, api_key, upload_files=args.upload_files)
    except (ValueError, RuntimeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if args.output:
        save_result(result, args.output)
    if args.print_response:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
