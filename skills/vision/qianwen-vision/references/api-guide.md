# Qwen Vision — API Supplementary Guide

> **Content validity**: 2026-08 | **Sources**: [Vision API (OpenAI compatible)](https://platform.qianwenai.com/docs/developer-guides/multimodal/vision) · [Vision Best Practices](https://platform.qianwenai.com/docs/developer-guides/multimodal/vision)

---

## Definition

Qwen-VL vision-language models accessed through the **OpenAI-compatible** interface. Supports image and video analysis, Q&A, OCR text extraction, and structured information extraction. Features include multi-image comparison, multi-turn conversations, JSON Schema structured output, and function calling. Migration from OpenAI: update `base_url`, `api_key`, and `model`.

---

## Use Cases

| Scenario | Recommended Model | Notes |
|----------|------------------|-------|
| General image/video understanding | `qwen3.8-max` | Strongest flagship — 2.4T MoE, top-tier multimodal. Thinking on by default. 1M context. Highest cost. |
| General image/video understanding | `qwen3.7-plus` | **Preferred choice.** Next-gen multimodal vision-language, enhanced Agent execution & coding, GUI perception. 1M context. Thinking on by default. |
| General image/video understanding | `qwen3.6-plus` | Multimodal (text+image+video). Strong coding & universal recognition. 1M context. Thinking on by default. |
| General image/video understanding (alt) | `qwen3.5-plus` | Unified multimodal (text+image+video). Thinking on by default. 1M context. |
| High-perf cost-efficient vision | `qwen3.7-flash` | Surpasses qwen3.6-flash — enhanced universal recognition, Agent execution, vibe coding. Thinking on by default. 1M context. Best cost-efficiency. |
| Fast multimodal | `qwen3.5-flash` | Cheaper and faster. Thinking on by default. |
| High-precision localization / document parsing | `qwen3-vl-plus` | Best for 2D/3D object localization, agent tool calling, QwenVL HTML/Markdown parsing. |
| High throughput / low latency vision | `qwen3-vl-flash` | 33 languages. Tool calling. |
| Deep visual reasoning | `qvq-max` | Chain-of-thought reasoning. **Streaming output only.** |
| OCR text recognition | `qwen3.5-ocr` | Latest recommended OCR model. PDF parsing, multi-turn, ID/card enhanced. Also supports `qwen-vl-ocr`. See [ocr.md](ocr.md). |
| Chart / table extraction | `qwen3.8-max` / `qwen3.6-plus` / `qwen3-vl-plus` + JSON Schema | Structured output (non-thinking mode). |
| Video understanding | `qwen3.8-max` / `qwen3.7-flash` / `qwen3.6-plus` | Up to 2h video. Use `fps` to control frame extraction. |
| Video reasoning | `qvq-max` / `qwen3.8-max` / `qwen3.6-plus` | Chain-of-thought analysis of video content. QVQ: 2s-10min; Qwen3.8/3.7/3.6/3.5: up to 2h. |
| Agent tool calling | `qwen3.8-max` / `qwen3.7-flash` / `qwen3.6-plus` / `qwen3-vl-plus` / `qwen3-vl-flash` | Function calling support. |
| Multimodal Agent (Search/CI) | `qwen3.7-flash` / `qwen3.8-max` | Enhanced end-to-end agent execution. qwen3.7-flash: optimized for multimodal Agent scenarios. |

---

## Key Usage

### Image Understanding (OpenAI SDK)

```python
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

resp = client.chat.completions.create(
    model="qwen3-vl-plus",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What is in this image?"},
            {"type": "image_url", "image_url": {"url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241022/emyrja/dog_and_girl.jpeg"}}
        ]
    }],
)
print(resp.choices[0].message.content)
```

### Local Image (Base64)

```python
import base64

with open("local_image.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

resp = client.chat.completions.create(
    model="qwen3-vl-plus",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What is in this image?"},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
        ]
    }],
)
```

> The skill script accepts local file paths directly and auto-converts them to Base64 data URIs.

### Multi-image Comparison

```python
resp = client.chat.completions.create(
    model="qwen3-vl-plus",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Compare these two images."},
            {"type": "image_url", "image_url": {"url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241022/emyrja/dog_and_girl.jpeg"}},
            {"type": "image_url", "image_url": {"url": "https://img.alicdn.com/imgextra/i2/O1CN01ktT8451iQutqReELT_!!6000000004408-0-tps-689-487.jpg"}}
        ]
    }],
)
```

### Video Understanding (with fps)

```python
resp = client.chat.completions.create(
    model="qwen3.7-plus",
    messages=[{
        "role": "user",
        "content": [
            {"type": "video_url", "video_url": {"url": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/video.mp4"}, "fps": 2},
            {"type": "text", "text": "Describe what happens in this video."},
        ]
    }],
)
```

### Video from Image Frame List

Pass pre-extracted video frames as an image list. The `fps` parameter tells the model the time interval between frames (1 frame every 1/fps seconds).

```python
resp = client.chat.completions.create(
    model="qwen3.7-plus",
    messages=[{
        "role": "user",
        "content": [
            {"type": "video", "video": [
                "https://img.alicdn.com/imgextra/i1/NotRealJustExample/frame1.jpg",
                "https://img.alicdn.com/imgextra/i1/NotRealJustExample/frame2.jpg",
                "https://img.alicdn.com/imgextra/i1/NotRealJustExample/frame3.jpg",
                "https://img.alicdn.com/imgextra/i1/NotRealJustExample/frame4.jpg",
            ], "fps": 2},
            {"type": "text", "text": "Describe the action in this video."},
        ]
    }],
)
```

### Thinking Mode with Vision

Enable deep thinking for complex visual analysis (math problems, charts, multi-step reasoning). Streaming recommended.

```python
stream = client.chat.completions.create(
    model="qwen3.7-plus",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/chart.png"}},
            {"type": "text", "text": "Analyze the trends step by step."},
        ]
    }],
    stream=True,
    extra_body={"enable_thinking": True, "thinking_budget": 81920},
)
reasoning = ""
answer = ""
for chunk in stream:
    if not chunk.choices:
        continue
    delta = chunk.choices[0].delta
    if hasattr(delta, "reasoning_content") and delta.reasoning_content:
        reasoning += delta.reasoning_content
    if delta.content:
        answer += delta.content
```

### Video Reasoning (Thinking + Video)

Combine thinking mode with video input for step-by-step analysis of video content. Works with both `reason.py` (QVQ default) and `analyze.py` (with `enable_thinking`).

```python
stream = client.chat.completions.create(
    model="qvq-max",
    messages=[{
        "role": "user",
        "content": [
            {"type": "video_url", "video_url": {"url": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/clip.mp4"}, "fps": 2},
            {"type": "text", "text": "Analyze what happens in this video and explain why."},
        ]
    }],
    stream=True,
    stream_options={"include_usage": True},
)
```

**Script usage**:
```bash
python3 scripts/reason.py \
  --request '{"prompt":"Analyze this video step by step","video":"clip.mp4","fps":2}' \
  --print-response
```

### High-Resolution Mode

For images with fine text, small objects, or rich detail, enable `vl_high_resolution_images` to maximize the visual token budget (up to 16384 tokens per image).

```python
resp = client.chat.completions.create(
    model="qwen3.7-plus",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/fine-text.jpg"}},
            {"type": "text", "text": "Read all text in this image."},
        ]
    }],
    extra_body={"vl_high_resolution_images": True},
)
```

### Structured Output (JSON Schema)

The `analyze.py` script supports a `--schema` parameter to extract information from images as structured JSON:

```bash
python3 scripts/analyze.py \
  --request '{"prompt":"Extract invoice information","image":"invoice.jpg"}' \
  --schema '{"type":"object","properties":{"total":{"type":"string"},"date":{"type":"string"},"items":{"type":"array"}}}' \
  --print-response
```

### Streaming Output

```python
stream = client.chat.completions.create(
    model="qwen3-vl-plus",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Describe this image in detail."},
            {"type": "image_url", "image_url": {"url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241022/emyrja/dog_and_girl.jpeg"}}
        ]
    }],
    stream=True,
    stream_options={"include_usage": True},
)
for chunk in stream:
    if chunk.choices and chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### Key Parameters

| Parameter | Description |
|-----------|-------------|
| `model` | `qwen3.8-max` (strongest), `qwen3.7-plus` (preferred), `qwen3.7-flash` (cost-efficient), `qwen3.6-plus`, `qwen3.5-plus`, `qwen3.5-flash`, `qwen3-vl-plus`, `qwen3-vl-flash`, `qvq-max`, `qwen3.5-ocr`, `qwen-vl-ocr`. |
| `messages` | Multimodal message array. The `content` field mixes `text`, `image_url`, `video_url`, and `video` (image list) objects. |
| `temperature` | Controls randomness [0, 2). For precise extraction, use 0.1–0.2. |
| `max_tokens` | Maximum output tokens. |
| `detail` | Image detail level: `auto` (default), `low` (saves tokens), `high` (more detailed). |
| `fps` | Video frame extraction frequency. 1 frame every 1/fps seconds. Range [0.1, 10], default 2.0. Set on `video_url` or `video` content object. |
| `stream` | Enable streaming output. **Required for QVQ models.** Recommended for thinking mode. |
| `enable_thinking` | Enable chain-of-thought reasoning. Pass via `extra_body` (OpenAI SDK) or top-level (HTTP). See [visual-reasoning.md](visual-reasoning.md). |
| `thinking_budget` | Max tokens for reasoning process. Controls thinking depth and cost. Pass via `extra_body` (OpenAI SDK). |
| `vl_high_resolution_images` | Maximize image resolution (up to 16384 visual tokens). Pass via `extra_body` (OpenAI SDK). |
| `tools` | Function calling definitions. Supported by qwen3.8-max/flash, qwen3.7-plus/flash, qwen3.6-plus/flash, qwen3.5-plus/flash, qwen3-vl-plus/flash. |
| `min_pixels` / `max_pixels` | Pixel control for image resolution. Set inside `image_url` object. Active when `vl_high_resolution_images` is false/unset. |

### File Input Methods

The OpenAI-compatible API accepts: **HTTP/HTTPS URL**, **Base64 data URI**, and **`oss://` URL** (with `X-DashScope-OssResourceResolve: enable` header). Local paths are NOT directly accepted by the API.

**For files >= 7 MB: use a URL or `--upload-files`.** Base64 adds ~33% overhead; files >= 7 MB will exceed the 10 MB API limit. Small files (including short video clips < 7 MB) can use base64.

| Method | Format | Size Limit | Best For |
|--------|--------|-----------|----------|
| Online URL | `https://img.alicdn.com/imgextra/i1/NotRealJustExample/image.jpg` | 20 MB (Qwen3.8/3.7/3.6/3.5 & Qwen3-VL series) / 10 MB (others) for images; up to 2 GB for videos | **Videos, large images, production use** |
| Base64 data URI | `data:image/jpeg;base64,/9j/...` | < 7 MB original file only | Small local files (images, short video clips) |
| Temp upload (`oss://`) | `oss://dashscope-instant/...` | Up to 100 MB (local upload) | **Local videos, large local files** |

**Script behavior for local paths:**
- **Default**: auto-converts to Base64 data URI. Warns if file > 7 MB.
- **`--upload-files`**: uploads to DashScope temp storage → `oss://` URL. **Use this for any file >= 7 MB.**
- **[Temp Upload API docs](https://platform.qianwenai.com/docs/api-reference/more/upload-file-get-temporary-url)**: 48 h TTL, 100 QPS rate limit, same API key and model required for upload and inference.

---

## Important Notes

1. **Qwen3.8-Max is the strongest flagship.** `qwen3.8-max` is the most capable model — 2.4T MoE, top-tier multimodal. Use it for the most complex reasoning tasks. Higher cost.
2. **Qwen3.7-Plus is the preferred choice.** `qwen3.7-plus` is the recommended default — next-gen multimodal vision-language with enhanced Agent execution, coding, and GUI perception. Use `qwen3-vl-plus` when precise 2D/3D localization is needed.
3. **Qwen3.7-Flash is the best cost-efficient option.** `qwen3.7-flash` surpasses qwen3.6-flash across all multimodal dimensions — enhanced universal recognition, multimodal Agent (Search Agent, CI Agent), and vibe coding. 1M context, thinking on by default. Best for high-performance vision at lower cost.
4. **Larger images consume more tokens.** Use `detail: "low"` when fine detail is not needed. Use `vl_high_resolution_images: true` only for fine text or small objects.
5. **QVQ models support streaming output only.** `qvq-max` requires `stream=True`. Non-streaming calls will return an error.
6. **Structured output requires non-thinking mode.** JSON Schema output is only supported when `enable_thinking` is `false`. For Qwen3.8/Qwen3.7-flash/Qwen3.6/Qwen3.5 (thinking on by default), explicitly set `enable_thinking: false` when using structured output.
7. **Video fps parameter.** Use `fps` to control frame extraction frequency. High-speed motion: higher fps. Static/long videos: lower fps for efficiency.
8. **Use the dedicated model for OCR.** `qwen3.5-ocr` (default) is the latest recommended OCR model; `qwen-vl-ocr` is also available. Both achieve higher accuracy than general VL models for text recognition.
9. **Multi-turn conversations preserve context.** Alternate `user` and `assistant` roles in messages. The model remembers previously provided images.
10. **JSON structured extraction.** Use `json_mode` or `schema` to force the model to output JSON, suitable for automated pipelines.
11. **Video audio not supported.** Vision models do not understand audio from video files. For audio, use omni models.

---

## FAQ

**Q: Should I use qwen3.8-max, qwen3.7-plus, qwen3.7-flash, or qwen3-vl-plus?**
A: Use `qwen3.7-plus` as the default — it's the next-gen multimodal vision-language model with enhanced Agent execution, coding, and GUI perception. Use `qwen3.8-max` when you need the absolute strongest reasoning (higher cost). Use `qwen3.7-flash` when you want high-performance vision at lower cost — it surpasses qwen3.6-flash in all multimodal capabilities including Agent execution and vibe coding. Use `qwen3-vl-plus` when you need precise object localization (2D/3D bounding boxes), document parsing to QwenVL HTML/Markdown format, or agent tool calling with vision.

**Q: How do I reduce token consumption for image understanding?**
A: (1) Set `detail: "low"` to reduce image tokens. (2) Crop or resize the image to the relevant area. (3) Use the flash model. (4) Don't set `vl_high_resolution_images: true` unless needed.

**Q: Can I analyze multiple images at once?**
A: Yes. Pass multiple `image_url` objects in the `content` array, along with a text instruction (e.g., "Compare these images", "Find the differences").

**Q: How long a video can the model understand?**
A: Qwen3.8/Qwen3.7/Qwen3.6/Qwen3.5 supports up to 2 hours, Qwen3-VL-Plus up to 1 hour. Use `fps` to control frame extraction. Lower fps for long videos. Videos are frame-sampled; audio is not supported.

**Q: How do I extract table data from an image?**
A: Use `qwen3.7-plus` (with `enable_thinking: false`) or `qwen3-vl-plus` with JSON Schema structured output. The skill script supports `--schema`.

**Q: How do I use local images/videos?**
A: Pass the file path directly (`"image": "/path/to/file.jpg"`). By default the script converts to Base64 — this only works for files **< 7 MB**. For larger files or videos, **always** add `--upload-files` to auto-upload to DashScope temp storage (oss:// URL, 48 h TTL). When using the OpenAI SDK directly, upload the file to get a URL first — do NOT base64-encode large files.

**Q: When should I enable thinking mode?**
A: Enable for complex tasks: math problems, chart analysis, multi-step reasoning. Don't enable for simple tasks (captioning, basic Q&A) — it increases latency and cost. Qwen3.8/Qwen3.7-flash/Qwen3.6/Qwen3.5 has thinking on by default; disable with `enable_thinking: false` for simple tasks.
