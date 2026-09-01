# Qwen Video Generation (Wan / HappyHorse) — API Supplementary Guide

> **Content validity**: 2026-08 | **Sources**: [Overview](https://platform.qianwenai.com/docs/developer-guides/getting-started/video-models) · [T2V API](https://platform.qianwenai.com/docs/api-reference/video-generation/wan-text-to-video/create-task) · [I2V API](https://platform.qianwenai.com/docs/api-reference/video-generation/wan-image-to-video-first-frame/create-task) · [T2V Guide](https://platform.qianwenai.com/docs/developer-guides/video-generation/text-to-video) · [I2V Guide](https://platform.qianwenai.com/docs/developer-guides/video-generation/image-to-video) · [KF2V Guide](https://platform.qianwenai.com/docs/developer-guides/video-generation/image-to-video-first-last) · [R2V Guide](https://platform.qianwenai.com/docs/developer-guides/video-generation/reference-video) · [VACE Guide](https://platform.qianwenai.com/docs/developer-guides/video-generation/video-editing)

---

## Definition

Video generation service based on the Wan model family and HappyHorse. Supports **5 creation modes**: text-to-video (t2v), image-to-video (i2v), first+last frame interpolation (kf2v), reference-based video (r2v), and video editing (vace). All tasks use **asynchronous invocation** (submit task → poll result). wan2.6 series supports **automatic dubbing and multi-shot narrative**.

---

## Use Cases

| Scenario | Recommended Mode + Model | Notes |
|----------|------------------------|-------|
| Generate video from text description | t2v + `happyhorse-1.1-t2v` | Audio output, TP+PAYG, 3–15s, 720P/1080P. For multi-shot use `--model wan2.6-t2v`. |
| Animate a still image | i2v + `happyhorse-1.1-i2v` | Audio output, TP+PAYG, 3–15s. Uses `media=[{type:'first_frame',url}]`. |
| Transition animation between two images | kf2v + `wan2.2-kf2v-flash` | First+last frame control, 5s, silent. |
| Maintain character consistency across scenes | r2v + `happyhorse-1.1-r2v` | TP+PAYG, up to 9 refs. `wan2.6-r2v` for multi-shot quality. |
| Style transfer / local editing / extension | vace + `wanx2.1-vace-plus` | Repainting, mask editing, extension, outpainting. |
| Cinematic multi-shot narrative | t2v/i2v + `shot_type: "multi"` | Multiple camera angles and scenes in a single generation. |
| Custom background music | t2v/i2v + `audio_url` | Provide an audio file for synchronized generation. |

---

## Key Usage

### Asynchronous Invocation Workflow

All video APIs use asynchronous invocation: **Step 1: Submit task** → receive task_id → **Step 2: Poll** → retrieve video URL.

```bash
# Step 1: Submit
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
  -H 'X-DashScope-Async: enable' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"wan2.6-t2v","input":{"prompt":"A kitten running in the moonlight"},"parameters":{"size":"1280*720","duration":5}}'

# Step 2: Poll (using the returned task_id)
curl -sS "https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY"
```

Typical processing time: 1–5 minutes (depending on model, duration, and resolution).

### Multi-shot Narrative (wan2.6 only)

```bash
curl -sS '...' -d '{
    "model": "wan2.6-t2v",
    "input": {"prompt": "Shot 1 [0-3s]: A detective walks briskly through a rainy street. Shot 2 [3-5s]: The detective pushes open a heavy door and finds a clue."},
    "parameters": {"size":"1280*720", "duration":5, "shot_type":"multi", "prompt_extend":true}
}'
```

**Requirement**: `shot_type: "multi"` must be used together with `prompt_extend: true`.

### Custom Audio

```json
{
    "model": "wan2.6-t2v",
    "input": {
        "prompt": "A musician playing guitar on a moonlit beach",
        "audio_url": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/bgm.mp3"
    },
    "parameters": {"size": "1280*720", "duration": 10}
}
```

Audio format: WAV or MP3, 3–30s duration, ≤15MB file size. If the audio is longer than the video `duration`, it is truncated. If shorter, the remaining video portion is silent. Omitting `audio_url` enables automatic dubbing.

### Mode Quick Reference

| Mode | Required Fields | Audio Support | Duration Limit |
|------|----------------|---------------|---------------|
| **t2v** | `prompt` | wan2.6/2.5: auto or custom | 2–15s (wan2.6), 5/10s (wan2.5) |
| **i2v** | `prompt` + `img_url` | Same as above | 2–15s (wan2.6), 5/10s (wan2.5) |
| **kf2v** | `first_frame_url` + `last_frame_url` | None (silent) | Fixed 5s |
| **r2v** | `prompt` + `reference_urls` | wan2.6: yes | 2–10s |
| **vace** | `function` + function-specific params | None (silent) | ≤5s |

### Key Parameters

| Parameter | Description |
|-----------|-------------|
| `model` | Model ID (e.g., `happyhorse-1.1-t2v`). |
| `prompt` | Text description. wan2.6/2.5: max 1,500 characters. wan2.2/2.1: max 800 characters. |
| `negative_prompt` | Content to exclude. Max 500 characters. |
| `size` | Resolution as width*height, e.g., `1280*720`. Used by t2v and r2v. |
| `resolution` | Resolution level: `480P`, `720P`, `1080P`. Used by i2v and kf2v. |
| `duration` | Video duration in seconds. |
| `prompt_extend` | Enable LLM prompt rewriting. |
| `shot_type` | Set to `"multi"` for multi-shot narrative (wan2.6 only). |
| `audio_url` | Custom audio file URL (wan2.6/2.5 only). WAV/MP3, 3–30s, ≤15MB. |
| `seed` | Random seed for reproducibility. |

### Required HTTP Headers

```
X-DashScope-Async: enable    # Required; omitting returns an error
Authorization: Bearer $KEY
Content-Type: application/json
```

---

## Important Notes

1. **All calls are asynchronous.** HTTP requests must include `X-DashScope-Async: enable`. Omitting it returns "current user api does not support synchronous calls".
2. **Video URLs are valid for 24 hours.** Download immediately after generation. The task_id is also valid for 24 hours.
3. **kf2v and vace produce silent video only.** For audio, switch to wan2.6-t2v/i2v (which support auto-dubbing), or add audio post-generation (see [merge-media.md](merge-media.md)).
4. **`size` vs. `resolution`.** t2v and r2v use `size` (e.g., `"1280*720"`). i2v and kf2v use `resolution` (e.g., `"720P"`). Do not mix them.
5. **Multi-shot requires both parameters.** `shot_type: "multi"` and `prompt_extend: true` must both be set.
6. **VACE segments are limited to ≤5s.** For longer videos, chain multiple generations (extension → concatenation). `video_extension` input clips must be ≤3s.
7. **Billed per second of video.** Price varies by resolution — check the [official pricing page](https://platform.qianwenai.com/docs/developer-guides/getting-started/pricing) for exact per-resolution rates. **Do not guess or estimate the ratio.** Controlling duration and resolution reduces costs.
8. **Inform users of expected wait time before submitting.** Typical: 1–5 minutes. Complex tasks (1080P + multi-shot + 15s) can take up to 10 minutes.

---

## FAQ

**Q: When should I use kf2v instead of i2v?**
A: kf2v controls both the first and last frame of the video (transition effect). i2v controls only the first frame. However, kf2v has more limitations (5s max, silent only). If you only need first-frame control and want audio or longer duration, i2v is more suitable.

**Q: How do I generate videos longer than 15s?**
A: Chain multiple generations — use the last frame or tail clip of one segment as input for the next. After generating all segments, concatenate them (see [merge-media.md](merge-media.md)). wan2.6-t2v supports up to 15s per segment.

**Q: What if auto-dubbing quality is poor?**
A: (1) Provide a high-quality custom audio file via `audio_url`. (2) Use the qianwen-audio-tts skill to generate speech narration first, then pass it as `audio_url`.

**Q: How do I maintain character consistency in r2v?**
A: Provide character reference images/videos in `reference_urls` (up to 5 total, max 3 videos). Use `character1`, `character2`, etc. in the prompt to reference them. Recommended: combine with `shot_type: "multi"` for multi-shot generation.

**Q: A task timed out but may still be running. What do I do?**
A: The task may still be executing on the server. Use `--task-id {id} --poll-once` to check the status. The task_id remains valid for 24 hours.

**Q: What does each VACE function do?**
A: `image_reference` = generate video from reference images. `video_repainting` = full-video style transfer. `video_edit` = mask-based local editing. `video_extension` = extend/continue a video. `video_outpainting` = expand the frame outward.

---

## HappyHorse 1.1 vs 1.0 Differences

HappyHorse 1.1 series (`happyhorse-1.1-t2v`, `happyhorse-1.1-i2v`, `happyhorse-1.1-r2v`) use the same API structure as their 1.0 counterparts with key improvements:

| Aspect | HappyHorse 1.0 | HappyHorse 1.1 |
|--------|----------------|----------------|
| Duration | 3–15s | 3–15s (same) |
| Audio | **With audio** (auto-generated) | **With audio** (auto-generated) |
| Resolution | 720P/1080P | 720P/1080P |
| Payload | Same as 1.1 | Same as 1.0 |

The request structure is **identical** — only the `model` field changes. Existing payloads for `happyhorse-1.0-*` work with `happyhorse-1.1-*` by changing the model ID.

```bash
# HappyHorse 1.1 T2V (with audio)
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
  -H 'X-DashScope-Async: enable' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "happyhorse-1.1-t2v",
    "input": {"prompt": "A cardboard city comes alive at night with tiny trains and twinkling lights"},
    "parameters": {"resolution": "720P", "ratio": "16:9", "duration": 5}
  }'
```

---

## wan2.7-r2v / wan3.0-video / wan3.0-video-prime (verified contracts)

> **Content validity**: 2026-08-27, real-call verified (`tmp/test-new-models/`). Sources:
> [wan2.7-r2v](https://www.qianwenai.com/models/wan2.7-r2v) ·
> [wan3.0-video](https://www.qianwenai.com/models/wan3.0-video) ·
> [wan3.0-video-prime](https://www.qianwenai.com/models/wan3.0-video-prime)
>
> **PAYG-only** — these three models are **not available on Token Plan**. All share the same
> endpoint (`/services/aigc/video-generation/video-synthesis`) and async submit→poll workflow
> as the other Wan models. Under Token Plan (if attempted), local upload is unsupported — pass
> references as `https://` or `oss://` URLs only.

### wan2.7-r2v (multi-reference role-play)

`input.media` accepts up to **5 mixed** references; `type` ∈ `reference_image` /
`reference_video` / `reference_audio`. No `ratio` (auto-derived from references), no `fps`.

```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
  -H 'X-DashScope-Async: enable' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'X-DashScope-OssResourceResolve: enable' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "wan2.7-r2v",
    "input": {
      "prompt": "The character in the image is walking along a sunlit beach, hair blowing in the wind.",
      "media": [
        {"type": "reference_image", "url": "oss://.../ref.png"},
        {"type": "reference_video", "url": "https://.../clip.mp4"}
      ]
    },
    "parameters": {"resolution": "720P", "duration": 5, "prompt_extend": false, "watermark": true}
  }'
```

| Parameter | Values | Notes |
|-----------|--------|-------|
| `resolution` | `720P` / `1080P` | Default `720P`. Minimum 720P (no 480P). |
| `duration` | ≤10 (seconds) | |
| `prompt_extend` | bool | Optional. |
| `watermark` | bool | Optional. |

### wan3.0-video / wan3.0-video-prime (all-in-one t2v + i2v)

Unified model: **t2v** = `input.prompt` only (no `media`); **i2v** =
`input.media=[{type:reference_image, url}]`. `wan3.0-video-prime` is the higher-quality
variant using the identical payload.

```bash
# t2v (no media)
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
  -H 'X-DashScope-Async: enable' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "wan3.0-video",
    "input": {"prompt": "A small cat running on a rooftop under moonlight, cinematic quality."},
    "parameters": {"resolution": "480P", "ratio": "16:9", "duration": 5}
  }'

# i2v (reference image via media)
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis' \
  -H 'X-DashScope-Async: enable' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'X-DashScope-OssResourceResolve: enable' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "wan3.0-video-prime",
    "input": {
      "prompt": "The character in the image is walking in a garden, cinematic quality.",
      "media": [{"type": "reference_image", "url": "https://.../portrait.png"}]
    },
    "parameters": {"resolution": "480P", "ratio": "1:1", "duration": 5}
  }'
```

| Parameter | Values | Notes |
|-----------|--------|-------|
| `resolution` | `480P` / `720P` / `1080P` | Default `1080P`. |
| `ratio` | `adaptive` / `16:9` / `9:16` / `1:1` | Optional. |
| `duration` | ≤30 (seconds) | Longer than wan2.7-r2v (≤10s). |

The script auto-detects t2v vs i2v by whether a reference image (`img_url` /
`reference_image` / `media`) is present, so no `--mode` flag is required.
