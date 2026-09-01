# Request Fields by Mode

Detailed field tables for each video generation mode. The Mode Selection Guide and model tables are in SKILL.md. These fields are passed in the `input` and `parameters` sections of the API request.

## t2v (Text-to-Video)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Text description |
| `audio_url` | string | No | Custom audio URL/local path (wan2.5/2.6). Omit for auto-dubbing |
| `size` | string | No | e.g. `"1280*720"` (default), `"1920*1080"` |
| `duration` | int | No | 2–15 (wan2.6), 5/10 (wan2.5), 5 (others) |
| `shot_type` | string | No | `"multi"` for multi-shot (wan2.6 only, requires `prompt_extend: true`) |
| `prompt_extend` | bool | No | Smart prompt rewriting |
| `seed` | int | No | Reproducibility |

## i2v (Image-to-Video)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Text description |
| `img_url` / `reference_image` | string | Yes | First frame: URL, `oss://`, or local path (auto-uploaded) |
| `audio_url` | string | No | Custom audio URL/local path (wan2.5/2.6) |
| `resolution` | string | No | `"480P"`, `"720P"` (default), `"1080P"` |
| `duration` | int | No | 2–15 (wan2.6), 5/10 (wan2.5), 3–5 (2.1) |
| `shot_type` | string | No | `"multi"` for multi-shot (wan2.6) |
| `audio` | bool | No | Set `false` to force silent video (wan2.6-i2v-flash) |

## kf2v (First + Last Frame)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | No | Text description (recommended) |
| `first_frame_url` | string | Yes | First frame: URL/`oss://`/local path |
| `last_frame_url` | string | Yes* | Last frame (*not needed if using `template`) |
| `resolution` | string | No | `"480P"`, `"720P"` (default), `"1080P"` |

## r2v (Reference-based / Role-play)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Script using `character1`, `character2`, etc. |
| `reference_urls` | array | Yes | Up to 5 URLs (images or videos) |
| `size` | string | No | e.g. `"1280*720"` (default) |
| `duration` | int | No | 2–10 seconds |
| `shot_type` | string | No | `"multi"` (recommended) or `"single"` |
| `audio` | bool | No | `true` for audio (default). `false` for silent (wan2.6-r2v-flash). wan2.6-r2v always outputs audio. |

> **wan2.7-r2v** uses a different payload: `input.media=[{type,url}]` with up to 5 **mixed**
> references (`type` ∈ `reference_image`/`reference_video`/`reference_audio`), plus
> `resolution` (720P/1080P) + `duration` (≤10s) + `prompt_extend` + `watermark` (no `ratio`).
> `reference_urls=[...]` is still accepted (bare strings become `reference_image`). See
> [api-guide.md](api-guide.md) for verified examples. **PAYG-only.**

## wan3.0-video / wan3.0-video-prime (All-in-One t2v + i2v)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Text description |
| `img_url` / `reference_image` / `media` | string/array | No | Presence → **i2v** (`input.media=[{type:reference_image,url}]`); absence → **t2v** |
| `resolution` | string | No | `"480P"` / `"720P"` / `"1080P"` (default) |
| `ratio` | string | No | `adaptive` / `16:9` / `9:16` / `1:1` |
| `duration` | int | No | ≤30 seconds |

> **PAYG-only** — not available on Token Plan. Under Token Plan, pass references as URLs only.

## vace (Video Editing)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `function` | string | Yes | `"image_reference"` / `"video_repainting"` / `"video_edit"` / `"video_extension"` / `"video_outpainting"` |
| `prompt` | string | Yes* | Text description (*optional for some functions) |
| `ref_images_url` | array | * | 1–3 reference images (for `image_reference`) |
| `obj_or_bg` | array | * | `["obj","bg"]` per image (for `image_reference`) |
| `video_url` | string | * | Input video (for repainting, edit, outpainting) |
| `control_condition` | string | * | `posebodyface`/`posebody`/`depth`/`scribble` (for repainting) |
| `strength` | float | No | 0.0–1.0, fidelity to original (for repainting) |
| `mask_image_url` | string | * | Mask image, white=edit area (for edit) |
| `mask_frame_id` | integer | No | Which frame the mask corresponds to. **1-based** (use `1` for first frame, not `0`) |
| `first_clip_url` / `last_clip_url` | string | * | Input clip must be **≤3s** (for extension) |
| `top_scale`/`bottom_scale`/`left_scale`/`right_scale` | float | No | 1.0–2.0 (for outpainting) |
| `size` | string | No | e.g. `"1280*720"` (for image_reference) |

## Audio Handling

When the user mentions audio/voice/music/sound for video, clarify the source:

1. **Local audio file** → use `audio_url` with local path (script auto-uploads)
2. **Online audio URL** → use `audio_url` directly
3. **Auto-generated audio** → omit `audio_url` (wan2.5/2.6 auto-dubs)
4. **If unclear** → ask the user

**Audio support by mode:**
- **t2v**: wan2.6/2.5 support `audio_url` or auto-dubbing. Others silent only.
- **i2v**: wan2.6/2.5 support audio. wan2.6-i2v-flash can be forced silent with `audio: false`.
- **kf2v**: Silent only. For audio, switch to wan2.6-i2v or add post-generation — see [workflows.md](workflows.md).
- **r2v**: wan2.6-r2v supports audio. wan2.6-r2v-flash can be forced silent.
- **vace**: Silent only. Add audio post-generation — see [workflows.md](workflows.md).
- **happyhorse-1.1**: All modes (t2v/i2v/r2v) output **with audio** by default.
