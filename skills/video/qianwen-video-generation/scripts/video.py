#!/usr/bin/env python3
"""Video generation via Wan models on DashScope API.

Supports ALL video generation modes:
  t2v   -- text-to-video (prompt only)
  i2v   -- image-to-video based on first frame
  kf2v  -- image-to-video based on first + last frames
  r2v   -- reference-based video (character role-play)
  vace  -- video editing (multi-image ref, repainting, edit, extension, outpainting)

Submits async task, polls until completion, downloads video.
Self-contained, stdlib only.
"""
from __future__ import annotations

import sys

if sys.version_info < (3, 9):
    print(f"Error: Python 3.9+ required (found {sys.version}). "
          "Install: https://www.python.org/downloads/", file=sys.stderr)
    sys.exit(1)

import argparse
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qianwen_lib import (  # noqa: E402
    download_file,
    http_request,
    is_token_plan_key,
    load_request,
    native_base_url,
    poll_task,
    require_api_key,
    run_update_signal,
    validate_token_plan_model,
)
from video_lib import (  # noqa: E402
    DEFAULT_MODELS,
    ENDPOINTS,
    MODE_I2V,
    MODE_KF2V,
    MODE_VIDEO_EDIT,
    PAYLOAD_BUILDERS,
    RESOLVE_KEYS,
    _HAPPYHORSE_I2V_MODELS,
    _VIDEO_EDIT_MODELS,
    _WAN27_I2V_MODELS,
    detect_mode,
    resolve_request_urls,
    extract_video_url,
    estimate_cost,
    resolve_resolution,
    format_task_status,
)

_NOT_ACTIVATED_KEYWORDS = ("not activated", "not subscribed", "not enabled",
                           "product is not activated", "model not subscribed")
_MODEL_MARKET_URL = "https://www.qianwenai.com/models"
_TOKEN_PLAN_CONSOLE_URL = (
    "https://platform.qianwenai.com/home/billing/subscription/token-plan"
)
_VIDEO_EXTENSIONS = frozenset({
    ".mp4", ".mov", ".webm", ".mkv", ".m4v", ".avi", ".flv", ".wmv", ".ts",
})


def _check_not_activated(error_msg: str, model: str) -> bool:
    """Check if error indicates model not activated; print guidance if so."""
    msg_lower = error_msg.lower()
    if any(kw in msg_lower for kw in _NOT_ACTIVATED_KEYWORDS):
        print(f'\nERROR: Model "{model}" is not activated on your account.',
              file=sys.stderr)
        print(f'To activate this model, visit: {_MODEL_MARKET_URL}',
              file=sys.stderr)
        print('Then find the model and click "Enable" / "\u5f00\u901a" to activate it.',
              file=sys.stderr)
        print(f'Original error: {error_msg}', file=sys.stderr)
        return True
    return False

# ---------------------------------------------------------------------------
def _handle_result(result: dict[str, Any], args: argparse.Namespace,
                   model: str = "") -> None:
    output = result.get("output", {})
    status = output.get("task_status", "")
    if status != "SUCCEEDED":
        msg = output.get("message", "Unknown error")
        code = output.get("code", "")
        _check_not_activated(f"{code}: {msg}" if code else msg, model)
        print(f"Error: Task failed ({status}): {msg}", file=sys.stderr)
        sys.exit(1)

    video_url = extract_video_url(result)
    if not video_url:
        print(f"Error: No video URL in result: {result}", file=sys.stderr)
        sys.exit(1)

    # Determine output: user-specified filename (video extension) vs directory
    if args.output.suffix.lower() in _VIDEO_EXTENSIONS:
        video_file = args.output
        out_dir = video_file.parent
    else:
        out_dir = args.output
        url_basename = Path(urlparse(video_url).path).name
        if url_basename and "." in url_basename:
            video_file = out_dir / url_basename
        else:
            video_file = out_dir / "video.mp4"

    out_dir.mkdir(parents=True, exist_ok=True)
    resp_file = out_dir / "response.json"
    resp_file.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Response saved to {resp_file}", file=sys.stderr)
    try:
        download_file(video_url, video_file)
    except Exception as e:
        print(f"Warning: Could not download video: {e}", file=sys.stderr)
    else:
        print(f"Video saved to {video_file}", file=sys.stderr)

    if args.print_response:
        print(json.dumps({
            "video_url": video_url,
            "local_path": str(video_file),
        }, ensure_ascii=False))

    print(f"Video URL: {video_url}", file=sys.stderr)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    run_update_signal(caller=__file__)
    parser = argparse.ArgumentParser(
        description="Generate video via Wan models (t2v/i2v/kf2v/r2v/vace)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
mode auto-detection (from request JSON fields):
  t2v   prompt only → text-to-video (default: wan2.6-t2v, or wan2.7-t2v)
  i2v   img_url/media/first_frame_url → image-to-video (default: wan2.6-i2v-flash, or wan2.7-i2v)
  kf2v  first_frame_url (without media) → keyframe-to-video (default: wan2.2-kf2v-flash)
  r2v   reference_urls → reference role-play (default: wan2.6-r2v-flash)
  vace  function → video editing/repaint/extend (default: wanx2.1-vace-plus)

model version differences (handled automatically):
  wan2.6-t2v / wan2.7-t2v / happyhorse-1.0-t2v:
    - wan2.6-t2v uses "size" (e.g. "1280*720"), supports seed/shot_type
    - wan2.7-t2v / happyhorse-1.0-t2v use "resolution" + "ratio"
  wan2.6-i2v / wan2.7-i2v / happyhorse-1.0-i2v:
    - wan2.6-i2v uses single img_url
    - wan2.7-i2v uses media[] array (first_frame/last_frame/driving_audio/first_clip),
      supports negative_prompt + prompt_extend
    - happyhorse-1.0-i2v has its own strict spec: media=[{type:'first_frame',url}]
      (exactly one). Rejects negative_prompt / prompt_extend / ratio / last_frame /
      first_clip / driving_audio. Legacy img_url is auto-converted for convenience.
  wan2.6-r2v / happyhorse-1.0-r2v:
    - wan2.6-r2v uses reference_urls + size
    - happyhorse-1.0-r2v uses media=[{type:reference_image, url}] + resolution + ratio (≤9 refs)
  wan2.7-videoedit / happyhorse-1.0-video-edit:
    - both use input.media = [{type:video, url}] + [{type:reference_image, url}] (no `function` field)
    - wan2.7-videoedit additionally supports negative_prompt; happyhorse caps refs at 5

request JSON fields (--request / --file):
  prompt            Text description (required for t2v/i2v/r2v, optional for vace)
  duration          Video length in seconds (default: 5, wan2.7: 2-15)
  size              Resolution for wan2.6 t2v/r2v, e.g. "1280*720"
  resolution        Resolution for wan2.7/i2v/kf2v, e.g. "720P", "1080P"
  ratio             Aspect ratio for wan2.7-t2v, e.g. "16:9", "9:16"
  img_url           First-frame image (i2v wan2.6)
  first_frame_url   First frame (wan2.7-i2v/kf2v)
  last_frame_url    Last frame (wan2.7-i2v/kf2v)
  first_clip_url    Video to continue (wan2.7-i2v)
  driving_audio_url Audio for lip-sync (wan2.7-i2v)
  media             Array of {type, url} for wan2.7-i2v
  reference_urls    Character reference URLs (r2v)
  function          VACE: repainting, editing, extension, outpainting
  video_url         Source video (VACE)
  audio_url         Audio track (t2v/i2v)
  negative_prompt   What to avoid
  seed              Reproducibility (wan2.6 only)
  prompt_extend     Auto-enhance prompt (default: true)
  watermark         Add watermark (default: false)

local files:
  Local paths are auto-uploaded to DashScope temp storage (48h TTL).

environment variables:
  DASHSCOPE_API_KEY  (required) API key — also loaded from .env
  QIANWEN_API_KEY       (alternative)
  QWEN_REGION        cn-beijing (default)

examples:
  # Text-to-video (wan2.6)
  python scripts/video.py --request '{"prompt":"A cat playing piano","duration":5}'

  # Text-to-video with wan2.7 (ratio, auto-dubbing)
  python scripts/video.py --request '{"prompt":"Multi-shot cinematic...",
    "resolution":"1080P","ratio":"16:9","duration":15}' --model wan2.7-t2v

  # Image-to-video (wan2.6)
  python scripts/video.py --request '{"prompt":"Animate this","img_url":"photo.jpg"}'

  # Image-to-video with wan2.7 (first frame + audio sync)
  python scripts/video.py --request '{"prompt":"A rapper sings","first_frame_url":"rapper.png",
    "driving_audio_url":"rap.mp3"}' --model wan2.7-i2v

  # Video continuation with wan2.7
  python scripts/video.py --request '{"prompt":"Dog continues skateboarding",
    "first_clip_url":"dog_skateboard.mp4"}' --model wan2.7-i2v

  # Submit only, then resume later
  python scripts/video.py --request '{"prompt":"A sunset"}' --submit-only
  python scripts/video.py --task-id <TASK_ID>

  # VACE video editing
  python scripts/video.py --request '{"function":"repainting",
    "video_url":"input.mp4","prompt":"Change sky to sunset"}'

  # Video editing with wan2.7-videoedit (media[] protocol, no `function`)
  python scripts/video.py --request '{"prompt":"Replace the man with a robot",
    "video_url":"input.mp4","reference_images":["robot.png"],
    "resolution":"1080P","ratio":"16:9"}' --model wan2.7-videoedit

""",
    )
    parser.add_argument("--request", type=str, help="Inline JSON: fields depend on mode")
    parser.add_argument("--file", type=Path, help="Path to JSON file containing request body")
    parser.add_argument("--output", type=Path, default=Path("output/qianwen-video-generation"),
                        help="Directory to save response and video (default: %(default)s)")
    parser.add_argument("--print-response", action="store_true", help="Print video URL to stdout")
    parser.add_argument("--model", type=str,
                        help="Model ID (overrides auto-default; see epilog for defaults per mode)")
    parser.add_argument("--mode", type=str,
                        choices=["t2v", "i2v", "kf2v", "r2v", "vace", "videoedit"],
                        help="Force mode (auto-detected from request fields if omitted). "
                             "'videoedit' is for wan2.7-videoedit / happyhorse-1.0-video-edit.")
    parser.add_argument("--poll-interval", type=int, default=15,
                        help="Seconds between poll attempts (default: 15)")
    parser.add_argument("--timeout", type=int, default=600,
                        help="Max seconds to wait for task (default: 600)")
    parser.add_argument("--submit-only", action="store_true",
                        help="Submit task, print task_id to stdout, exit without polling")
    parser.add_argument("--task-id", type=str,
                        help="Resume polling an existing task (skip submission)")
    parser.add_argument("--poll-once", action="store_true",
                        help="With --task-id: single status check, exit code 2 if not done")
    parser.add_argument("--quiet", "-q", action="store_true",
                        help="Suppress progress output during polling")
    args = parser.parse_args()

    verbose = not args.quiet
    api_key = require_api_key(script_file=__file__, domain="Video")

    # --- Single check mode ---
    if args.task_id and args.poll_once:
        result = http_request("GET", f"{native_base_url()}/tasks/{args.task_id}", api_key)
        if verbose:
            print(f"  {format_task_status(result)}", file=sys.stderr)
        status = result.get("output", {}).get("task_status", "")
        if status in ("SUCCEEDED", "FAILED", "CANCELED"):
            _handle_result(result, args, model=args.model or "")
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))
            sys.exit(2)
        return

    # --- Resume mode ---
    if args.task_id:
        task_id = args.task_id
        if verbose:
            print(f"Resuming task: {task_id}", file=sys.stderr)
            print(f"Polling every {args.poll_interval}s (timeout: {args.timeout}s)...",
                  file=sys.stderr)
        try:
            result = poll_task(task_id, api_key,
                               timeout_s=args.timeout, interval=args.poll_interval,
                               verbose=verbose)
        except TimeoutError as e:
            print(f"Error: {e}", file=sys.stderr)
            print(f"Task may still be running. Resume with: --task-id {task_id}", file=sys.stderr)
            sys.exit(1)
        _handle_result(result, args, model=args.model or "")
        return

    # --- Normal mode: submit new task ---
    try:
        request = load_request(args)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    # CLI --model takes precedence over any "model" in the request JSON. Inject it
    # into `request` BEFORE detect_mode() so that model-based routing (R2V for
    # wan2.7-r2v / happyhorse-r2v, wan3.0-video t2v/i2v, video-edit) fires even when
    # the model is supplied only via --model. Otherwise detect_mode() would see the
    # `media` field first and misclassify wan2.7-r2v/happyhorse-r2v as i2v, bypassing
    # their dedicated builders (and the wan2.7-r2v len(media)<=5 guard).
    if args.model:
        request["model"] = args.model
    mode = args.mode or detect_mode(request)
    model = args.model or request.get("model") or DEFAULT_MODELS[mode]
    # Model-aware correction: wan2.7-i2v / happyhorse-i2v use first_frame_url
    # but belong to i2v mode (detect_mode would have classified them as kf2v).
    # (detect_mode has no wan2.7-i2v branch, so this correction is still required.)
    if model in _WAN27_I2V_MODELS or model in _HAPPYHORSE_I2V_MODELS:
        if mode == MODE_KF2V:
            mode = MODE_I2V
    # Video-edit models: correct t2v fallback when --model specifies a video-edit model
    if model in _VIDEO_EDIT_MODELS and mode != MODE_VIDEO_EDIT:
        mode = MODE_VIDEO_EDIT
    duration = request.get("duration", 5)
    resolution = resolve_resolution(request, mode)
    token_plan = is_token_plan_key(api_key)
    validate_token_plan_model(api_key, model)
    cost_str = None if token_plan else estimate_cost(model, duration, resolution)

    if verbose:
        info = f"Mode: {mode} | Model: {model}"
        if token_plan:
            info += f" | Credits: see {_TOKEN_PLAN_CONSOLE_URL}"
        elif cost_str:
            info += f" | Cost: {cost_str}"
        print(info, file=sys.stderr)

    resolve_request_urls(request, api_key, model, RESOLVE_KEYS[mode])

    builder = PAYLOAD_BUILDERS[mode]
    try:
        payload = builder(request, model)
    except (ValueError, KeyError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    url = f"{native_base_url()}{ENDPOINTS[mode]}"

    try:
        resp = http_request("POST", url, api_key, payload,
                            extra_headers={"X-DashScope-Async": "enable"}, timeout=60)
    except Exception as e:
        _check_not_activated(str(e), model)
        print(f"API error: {e}", file=sys.stderr)
        sys.exit(1)

    task_id = resp.get("output", {}).get("task_id")
    if not task_id:
        print(f"Error: No task_id in response: {json.dumps(resp, ensure_ascii=False)[:500]}",
              file=sys.stderr)
        sys.exit(1)

    if verbose:
        print(f"Task submitted: {task_id}", file=sys.stderr)

    if args.submit_only:
        print(task_id)
        return

    if verbose:
        print(f"Polling every {args.poll_interval}s (timeout: {args.timeout}s)...",
              file=sys.stderr)

    try:
        result = poll_task(task_id, api_key,
                           timeout_s=args.timeout, interval=args.poll_interval,
                           verbose=verbose)
    except TimeoutError as e:
        print(f"Error: {e}", file=sys.stderr)
        print(f"Task may still be running. Resume with: --task-id {task_id}", file=sys.stderr)
        sys.exit(1)

    _handle_result(result, args, model=model)

if __name__ == "__main__":
    main()