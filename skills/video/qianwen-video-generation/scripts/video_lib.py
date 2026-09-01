"""Video generation helpers: mode constants, payload builders, result extraction.

Shared library for video.py. Contains all mode constants, model defaults,
endpoint paths, payload construction, and result parsing/formatting logic.
Stdlib only -- no pip install required.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qianwen_lib import resolve_file  # noqa: E402

# ---------------------------------------------------------------------------
# Mode constants
# ---------------------------------------------------------------------------

MODE_T2V = "t2v"
MODE_I2V = "i2v"
MODE_KF2V = "kf2v"
MODE_R2V = "r2v"
MODE_VACE = "vace"
MODE_VIDEO_EDIT = "videoedit"

DEFAULT_MODELS: dict[str, str] = {
    MODE_T2V: "happyhorse-1.1-t2v",
    MODE_I2V: "happyhorse-1.1-i2v",
    MODE_KF2V: "wan2.2-kf2v-flash",
    MODE_R2V: "happyhorse-1.1-r2v",
    MODE_VACE: "wanx2.1-vace-plus",
    MODE_VIDEO_EDIT: "wan2.7-videoedit",
}

# wan2.7-style models use resolution+ratio (instead of size).
# NOTE: happyhorse-1.0-t2v and happyhorse-1.1-t2v keep sharing the wan2.7-t2v structure (resolution+ratio).
# happyhorse-1.0-i2v / happyhorse-1.1-i2v have been split out into their own predicate/builder
# because their API spec diverges significantly from wan2.7-i2v
# (no negative_prompt / no prompt_extend / no ratio / media must be exactly
# one {type:'first_frame'}). See _build_happyhorse_i2v_payload below.
_WAN27_T2V_MODELS = frozenset({"wan2.7-t2v", "wan2.7-t2v-2026-06-12",
                               "happyhorse-1.0-t2v", "happyhorse-1.1-t2v"})
_WAN27_I2V_MODELS = frozenset({"wan2.7-i2v"})
_HAPPYHORSE_I2V_MODELS = frozenset({"happyhorse-1.0-i2v", "happyhorse-1.1-i2v"})

# happyhorse-r2v uses media[{type:reference_image, url}] + resolution+ratio
# (different from wan2.6-r2v which uses reference_urls + size).
_HAPPYHORSE_R2V_MODELS = frozenset({"happyhorse-1.0-r2v", "happyhorse-1.1-r2v"})

# wan2.7-r2v uses input.media = [{type, url}, ...] with mixed reference types
# (reference_image / reference_video / reference_audio, up to 5) + resolution
# + duration + prompt_extend + watermark. NO `ratio` (auto-derived from refs).
# Distinct from happyhorse-r2v (reference_image only) and wan2.6-r2v (reference_urls+size).
_WAN27_R2V_MODELS = frozenset({"wan2.7-r2v"})

# wan3.0-video / wan3.0-video-prime are all-in-one models supporting both t2v
# (input.prompt only) and i2v (input.media=[{type:reference_image, url}]).
# parameters: resolution (480P~1080P) + ratio + duration (<=30s).
# Routed by model id inside build_t2v_payload / build_i2v_payload.
_WAN30_VIDEO_MODELS = frozenset({"wan3.0-video", "wan3.0-video-prime"})

# Video-edit models share a unified payload (media=[1 video]+[refs], no `function`).
_VIDEO_EDIT_MODELS = frozenset({"happyhorse-1.0-video-edit", "wan2.7-videoedit"})


ENDPOINTS: dict[str, str] = {
    MODE_T2V: "/services/aigc/video-generation/video-synthesis",
    MODE_I2V: "/services/aigc/video-generation/video-synthesis",
    MODE_KF2V: "/services/aigc/image2video/video-synthesis",
    MODE_R2V: "/services/aigc/video-generation/video-synthesis",
    MODE_VACE: "/services/aigc/video-generation/video-synthesis",
    MODE_VIDEO_EDIT: "/services/aigc/video-generation/video-synthesis",
}

_PRICING_URL = "https://platform.qianwenai.com/docs/developer-guides/getting-started/pricing"

# ---------------------------------------------------------------------------
# Mode detection
# ---------------------------------------------------------------------------

def detect_mode(request: dict[str, Any]) -> str:
    """Auto-detect video generation mode from request fields."""
    # Highest priority: video-edit models do NOT have `function` field;
    # detect by model id so they don't fall through to MODE_VACE or MODE_I2V.
    model = request.get("model", "")
    if model in _VIDEO_EDIT_MODELS:
        return MODE_VIDEO_EDIT
    # wan3.0-video / wan3.0-video-prime are all-in-one: pick t2v vs i2v by whether
    # a reference image is supplied (media / img_url / reference_image).
    if model in _WAN30_VIDEO_MODELS:
        if (request.get("media") or request.get("img_url")
                or request.get("reference_image")
                or request.get("reference_urls")):
            return MODE_I2V
        return MODE_T2V
    if request.get("function"):
        return MODE_VACE
    if request.get("reference_urls"):
        return MODE_R2V
    # happyhorse-r2v / wan2.7-r2v may also be triggered by model id alone
    if model in _HAPPYHORSE_R2V_MODELS or model in _WAN27_R2V_MODELS:
        return MODE_R2V
    # wan2.7-i2v uses media array or first_clip_url
    if request.get("media") or request.get("first_clip_url"):
        return MODE_I2V
    if request.get("first_frame_url"):
        return MODE_KF2V
    if request.get("img_url") or request.get("reference_image"):
        return MODE_I2V
    return MODE_T2V

# ---------------------------------------------------------------------------
# File resolution helpers
# ---------------------------------------------------------------------------

RESOLVE_KEYS: dict[str, list[str]] = {
    MODE_T2V: ["audio_url", "video_url"],
    MODE_I2V: ["img_url", "reference_image", "audio_url",
               "first_frame_url", "last_frame_url", "driving_audio_url", "first_clip_url",
               "media", "reference_urls"],
    MODE_KF2V: ["first_frame_url", "last_frame_url"],
    MODE_R2V: ["reference_urls", "media"],
    MODE_VACE: ["video_url", "mask_image_url", "mask_video_url",
                "ref_images_url", "first_clip_url", "last_clip_url",
                "first_frame_url", "last_frame_url", "media"],
    MODE_VIDEO_EDIT: ["video_url", "reference_images", "media"],
}


def resolve_request_urls(request: dict[str, Any], api_key: str, model: str,
                         keys: list[str]) -> None:
    """In-place resolve local file paths to OSS URLs for the given request keys."""
    for key in keys:
        val = request.get(key)
        if val is None:
            continue
        if isinstance(val, str):
            request[key] = resolve_file(val, api_key=api_key, model=model)
        elif isinstance(val, list):
            if val and isinstance(val[0], dict):
                # Handle list[dict] structure (e.g. media: [{type: "...", url: "..."}])
                for item in val:
                    if isinstance(item, dict) and "url" in item:
                        url_val = item["url"]
                        if isinstance(url_val, str):
                            item["url"] = resolve_file(url_val, api_key=api_key, model=model)
            else:
                # Original logic: handle list[str]
                request[key] = [resolve_file(str(v), api_key=api_key, model=model) for v in val]

# ---------------------------------------------------------------------------
# Payload builders
# ---------------------------------------------------------------------------

def build_t2v_payload(request: dict[str, Any], model: str) -> dict[str, Any]:
    """Build payload for text-to-video generation (wan2.6/wan2.7/happyhorse-t2v)."""
    # wan3.0-video / wan3.0-video-prime use their own unified builder.
    if model in _WAN30_VIDEO_MODELS:
        return _build_wan30_video_payload(request, model)

    is_v27 = model in _WAN27_T2V_MODELS

    input_obj: dict[str, Any] = {"prompt": request.get("prompt", "")}
    if request.get("negative_prompt"):
        input_obj["negative_prompt"] = request["negative_prompt"]
    if request.get("audio_url"):
        input_obj["audio_url"] = request["audio_url"]

    params: dict[str, Any] = {"duration": request.get("duration", 5)}

    if is_v27:
        # wan2.7-t2v: uses resolution and ratio
        params["resolution"] = request.get("resolution", "1080P")
        if request.get("ratio"):
            params["ratio"] = request["ratio"]
    else:
        # wan2.6-t2v: uses size
        if request.get("size"):
            params["size"] = request["size"]
        for key in ("seed", "shot_type"):
            if request.get(key) is not None:
                params[key] = request[key]

    for key in ("prompt_extend", "watermark"):
        if request.get(key) is not None:
            params[key] = request[key]

    return {"model": model, "input": input_obj, "parameters": params}


def build_i2v_payload(request: dict[str, Any], model: str) -> dict[str, Any]:
    """Build payload for image-to-video generation (wan2.6/wan2.7/happyhorse).

    Routing (front-loaded predicates -- different model families MUST NOT
    share a builder, even when payloads look superficially similar):
      1. happyhorse-1.0-i2v / happyhorse-1.1-i2v -> _build_happyhorse_i2v_payload (strict spec)
      2. wan2.7-i2v / explicit media[] / first_clip_url -> _build_i2v_v27_payload
      3. wan2.6-i2v fallback (single img_url)
    """
    # 1) happyhorse-i2v has its own strict spec; never fall through.
    if model in _HAPPYHORSE_I2V_MODELS:
        return _build_happyhorse_i2v_payload(request, model)

    # 1b) wan3.0-video / wan3.0-video-prime use their own unified builder.
    if model in _WAN30_VIDEO_MODELS:
        return _build_wan30_video_payload(request, model)

    # 2) wan2.7-i2v uses media array
    is_v27 = model in _WAN27_I2V_MODELS
    if is_v27 or request.get("media") or request.get("first_clip_url"):
        return _build_i2v_v27_payload(request, model)

    # 3) wan2.6-i2v uses img_url
    img_url = request.get("img_url") or request.get("reference_image", "")
    input_obj: dict[str, Any] = {"prompt": request.get("prompt", ""), "img_url": img_url}
    if request.get("negative_prompt"):
        input_obj["negative_prompt"] = request["negative_prompt"]
    if request.get("audio_url"):
        input_obj["audio_url"] = request["audio_url"]

    params: dict[str, Any] = {
        "resolution": request.get("resolution", "720P"),
        "duration": request.get("duration", 5),
    }
    for key in ("prompt_extend", "watermark", "seed", "shot_type", "template", "audio"):
        if request.get(key) is not None:
            params[key] = request[key]

    return {"model": model, "input": input_obj, "parameters": params}


def _build_happyhorse_i2v_payload(request: dict[str, Any], model: str) -> dict[str, Any]:
    """Build payload for happyhorse-1.0-i2v.

    Per official docs (ref/.../happyhorse-image-to-video/create-task.md):
      - input: ONLY `prompt` (optional) and `media` (required).
      - media: must be EXACTLY ONE item with `type='first_frame'`.
      - parameters: ONLY `resolution` / `duration` / `watermark` / `seed`.
      - duration range: 3-15 seconds.
      - resolution enum: '720P' | '1080P', default '1080P'.
      - REJECTED by server (will 400) if any of these are sent:
        `negative_prompt`, `prompt_extend`, `ratio`,
        `last_frame`, `driving_audio`, `first_clip`, `audio_url`.

    Backward-compat: accept wan2.6-style `img_url` / `reference_image` and
    auto-promote to media=[{type:'first_frame', url:...}].
    """
    # 1) Build media (exactly one first_frame).
    media = request.get("media")
    if media:
        if (not isinstance(media, list) or len(media) != 1
                or not isinstance(media[0], dict)
                or media[0].get("type") != "first_frame"
                or not media[0].get("url")):
            raise ValueError(
                f"{model} requires media=[{{type:'first_frame', url:...}}] "
                "with exactly one item."
            )
    else:
        url = (request.get("first_frame_url")
               or request.get("img_url")
               or request.get("reference_image"))
        if not url:
            raise ValueError(
                f"{model} requires a first frame image. Provide via "
                "`first_frame_url`, `img_url`, or "
                "media=[{type:'first_frame', url:...}]."
            )
        media = [{"type": "first_frame", "url": url}]

    # 2) Warn-and-drop unsupported input fields (avoid silent server 400).
    for unsupported in ("negative_prompt", "last_frame_url", "first_clip_url",
                        "driving_audio_url", "audio_url"):
        if request.get(unsupported):
            print(
                f"Warning: {model} does not accept `{unsupported}`; dropped. "
                "Use wan2.7-i2v if you need this feature.",
                file=sys.stderr,
            )

    input_obj: dict[str, Any] = {"media": media}
    if request.get("prompt"):
        input_obj["prompt"] = request["prompt"]

    # 3) Build parameters (whitelist only).
    params: dict[str, Any] = {
        "resolution": request.get("resolution", "1080P"),
        "duration": request.get("duration", 5),
    }
    for key in ("watermark", "seed"):
        if request.get(key) is not None:
            params[key] = request[key]

    # 4) Warn-and-drop unsupported parameters.
    for unsupported in ("prompt_extend", "ratio"):
        if request.get(unsupported) is not None:
            print(
                f"Warning: {model} does not accept parameter `{unsupported}`; "
                "dropped.",
                file=sys.stderr,
            )

    return {"model": model, "input": input_obj, "parameters": params}

def _build_i2v_v27_payload(request: dict[str, Any], model: str) -> dict[str, Any]:
    """Build payload for wan2.7-i2v unified image-to-video generation.

    Serves wan2.7-i2v ONLY. happyhorse-1.0-i2v has its own dedicated
    builder (_build_happyhorse_i2v_payload) -- do NOT add happyhorse
    compat code here.

    Supports: first_frame, last_frame, driving_audio, first_clip
    (video continuation), explicit media[] passthrough.
    """
    media: list[dict[str, str]] = []

    if request.get("media"):
        media = request["media"]
    else:
        if request.get("first_frame_url"):
            media.append({"type": "first_frame", "url": request["first_frame_url"]})
        if request.get("last_frame_url"):
            media.append({"type": "last_frame", "url": request["last_frame_url"]})
        if request.get("driving_audio_url"):
            media.append({"type": "driving_audio", "url": request["driving_audio_url"]})
        if request.get("first_clip_url"):
            media.append({"type": "first_clip", "url": request["first_clip_url"]})

    if not media:
        raise ValueError(
            f"{model} requires at least one media asset. "
            "Use first_frame_url, first_clip_url, or media array."
        )

    input_obj: dict[str, Any] = {"media": media}
    if request.get("prompt"):
        input_obj["prompt"] = request["prompt"]
    if request.get("negative_prompt"):
        input_obj["negative_prompt"] = request["negative_prompt"]

    params: dict[str, Any] = {
        "resolution": request.get("resolution", "1080P"),
        "duration": request.get("duration", 5),
    }
    for key in ("prompt_extend", "watermark"):
        if request.get(key) is not None:
            params[key] = request[key]

    return {"model": model, "input": input_obj, "parameters": params}


def build_kf2v_payload(request: dict[str, Any], model: str) -> dict[str, Any]:
    """Build payload for keyframe-to-video generation."""
    input_obj: dict[str, Any] = {
        "first_frame_url": request.get("first_frame_url", ""),
        "prompt": request.get("prompt", ""),
    }
    if request.get("last_frame_url"):
        input_obj["last_frame_url"] = request["last_frame_url"]
    if request.get("template"):
        input_obj["template"] = request["template"]

    params: dict[str, Any] = {
        "resolution": request.get("resolution", "720P"),
        "duration": 5,  # Fixed at 5 seconds per qwdocs
    }
    for key in ("prompt_extend", "watermark", "seed"):
        if request.get(key) is not None:
            params[key] = request[key]

    return {"model": model, "input": input_obj, "parameters": params}


def build_r2v_payload(request: dict[str, Any], model: str) -> dict[str, Any]:
    """Build payload for reference-based role-play video generation."""
    # wan2.7-r2v uses input.media = [{type, url}] mixed refs (image/video/audio).
    if model in _WAN27_R2V_MODELS:
        return _build_r2v_wan27_payload(request, model)
    # happyhorse-r2v uses a different payload structure (media array + resolution+ratio).
    if model in _HAPPYHORSE_R2V_MODELS:
        return _build_r2v_happyhorse_payload(request, model)

    input_obj: dict[str, Any] = {
        "prompt": request.get("prompt", ""),
        "reference_urls": request.get("reference_urls", []),
    }
    params: dict[str, Any] = {
        "size": request.get("size", "1280*720"),
        "duration": request.get("duration", 5),
    }
    for key in ("shot_type", "watermark", "audio"):
        if request.get(key) is not None:
            params[key] = request[key]

    return {"model": model, "input": input_obj, "parameters": params}

def _build_r2v_happyhorse_payload(request: dict[str, Any], model: str) -> dict[str, Any]:
    """Build payload for happyhorse-1.0-r2v.

    Structure: input.media = [{type:"reference_image", url}, ...] + resolution + ratio.
    Up to 9 reference images supported.
    """
    media: list[dict[str, str]] = []
    for url in (request.get("reference_urls") or []):
        media.append({"type": "reference_image", "url": str(url)})
    for item in (request.get("media") or []):
        if isinstance(item, dict):
            media.append(item)
        else:
            media.append({"type": "reference_image", "url": str(item)})
    if not media:
        raise ValueError(
            "happyhorse-1.0-r2v requires at least one reference image. "
            "Provide via reference_urls=[...] or media=[{type:reference_image, url}]."
        )

    input_obj: dict[str, Any] = {
        "prompt": request.get("prompt", ""),
        "media": media,
    }
    if request.get("negative_prompt"):
        input_obj["negative_prompt"] = request["negative_prompt"]

    params: dict[str, Any] = {
        "resolution": request.get("resolution", "720P"),
        "duration": request.get("duration", 5),
    }
    for key in ("ratio", "watermark", "seed", "prompt_extend", "audio_setting"):
        if request.get(key) is not None:
            params[key] = request[key]

    return {"model": model, "input": input_obj, "parameters": params}


_WAN27_R2V_MAX_MEDIA = 5


def _build_r2v_wan27_payload(request: dict[str, Any], model: str) -> dict[str, Any]:
    """Build payload for wan2.7-r2v multi-reference video generation.

    Verified contract (tmp/test-new-models/wan2.7-r2v):
      - input.media = [{type, url}, ...] where type in
        {reference_image, reference_video, reference_audio}; up to 5 mixed refs.
      - input.prompt: passthrough.
      - parameters: resolution (720P/1080P) + duration (<=10s) + prompt_extend + watermark.
      - NO `ratio` (auto-derived from references), NO `fps`.

    Backward-compat: accept `reference_urls=[...]` (bare strings promoted to
    reference_image) in addition to explicit media=[{type, url}].
    """
    media: list[dict[str, str]] = []
    for url in (request.get("reference_urls") or []):
        media.append({"type": "reference_image", "url": str(url)})
    for item in (request.get("media") or []):
        if isinstance(item, dict):
            media.append(item)
        else:
            media.append({"type": "reference_image", "url": str(item)})

    if not media:
        raise ValueError(
            f"{model} requires at least one reference. Provide via "
            "reference_urls=[...] or media=[{type:reference_image|reference_video|"
            "reference_audio, url}]."
        )
    if len(media) > _WAN27_R2V_MAX_MEDIA:
        raise ValueError(
            f"{model} accepts at most {_WAN27_R2V_MAX_MEDIA} reference media items "
            f"(got {len(media)})."
        )

    input_obj: dict[str, Any] = {
        "prompt": request.get("prompt", ""),
        "media": media,
    }

    params: dict[str, Any] = {
        "resolution": request.get("resolution", "720P"),
        "duration": request.get("duration", 5),
    }
    for key in ("prompt_extend", "watermark", "seed"):
        if request.get(key) is not None:
            params[key] = request[key]

    return {"model": model, "input": input_obj, "parameters": params}


def _build_wan30_video_payload(request: dict[str, Any], model: str) -> dict[str, Any]:
    """Build payload for wan3.0-video / wan3.0-video-prime (unified t2v + i2v).

    Verified contract (tmp/test-new-models/wan3.0-video, wan3.0-video-prime):
      - t2v: input has only `prompt` (no media).
      - i2v: input.media = [{type:'reference_image', url}, ...] from
        media / img_url / reference_image.
      - parameters: resolution (480P~1080P) + ratio (adaptive/16:9/9:16/1:1)
        + duration (<=30s).
    """
    input_obj: dict[str, Any] = {"prompt": request.get("prompt", "")}

    media: list[dict[str, str]] = []
    if request.get("media"):
        for item in request["media"]:
            if isinstance(item, dict):
                media.append(item)
            else:
                media.append({"type": "reference_image", "url": str(item)})
    else:
        url = request.get("img_url") or request.get("reference_image")
        if url:
            media.append({"type": "reference_image", "url": str(url)})
    # reference_urls → media compat layer (silent mapping, same as wan2.7-r2v)
    for ref_url in (request.get("reference_urls") or []):
        media.append({"type": "reference_image", "url": str(ref_url)})
    if media:
        input_obj["media"] = media
    if request.get("negative_prompt"):
        input_obj["negative_prompt"] = request["negative_prompt"]

    params: dict[str, Any] = {
        "resolution": request.get("resolution", "1080P"),
        "duration": request.get("duration", 5),
    }
    for key in ("ratio", "prompt_extend", "watermark", "seed"):
        if request.get(key) is not None:
            params[key] = request[key]

    return {"model": model, "input": input_obj, "parameters": params}

def build_video_edit_payload(request: dict[str, Any], model: str) -> dict[str, Any]:
    """Build payload for happyhorse-1.0-video-edit and wan2.7-videoedit.

    Structure: input.media = [{type:"video", url}] + [{type:"reference_image", url}, ...]
    No `function` field. Optional negative_prompt (wan2.7-videoedit only).
    """
    media: list[dict[str, str]] = []
    if request.get("video_url"):
        media.append({"type": "video", "url": str(request["video_url"])})
    for item in (request.get("media") or []):
        if isinstance(item, dict):
            media.append(item)
        else:
            media.append({"type": "reference_image", "url": str(item)})
    for url in (request.get("reference_images") or []):
        media.append({"type": "reference_image", "url": str(url)})

    if not media:
        raise ValueError(
            f"{model} requires at least one media asset. "
            "Provide video_url=... and/or reference_images=[...]."
        )

    input_obj: dict[str, Any] = {"media": media}
    if request.get("prompt"):
        input_obj["prompt"] = request["prompt"]
    if request.get("negative_prompt"):
        input_obj["negative_prompt"] = request["negative_prompt"]

    params: dict[str, Any] = {}
    for key in ("resolution", "ratio", "duration", "audio_setting",
                "prompt_extend", "watermark", "seed"):
        if request.get(key) is not None:
            params[key] = request[key]

    return {"model": model, "input": input_obj, "parameters": params}


def build_vace_payload(request: dict[str, Any], model: str) -> dict[str, Any]:
    """Build payload for VACE video editing (repainting, extension, outpainting, etc.)."""
    func = request["function"]
    input_obj: dict[str, Any] = {"function": func}

    if request.get("prompt"):
        input_obj["prompt"] = request["prompt"]

    url_fields = [
        "video_url", "mask_image_url", "mask_video_url",
        "first_clip_url", "last_clip_url",
        "first_frame_url", "last_frame_url",
    ]
    for field in url_fields:
        if request.get(field):
            input_obj[field] = request[field]

    if request.get("ref_images_url"):
        input_obj["ref_images_url"] = request["ref_images_url"]
    if request.get("mask_frame_id") is not None:
        input_obj["mask_frame_id"] = request["mask_frame_id"]

    params: dict[str, Any] = {}
    param_keys = [
        "prompt_extend", "size", "watermark", "obj_or_bg",
        "control_condition", "strength", "mask_type", "expand_ratio",
        "top_scale", "bottom_scale", "left_scale", "right_scale",
    ]
    for key in param_keys:
        if request.get(key) is not None:
            params[key] = request[key]

    return {"model": model, "input": input_obj, "parameters": params}


PAYLOAD_BUILDERS: dict[str, Any] = {
    MODE_T2V: build_t2v_payload,
    MODE_I2V: build_i2v_payload,
    MODE_KF2V: build_kf2v_payload,
    MODE_R2V: build_r2v_payload,
    MODE_VACE: build_vace_payload,
    MODE_VIDEO_EDIT: build_video_edit_payload,
}

# ---------------------------------------------------------------------------
# Result extraction and status formatting
# ---------------------------------------------------------------------------

def extract_video_url(result: dict[str, Any]) -> str | None:
    """Extract video URL from task result, checking both output formats."""
    output = result.get("output", {})
    url = output.get("video_url")
    if url:
        return url
    results = output.get("results", [])
    if results and isinstance(results[0], dict):
        return results[0].get("url")
    return None


def estimate_cost(_model: str, _duration: int, _resolution: str,
                  _cny: bool = False) -> str:
    """Return a pricing page reference instead of a hardcoded estimate."""
    return f"see {_PRICING_URL} for current rates"


def resolve_resolution(request: dict[str, Any], mode: str) -> str:
    """Derive a human-readable resolution label from the request for cost estimation."""
    # Modes that use resolution parameter
    if mode in (MODE_I2V, MODE_KF2V):
        return request.get("resolution", "720P")
    # Modes that use size parameter (wan2.6 t2v, r2v)
    if mode in (MODE_T2V, MODE_R2V):
        # If resolution is explicitly set (wan2.7), use it
        if request.get("resolution"):
            return request["resolution"]
        size = request.get("size", "1280*720")
        try:
            width, height = size.split("*")
            pixels = int(width) * int(height)
        except (ValueError, AttributeError):
            return "720P"
        if pixels >= 1920 * 1080:
            return "1080P"
        if pixels >= 1280 * 720:
            return "720P"
        return "480P"
    return "720P"


def format_task_status(result: dict[str, Any], elapsed: int | None = None) -> str:
    """Format a human-readable task status line for progress reporting."""
    output = result.get("output", {})
    status = output.get("task_status", "UNKNOWN")
    task_id = output.get("task_id", "")
    parts = []
    if elapsed is not None:
        parts.append(f"[{elapsed}s]")
    parts.append(f"task={task_id}" if task_id else "")
    parts.append(f"status={status}")
    metrics = output.get("task_metrics", {})
    if metrics:
        total = metrics.get("TOTAL", 0)
        succeeded = metrics.get("SUCCEEDED", 0)
        failed = metrics.get("FAILED", 0)
        if total:
            parts.append(f"progress={succeeded}/{total}")
        if failed:
            parts.append(f"failed={failed}")
    msg = output.get("message", "")
    if msg and status in ("FAILED", "CANCELED"):
        parts.append(f"msg={msg[:120]}")
    if output.get("video_url"):
        parts.append("video_url=ready")
    return "  ".join(part for part in parts if part)
