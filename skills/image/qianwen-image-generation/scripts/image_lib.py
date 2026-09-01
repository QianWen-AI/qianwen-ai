"""Image generation helpers: model classification, payload builders, response extraction.

Shared library for image.py. Contains all model constants, classification
predicates, payload construction, and response parsing logic.
Stdlib only -- no pip install required.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from qianwen_lib import resolve_file  # noqa: E402

# ---------------------------------------------------------------------------
# Model classification constants
# ---------------------------------------------------------------------------

DEFAULT_MODEL = "wan2.7-image"
DEFAULT_SIZE = "1280*1280"

SYNC_PATH = "/services/aigc/multimodal-generation/generation"
ASYNC_PATH = "/services/aigc/image-generation/generation"
I2I_ASYNC_PATH = "/services/aigc/image2image/image-synthesis"
T2I_ASYNC_PATH = "/services/aigc/text2image/image-synthesis"

_IMAGE_EDIT_MODELS: frozenset[str] = frozenset({"wan2.6-image"})
_MULTI_FUNC_MODELS: frozenset[str] = frozenset({
    "wan2.7-image-pro", "wan2.7-image",
})  # Support both t2i and image editing, no reference_images required
_I2I_MODELS: frozenset[str] = frozenset({"wan2.5-i2i-preview"})
_QWEN_IMAGE_EDIT_MODELS: frozenset[str] = frozenset({
    "qwen-image-3.0-pro", "qwen-image-3.0",
    "qwen-image-2.0-pro", "qwen-image-2.0",
    "qwen-image-edit-max", "qwen-image-edit-plus", "qwen-image-edit",
})
_QWEN_IMAGE_EDIT_PREFIXES: tuple[str, ...] = (
    "qwen-image-3.0-pro-", "qwen-image-3.0-",
    "qwen-image-2.0-pro-", "qwen-image-2.0-",
    "qwen-image-edit-max-", "qwen-image-edit-plus-", "qwen-image-edit-",
)
# qwen-image-3.0 series: exclusive API features (enable_thinking, prompt_extend_mode)
# and NO default size (model auto-recommends resolution when size is omitted).
_QWEN_IMAGE_30_MODELS: frozenset[str] = frozenset({"qwen-image-3.0-pro", "qwen-image-3.0"})
_QWEN_T2I_MODELS: frozenset[str] = frozenset({"qwen-image-plus", "qwen-image-max"})
_QWEN_T2I_VALID_SIZES: frozenset[str] = frozenset({
    "1664*928", "1472*1104", "1328*1328", "1104*1472", "928*1664",
})
_QWEN_IMAGE_EDIT_SINGLE_OUTPUT: frozenset[str] = frozenset({"qwen-image-edit"})

# z-image-turbo: open-source SOTA T2I (6B params, 8-step inference).
# Sync-only; payload allows ONLY a single text content per message;
# parameters accept ONLY {size, prompt_extend, seed} -- NO `n`, NO reference images.
_Z_IMAGE_MODELS: frozenset[str] = frozenset({"z-image-turbo"})


# ---------------------------------------------------------------------------
# Model classification predicates
# ---------------------------------------------------------------------------

def is_image_edit_model(model: str) -> bool:
    """Return True if model is a Wan image-editing model (requires reference images)."""
    return model in _IMAGE_EDIT_MODELS


def is_multi_func_model(model: str) -> bool:
    """Return True if model is a multi-function model (wan2.7 series, supports t2i + editing)."""
    return model in _MULTI_FUNC_MODELS


def is_i2i_model(model: str) -> bool:
    """Return True if model uses the dedicated image-to-image async endpoint."""
    return model in _I2I_MODELS


def is_qwen_image_edit_model(model: str) -> bool:
    """Return True if model is a Qwen image-editing model (includes snapshot versions)."""
    if model in _QWEN_IMAGE_EDIT_MODELS:
        return True
    # Support snapshot versions like qwen-image-2.0-pro-2026-03-03
    return model.startswith(_QWEN_IMAGE_EDIT_PREFIXES)


def is_qwen_t2i_model(model: str) -> bool:
    """Return True if model is a Qwen text-to-image model (async-only)."""
    return model in _QWEN_T2I_MODELS

def is_z_image_model(model: str) -> bool:
    """Return True if model is the z-image series (sync-only, single-text-content)."""
    return model in _Z_IMAGE_MODELS



# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _resolve_file_url(value: str, api_key: str, model: str) -> str:
    """Resolve a local file path or URL, uploading to OSS if needed."""
    return resolve_file(value, api_key=api_key, model=model)

# ---------------------------------------------------------------------------
# Payload builders
# ---------------------------------------------------------------------------

def _build_z_image_payload(req: dict[str, Any], model: str) -> dict[str, Any]:
    """Build payload for z-image-turbo: sync-only, single text content, no `n`, no reference images.

    Per docs (z-image-turbo): parameters accept ONLY size / prompt_extend / seed.
    `n` is NOT supported (server returns 400). Reference images are NOT supported.
    """
    prompt = req.get("prompt")
    if not prompt:
        raise ValueError("z-image-turbo requires non-empty prompt")
    if req.get("reference_images") or req.get("reference_image"):
        print(
            f"Warning: {model} does not accept reference images. "
            "Images will be ignored.",
            file=sys.stderr,
        )
    if req.get("n") not in (None, 1):
        print(
            f"Warning: {model} does not support n>1 (n parameter is forbidden). "
            "Falling back to single-image output.",
            file=sys.stderr,
        )

    parameters: dict[str, Any] = {}
    if req.get("size"):
        parameters["size"] = req["size"]
    if req.get("prompt_extend") is not None:
        parameters["prompt_extend"] = req["prompt_extend"]
    if req.get("seed") is not None:
        parameters["seed"] = req["seed"]

    return {
        "model": model,
        "input": {"messages": [{"role": "user", "content": [{"text": prompt}]}]},
        "parameters": parameters,
    }



def build_payload(req: dict[str, Any], model: str, api_key: str) -> dict[str, Any]:
    """Build the DashScope request payload for Wan image-edit and general generation."""
    # z-image-turbo: dedicated branch (sync-only, single-text-content, no n, no images).
    if is_z_image_model(model):
        return _build_z_image_payload(req, model)

    prompt = req.get("prompt")
    if not prompt:
        raise ValueError("prompt is required")

    enable_interleave = req.get("enable_interleave", False)
    enable_sequential = req.get("enable_sequential", False)
    is_wan_edit = is_image_edit_model(model)
    is_wan_multi = is_multi_func_model(model)
    is_qwen_edit = is_qwen_image_edit_model(model)
    content: list[dict[str, Any]] = [{"text": prompt}]

    # --- Fallback: models that require reference images ---
    if is_wan_edit:
        images = req.get("reference_images") or []
        if not images and req.get("reference_image"):
            images = [req["reference_image"]]
        if not enable_interleave and not images:
            print(
                f"Warning: {model} requires reference_images or enable_interleave=true. "
                f"Falling back to {DEFAULT_MODEL} for text-to-image.",
                file=sys.stderr,
            )
            model = DEFAULT_MODEL
            req["model"] = model
            is_wan_edit = False
    elif is_qwen_edit:
        images = req.get("reference_images") or []
        if not images and req.get("reference_image"):
            images = [req["reference_image"]]
        if not images and model in _QWEN_IMAGE_EDIT_SINGLE_OUTPUT | {"qwen-image-edit-max", "qwen-image-edit-plus"}:
            print(
                f"Warning: {model} requires reference_images for editing. "
                f"Falling back to {DEFAULT_MODEL} for text-to-image.",
                file=sys.stderr,
            )
            model = DEFAULT_MODEL
            req["model"] = model
            is_qwen_edit = False

    # --- Image content building ---
    if is_wan_edit:
        images = req.get("reference_images") or []
        if not images and req.get("reference_image"):
            images = [req["reference_image"]]
        if not enable_interleave and len(images) > 4:
            raise ValueError("Image editing mode supports at most 4 reference images")
        if enable_interleave and len(images) > 1:
            raise ValueError("Interleaved text-image mode supports at most 1 reference image")
        for img in images:
            content.append({"image": _resolve_file_url(str(img), api_key, model)})
    elif is_wan_multi:
        # wan2.7 series: supports 0-9 images
        images = req.get("reference_images") or []
        if not images and req.get("reference_image"):
            images = [req["reference_image"]]
        if len(images) > 9:
            raise ValueError("wan2.7 series supports at most 9 reference images")
        for img in images:
            content.append({"image": _resolve_file_url(str(img), api_key, model)})
    elif is_qwen_edit:
        images = req.get("reference_images") or []
        if not images and req.get("reference_image"):
            images = [req["reference_image"]]
        if len(images) > 3:
            raise ValueError("Qwen image editing supports at most 3 reference images")
        for img in images:
            content.append({"image": _resolve_file_url(str(img), api_key, model)})
    else:
        ref_image = req.get("reference_image")
        if not ref_image and req.get("reference_images"):
            ref_image = req["reference_images"][0]
        if ref_image:
            content.insert(0, {"image": _resolve_file_url(str(ref_image), api_key, model)})

    # --- Parameters ---
    if is_wan_edit:
        parameters: dict[str, Any] = {"size": req.get("size", "1K")}
        parameters["enable_interleave"] = enable_interleave
        if enable_interleave:
            parameters["n"] = 1
            parameters["max_images"] = req.get("max_images", 5)
        else:
            parameters["n"] = req.get("n", 1)
            parameters["prompt_extend"] = req.get("prompt_extend", True)
        parameters["watermark"] = req.get("watermark", False)
    elif is_wan_multi:
        # wan2.7 series parameters
        parameters = {"size": req.get("size", "2K")}  # Default 2K for wan2.7
        parameters["enable_sequential"] = enable_sequential
        if enable_sequential:
            # Sequential mode: n=1-12
            parameters["n"] = min(req.get("n", 1), 12)
        else:
            # Non-sequential: n=1-4
            parameters["n"] = min(req.get("n", 1), 4)
        # thinking_mode: default true (only for t2i without sequential)
        images = req.get("reference_images") or []
        if not images and req.get("reference_image"):
            images = [req["reference_image"]]
        if not enable_sequential and not images:
            parameters["thinking_mode"] = req.get("thinking_mode", True)
        parameters["watermark"] = req.get("watermark", False)
        # bbox_list for interactive editing
        if req.get("bbox_list"):
            parameters["bbox_list"] = req["bbox_list"]
        # color_palette for custom colors (only non-sequential)
        if not enable_sequential and req.get("color_palette"):
            parameters["color_palette"] = req["color_palette"]
    elif is_qwen_edit:
        is_qwen_30 = model in _QWEN_IMAGE_30_MODELS
        if is_qwen_30:
            # qwen-image-3.0 series: NO default size -- only pass size when explicitly
            # provided, so the model auto-recommends resolution otherwise.
            parameters = {}
            if req.get("size"):
                parameters["size"] = req["size"]
        else:
            parameters = {"size": req.get("size", "1024*1024")}
        if model in _QWEN_IMAGE_EDIT_SINGLE_OUTPUT:
            parameters["n"] = 1
        else:
            parameters["n"] = req.get("n", 1)
        parameters["prompt_extend"] = req.get("prompt_extend", True)
        parameters["watermark"] = req.get("watermark", False)
        if is_qwen_30:
            # 3.0-exclusive params: pass through only when explicitly provided.
            # Use membership check so a literal False for enable_thinking is honored.
            if "enable_thinking" in req:
                parameters["enable_thinking"] = req["enable_thinking"]
            if req.get("prompt_extend_mode"):
                parameters["prompt_extend_mode"] = req["prompt_extend_mode"]
    else:
        parameters = {"size": req.get("size", DEFAULT_SIZE)}
        parameters["prompt_extend"] = req.get("prompt_extend", True)
        parameters["n"] = req.get("n", 1)

    if req.get("negative_prompt"):
        parameters["negative_prompt"] = req["negative_prompt"]
    if req.get("seed") is not None:
        parameters["seed"] = req["seed"]

    return {
        "model": model,
        "input": {"messages": [{"role": "user", "content": content}]},
        "parameters": parameters,
    }


def build_i2i_payload(req: dict[str, Any], model: str, api_key: str) -> dict[str, Any]:
    """Build the DashScope request payload for wan2.5-i2i image-to-image generation."""
    prompt = req.get("prompt")
    if not prompt:
        raise ValueError("prompt is required")

    images = req.get("reference_images") or []
    if not images and req.get("reference_image"):
        images = [req["reference_image"]]
    if not images:
        raise ValueError(
            "wan2.5-i2i-preview requires at least one image via "
            "'reference_images' (array) or 'reference_image' (single)."
        )
    if len(images) > 3:
        raise ValueError("wan2.5-i2i-preview supports at most 3 images")

    resolved_images = [_resolve_file_url(str(img), api_key, model) for img in images]

    payload: dict[str, Any] = {
        "model": model,
        "input": {"prompt": prompt, "images": resolved_images},
        "parameters": {},
    }
    if req.get("negative_prompt"):
        payload["input"]["negative_prompt"] = req["negative_prompt"]

    params = payload["parameters"]
    params["n"] = req.get("n", 1)
    if req.get("size"):
        params["size"] = req["size"]
    params["prompt_extend"] = req.get("prompt_extend", True)
    params["watermark"] = req.get("watermark", False)
    if req.get("seed") is not None:
        params["seed"] = req["seed"]

    return payload


def build_t2i_payload(req: dict[str, Any], model: str) -> dict[str, Any]:
    """Build the DashScope request payload for Qwen text-to-image generation."""
    prompt = req.get("prompt")
    if not prompt:
        raise ValueError("prompt is required")

    if req.get("reference_images") or req.get("reference_image"):
        print(
            f"Warning: {model} does not support reference images for text-to-image. "
            "Images will be ignored. Use qwen-image-edit series for editing.",
            file=sys.stderr,
        )

    # Validate n parameter: qwen-image-plus/max only support n=1 (fixed)
    n_value = req.get("n", 1)
    if model in ("qwen-image-plus", "qwen-image-max") and n_value != 1:
        print(
            f"Warning: {model} only supports n=1 (fixed). Your value ({n_value}) will be ignored.",
            file=sys.stderr,
        )
        n_value = 1

    size = req.get("size", "1328*1328")
    if size not in _QWEN_T2I_VALID_SIZES:
        valid = ", ".join(sorted(_QWEN_T2I_VALID_SIZES))
        print(
            f"Warning: size '{size}' may not be valid for {model}. Valid sizes: {valid}",
            file=sys.stderr,
        )

    payload: dict[str, Any] = {
        "model": model,
        "input": {"prompt": prompt},
        "parameters": {
            "n": n_value,
            "size": size,
            "prompt_extend": req.get("prompt_extend", True),
            "watermark": req.get("watermark", False),
        },
    }
    if req.get("negative_prompt"):
        payload["input"]["negative_prompt"] = req["negative_prompt"]
    if req.get("seed") is not None:
        payload["parameters"]["seed"] = req["seed"]

    return payload

# ---------------------------------------------------------------------------
# Response extraction
# ---------------------------------------------------------------------------

def extract_image_urls(resp: dict[str, Any]) -> list[str]:
    """Extract all image URLs from all choices in the response."""
    output = resp.get("output") or {}
    choices = output.get("choices") or []
    if not choices:
        raise RuntimeError("No choices returned by DashScope")
    urls: list[str] = []
    for choice in choices:
        content = (choice.get("message") or {}).get("content") or []
        for item in content:
            if isinstance(item, dict) and item.get("image"):
                urls.append(item["image"])
    if not urls:
        raise RuntimeError("No image URL returned by DashScope")
    return urls


def extract_i2i_urls(resp: dict[str, Any]) -> list[str]:
    """Extract image URLs from output.results[].url format (i2i / t2i endpoints)."""
    output = resp.get("output") or {}
    results = output.get("results") or []
    urls = [r["url"] for r in results if isinstance(r, dict) and r.get("url")]
    if not urls:
        raise RuntimeError("No image URL returned by DashScope (i2i)")
    return urls


def extract_interleaved_content(resp: dict[str, Any]) -> list[dict[str, str]]:
    """Extract interleaved text and image content from response."""
    output = resp.get("output") or {}
    choices = output.get("choices") or []
    if not choices:
        raise RuntimeError("No choices returned by DashScope")
    content = (choices[0].get("message") or {}).get("content") or []
    result: list[dict[str, str]] = []
    for item in content:
        if isinstance(item, dict):
            if item.get("type") == "text" and item.get("text"):
                result.append({"type": "text", "text": item["text"]})
            elif item.get("type") == "image" and item.get("image"):
                result.append({"type": "image", "image": item["image"]})
            elif item.get("image"):
                result.append({"type": "image", "image": item["image"]})
            elif item.get("text"):
                result.append({"type": "text", "text": item["text"]})
    return result


def extract_usage(resp: dict[str, Any]) -> tuple[int | None, int | None]:
    """Extract image width and height from response usage field."""
    usage = resp.get("usage") or {}
    size_str = usage.get("size", "")
    if size_str and "*" in size_str:
        parts = size_str.split("*")
        if len(parts) == 2:
            try:
                return int(parts[0]), int(parts[1])
            except ValueError:
                pass
    return None, None
