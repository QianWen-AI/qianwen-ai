# Qwen Image Generation — API Supplementary Guide

> **Content validity**: 2026-07 | **Sources**: [Text-to-Image API](https://platform.qianwenai.com/docs/developer-guides/image-generation/text-to-image) · [Image Generation Guide](https://platform.qianwenai.com/docs/developer-guides/getting-started/image-models) · [Wan2.6-Image API](https://platform.qianwenai.com/docs/api-reference/image-generation/wan26-image-gen-edit/create-task) · [Z-Image-Turbo](https://www.qianwenai.com/models/z-image-turbo)

---

## Definition

Generate and edit images using Wan and Qwen-Image models. The Wan series excels at realistic photography and diverse artistic styles. The Qwen-Image series excels at rendering complex Chinese and English text (posters, layouts). **wan2.7-image-pro / wan2.7-image are multi-function models** supporting text-to-image, image editing (0–9 references), sequential multi-image, interactive editing, and thinking mode. **wan2.6-t2i supports synchronous HTTP calls** for text-to-image. **wan2.6-image supports image editing, style transfer, subject consistency, and interleaved text-image output.** Older models use asynchronous invocation (submit task → poll result).

---

## Use Cases

| Scenario | Recommended Model | Notes |
|----------|------------------|-------|
| General creative / realistic photography | `wan2.7-image` / `wan2.7-image-pro` | Recommended default. Multi-function: t2i + editing, thinking mode, 4K (pro). |
| General creative (dedicated t2i) | `wan2.6-t2i` | Dedicated t2i model, best quality, supports synchronous calls. |
| Posters / complex text rendering | `qwen-image-2.0-pro` or `wan2.6-t2i` | Strongest Chinese/English text rendering. `qwen-image-2.0-pro-2026-06-22`: supports 1k token instructions, enhanced rendering. |
| Fast drafts / batch generation | `wan2.2-t2i-flash` | Lowest latency. |
| Custom resolutions | `qwen-image-2.0` or Wan series | Flexible aspect ratios. |
| Image editing / style transfer | `wan2.7-image-pro` / `wan2.7-image` / `wan2.6-image` | wan2.7: 0–9 images, bbox editing, thinking mode. wan2.6: 1–4 images. |
| Text editing in images / element manipulation | `qwen-image-edit-max` or `qwen-image-2.0-pro` | Precise text modification, element add/delete/replace. |
| Subject consistency across images | `wan2.7-image-pro` / `wan2.7-image` / `wan2.6-image` | Maintain subject identity across generated images. |
| Multi-image composition | `wan2.7-image-pro` / `wan2.7-image` / `wan2.6-image` | Combine style from one image with background from another. |
| Sequential multi-image (same character/story) | `wan2.7-image-pro` / `wan2.7-image` | Coherent image sequences (1–12 images), same subject across scenes. |
| Interactive editing (region-based) | `wan2.7-image-pro` / `wan2.7-image` | Use `bbox_list` for precise region editing. |
| Multi-image fusion with text rendering | `qwen-image-2.0-pro` | 1–3 input images, text rendering, realistic textures. |
| Interleaved text-image output | `wan2.6-image` | Generate mixed text+image content (tutorials, guides). |
| Fixed-resolution batch text-to-image | `qwen-image-plus` | 5 fixed resolutions, async API, good for batch workflows. |

---

## Key Usage

### Synchronous Call (wan2.7, recommended)

Returns the result in a single request. Suitable for most scenarios.

```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "wan2.7-image",
    "input": {
        "messages": [{"role": "user", "content": [{"text": "A cozy flower shop with wooden door and flowers on display"}]}]
    },
    "parameters": {"size": "1280*1280", "n": 1, "prompt_extend": true}
}'
```

The image URL is at `output.choices[0].message.content[0].image` in the response.

### Asynchronous Call (qwen-image-plus, older Wan models)

```python
from dashscope import ImageSynthesis
import dashscope, os

dashscope.base_http_api_url = 'https://dashscope.aliyuncs.com/api/v1'
rsp = ImageSynthesis.call(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    model="qwen-image-plus",
    prompt="A healing-style hand-drawn poster featuring three puppies playing with a ball on green grass",
    n=1, size='1664*928', prompt_extend=True, watermark=False,
)
print(rsp.output.results[0].url)  # Image URL, valid for 24 hours
```

### Key Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `size` | `1280*1280` | Resolution as width*height. Total pixels must be between 1280×1280 and 1440×1440. Aspect ratio must be between 1:4 and 4:1. |
| `n` | 4 | Number of images to generate (1–4). **Billed per image.** Set to 1 for testing. |
| `prompt_extend` | true | LLM rewrites the prompt. Significantly improves results for short prompts but adds 3–4 seconds of latency. |
| `negative_prompt` | — | Content to exclude from the image. Max 500 characters. |
| `watermark` | false | Adds an "AI-generated" watermark in the lower-right corner. |
| `seed` | random | Fixed seed produces more consistent results (not guaranteed identical). Range: [0, 2147483647]. |

### Common Resolutions

| Aspect Ratio | Size |
|-------------|------|
| 1:1 | 1280×1280 |
| 4:3 | 1472×1104 |
| 3:4 | 1104×1472 |
| 16:9 | 1696×960 |
| 9:16 | 960×1696 |

---

## wan2.6-image — Image Editing & Interleaved Output

### Overview

The `wan2.6-image` model operates in two modes controlled by the `enable_interleave` parameter:

- **Image editing mode** (`enable_interleave=false`, default): Takes 1–4 reference images + text prompt. Performs style transfer, subject consistency, composition, and image editing.
- **Interleaved text-image mode** (`enable_interleave=true`): Takes 0–1 reference image + text prompt. Generates mixed text and image content (e.g., tutorials, step-by-step guides).

### Endpoints

Same as other Wan models:
- **Sync**: `POST /api/v1/services/aigc/multimodal-generation/generation` (editing mode only; interleave requires streaming or async)
- **Async**: `POST /api/v1/services/aigc/image-generation/generation` with `X-DashScope-Async: enable`

### Image Editing Mode Examples

**Style transfer** (single reference):
```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "wan2.6-image",
    "input": {
        "messages": [{"role": "user", "content": [
            {"text": "Convert this photo to a watercolor painting style"},
            {"image": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/photo.jpg"}
        ]}]
    },
    "parameters": {"size": "1K", "n": 1, "prompt_extend": true, "watermark": false, "enable_interleave": false}
  }'
```

**Multi-image composition** (style from image 1 + background from image 2):
```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "wan2.6-image",
    "input": {
        "messages": [{"role": "user", "content": [
            {"text": "Generate a sunset scene based on the style of image 1 and the background of image 2"},
            {"image": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/style_ref.jpg"},
            {"image": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/background_ref.jpg"}
        ]}]
    },
    "parameters": {"size": "1K", "n": 1, "prompt_extend": true, "enable_interleave": false}
  }'
```

### Interleaved Text-Image Output Example (async)

```bash
# Step 1: Submit task
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'X-DashScope-Async: enable' \
  -d '{
    "model": "wan2.6-image",
    "input": {
        "messages": [{"role": "user", "content": [
            {"text": "Give me a three-image tutorial for making latte art"}
        ]}]
    },
    "parameters": {"enable_interleave": true, "max_images": 3, "size": "1280*1280"}
  }'

# Step 2: Poll with task_id (repeat every 10s)
curl -sS "https://dashscope.aliyuncs.com/api/v1/tasks/TASK_ID" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY"
```

The response contains interleaved `{type: "text", text: "..."}` and `{type: "image", image: "URL"}` content items in `output.choices[0].message.content`.

### Parameters (wan2.6-image)

| Parameter | Default | Editing Mode | Interleave Mode | Description |
|-----------|---------|:---:|:---:|-------------|
| `enable_interleave` | false | false | **true** | Switches between image editing and interleaved output modes |
| `size` | `1K` | `1K`/`2K` or `W*H` (total px [768², 2048²]) | `W*H` (total px [768², 1280²]) | Output resolution |
| `n` | 4 (editing) / 1 (interleave) | 1–4 | Must be 1 | Number of output images. **Billed per image.** |
| `max_images` | 5 | — | 1–5 | Max images in interleaved output. **Billed per image.** |
| `prompt_extend` | true | Yes | — | Intelligent prompt rewriting (editing mode only) |
| `negative_prompt` | — | Yes | Yes | Content to exclude |
| `watermark` | false | Yes | Yes | "AI Generated" watermark |
| `seed` | random | Yes | Yes | Reproducibility seed [0, 2147483647] |

### Input Image Constraints

- Formats: JPEG, JPG, PNG (no alpha), BMP, WEBP
- Resolution: 240–8000px per dimension
- Max file size: 10MB per image
- Editing mode: **1–4** images required
- Interleave mode: **0–1** image (optional)

### Size Reference for wan2.6-image

In **editing mode** (`enable_interleave=false`): use `1K` (default, ~1280×1280) or `2K` (~2048×2048), or specify pixel dimensions with total pixels in [768×768, 2048×2048].

In **interleave mode** (`enable_interleave=true`): use pixel dimensions with total pixels in [768×768, 1280×1280].

| Aspect Ratio | Size |
|-------------|------|
| 1:1 | 1280*1280 |
| 2:3 | 800*1200 |
| 3:2 | 1200*800 |
| 3:4 | 960*1280 |
| 4:3 | 1280*960 |
| 9:16 | 720*1280 |
| 16:9 | 1280*720 |

---

## wan2.7-image-pro / wan2.7-image — Multi-function Image Generation & Editing

### Overview

The `wan2.7-image-pro` and `wan2.7-image` models are multi-function models that support **both text-to-image and image editing** in a single model. No reference images are required for text-to-image, and up to 9 reference images are supported for editing.

**Key capabilities:**
- **Text-to-image** (no reference images needed) with optional thinking mode
- **Sequential multi-image** (`enable_sequential=true`): generate coherent image sequences (1–12 images)
- **Image editing** with 0–9 reference images
- **Interactive editing** via `bbox_list` for precise region-based editing
- **Color palette** customization (3–10 colors)

**wan2.7-image-pro vs wan2.7-image:**
- `wan2.7-image-pro`: supports 4K resolution for t2i, higher quality. See [model details](https://www.qianwenai.com/models/wan2.7-image-pro).
- `wan2.7-image`: max 2K resolution, faster. See [model details](https://www.qianwenai.com/models/wan2.7-image).

### Endpoint

Same as wan2.6 series:
- **Sync**: `POST /api/v1/services/aigc/multimodal-generation/generation`

### Text-to-Image Example (thinking mode)

```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "wan2.7-image-pro",
    "input": {
        "messages": [{"role": "user", "content": [{"text": "A cozy flower shop with delicate wooden door and morning sunlight"}]}]
    },
    "parameters": {"size": "4K", "n": 1, "thinking_mode": true, "watermark": false}
  }'
```

### Sequential Multi-Image Example

```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "wan2.7-image-pro",
    "input": {
        "messages": [{"role": "user", "content": [{"text": "A stray orange cat through four seasons: spring cherry blossoms, summer beach, autumn leaves, winter snow"}]}]
    },
    "parameters": {"size": "2K", "enable_sequential": true, "n": 4, "watermark": false}
  }'
```

### Image Editing Example (multi-reference)

```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "wan2.7-image-pro",
    "input": {
        "messages": [{"role": "user", "content": [
            {"text": "Apply the graffiti pattern from image 2 onto the car body in image 1"},
            {"image": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/car.jpg"},
            {"image": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/graffiti.jpg"}
        ]}]
    },
    "parameters": {"size": "2K", "n": 1, "watermark": false}
  }'
```

### Interactive Editing Example (bbox)

```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "wan2.7-image-pro",
    "input": {
        "messages": [{"role": "user", "content": [
            {"text": "Place the clock from image 1 at the marked location in image 2"},
            {"image": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/clock.jpg"},
            {"image": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/room.jpg"}
        ]}]
    },
    "parameters": {"size": "2K", "n": 1, "bbox_list": [[], [[989,515,1138,681]]], "watermark": false}
  }'
```

### Parameters (wan2.7-image-pro / wan2.7-image)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `size` | `2K` | Resolution: `1K`, `2K` (default), `4K` (pro only, t2i mode). Or pixel dimensions. |
| `n` | 4 (non-seq) / 12 (seq) | Number of images. Non-sequential: 1–4. Sequential: 1–12. **Billed per image.** |
| `thinking_mode` | true | Enhanced reasoning for better quality. Only for t2i (no images, non-sequential). Increases latency. |
| `enable_sequential` | false | Sequential multi-image mode: coherent image sequences (e.g., same character across scenes). |
| `reference_images` | — | 0–9 image URLs for editing. Not required for t2i. |
| `bbox_list` | — | Interactive editing regions. Format: `[[[x1,y1,x2,y2],...], ...]`. List length = image count. Empty `[]` for images without edits. |
| `color_palette` | — | Custom color theme (3–10 colors). Each: `{"hex":"#C2D1E6","ratio":"23.51%"}`. Sum of ratios = 100%. Non-sequential mode only. |
| `negative_prompt` | — | Content to exclude. Max 500 chars. |
| `watermark` | false | "AI Generated" watermark. |
| `seed` | random | Reproducibility seed [0, 2147483647]. |

### Input Image Constraints

- Formats: JPEG, JPG, PNG (no alpha), BMP, WEBP
- Resolution: 240–8000px per dimension
- Max file size: 10MB per image
- Max 9 images per request

---

## wan2.5-i2i-preview — General Image Editing

### Overview

The `wan2.5-i2i-preview` model provides image-to-image editing via a simpler prompt+images API. It preserves subject consistency during edits and supports multi-image fusion with up to 3 reference images.

**Key differences from `wan2.6-image`:**

- Uses `input.prompt` + `input.images[]` format (not messages)
- **Async-only** (no sync support)
- Dedicated endpoint: `/api/v1/services/aigc/image2image/image-synthesis`
- Max 3 images (vs wan2.6-image's 4)
- Max output resolution: 1280*1280 total pixels (vs wan2.6-image's 2048*2048)
- Response uses `output.results[].url` format (vs choices format)
- China (`cn-beijing`) only

### Endpoint

**Async only:**

- China (Beijing): `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis`

### Single-Image Editing Example

```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'X-DashScope-Async: enable' \
  -d '{
    "model": "wan2.5-i2i-preview",
    "input": {
        "prompt": "Change the floral dress to a vintage-style lace long dress",
        "images": ["https://img.alicdn.com/imgextra/i3/O1CN0157XGE51l6iL9441yX_!!6000000004770-49-tps-1104-1472.webp"]
    },
    "parameters": {"prompt_extend": true, "n": 1}
  }'
```

### Multi-Image Fusion Example

```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'X-DashScope-Async: enable' \
  -d '{
    "model": "wan2.5-i2i-preview",
    "input": {
        "prompt": "Place the alarm clock from Image 1 next to the vase on the dining table in Image 2",
        "images": [
            "https://img.alicdn.com/imgextra/i3/O1CN0157XGE51l6iL9441yX_!!6000000004770-49-tps-1104-1472.webp",
            "https://img.alicdn.com/imgextra/i3/O1CN01SfG4J41UYn9WNt4X1_!!6000000002530-49-tps-1696-960.webp"
        ]
    },
    "parameters": {"prompt_extend": true, "n": 1}
  }'
```

Then poll with `GET /api/v1/tasks/{task_id}`. Response contains `output.results[].url`.

### Parameters (wan2.5-i2i-preview)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `prompt` | — | **Required.** Text instruction for the edit. |
| `images` | — | **Required.** Array of 1–3 image URLs. Array order = image numbering in prompt. |
| `negative_prompt` | — | Content to exclude. Max 500 chars. |
| `size` | auto (1280*1280 px) | Output resolution. Total pixels [768*768, 1280*1280], aspect ratio [1:4, 4:1]. |
| `n` | 4 | Number of images (1–4). **Billed per image.** Set to 1 for testing. |
| `prompt_extend` | true | Smart prompt rewriting. |
| `watermark` | false | "AI Generated" watermark. |
| `seed` | random | Reproducibility. If n>1, images use seed, seed+1, seed+2, etc. |

### Input Image Constraints

- Formats: JPEG, JPG, PNG (alpha ignored), BMP, WEBP
- Resolution: 384–5000px per dimension
- Max file size: 10MB per image
- Max 3 images per request

---

## Qwen Image Series

### Overview

The Qwen Image series consists of two sub-families with **different API endpoints**:

- **Editing models** (`qwen-image-2.0-pro`, `qwen-image-2.0`, `qwen-image-edit-max/plus/edit`): Use the same `multimodal-generation/generation` endpoint as `wan2.6-image`. Support image editing with 1–3 reference images, and `qwen-image-2.0-pro/2.0` also support pure text-to-image.
- **Text-to-image models** (`qwen-image-plus`, `qwen-image-max`): Use the `text2image/image-synthesis` endpoint (async-only). Fixed resolutions, `input.prompt` format.

### Editing Models — Endpoint & Parameters

**Endpoint**: Same as wan2.6-image — `POST /api/v1/services/aigc/multimodal-generation/generation`

**Payload format**: `messages` with `image` + `text` content items (same as wan2.6-image).

```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen-image-2.0-pro",
    "input": {
        "messages": [{"role": "user", "content": [
            {"image": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250925/thtclx/input1.png"},
            {"image": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250925/iclsnx/input2.png"},
            {"text": "Make the girl from Image 1 wear the black dress from Image 2"}
        ]}]
    },
    "parameters": {"n": 2, "size": "1024*1536", "prompt_extend": true, "watermark": false}
  }'
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `n` | 1 | Output images: 1–6 (`qwen-image-edit`: 1 only). **Billed per image.** |
| `size` | `1024*1024` | width\*height. Total pixels 512×512–2048×2048. |
| `prompt_extend` | true | Intelligent prompt rewriting. |
| `watermark` | false | "AI Generated" watermark. |
| `negative_prompt` | — | Content to exclude. |
| `seed` | random | Reproducibility seed [0, 2147483647]. |

**Input image constraints**: JPG, JPEG, PNG, BMP, TIFF, WEBP, GIF. 384–3072px per dimension. ≤10MB per image. Max 3 images.

**Key differences from `wan2.6-image`**:
- Max 3 input images (vs wan2.6-image's 4)
- `n` supports up to 6 (vs wan2.6-image's 4)
- Does **NOT** support `enable_interleave`
- `qwen-image-2.0-pro` and `qwen-image-2.0` can also do pure text-to-image (text-only message, no reference images)

### qwen-image-3.0-pro / qwen-image-3.0

**Overview**: The 3.0 series is the latest Qwen-Image generation. It shares the same `messages` payload and sync endpoint as the 2.0/edit models but adds three exclusive parameters (`enable_thinking`, `prompt_extend_mode`) and a smarter resolution behavior (`size` has **no default** — the model auto-recommends resolution from the prompt). `qwen-image-3.0-pro` is the flagship; `qwen-image-3.0` is the general-purpose tier. Both support pure text-to-image and 1–3 reference-image editing.

**Endpoints** (same request body; only the header/URL differ):
- **Sync**: `POST /api/v1/services/aigc/multimodal-generation/generation` (shared with 2.0 series)
- **Async**: `POST /api/v1/services/aigc/image-generation/generation` with `X-DashScope-Async: enable`, then poll `GET /api/v1/tasks/{task_id}`

```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen-image-3.0-pro",
    "input": {
        "messages": [{"role": "user", "content": [{"text": "A healing-style poster: three puppies playing on lush green grass"}]}]
    },
    "parameters": {"prompt_extend": true, "prompt_extend_mode": "agent", "enable_thinking": true}
  }'
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `enable_thinking` | true | Enhanced reasoning for higher quality; increases latency. **Only effective when `prompt_extend=true`**; applies to Direct T2I, Direct I2I, Agent T2I (I2I Agent mode not supported). Set `false` to reduce generation time. |
| `prompt_extend_mode` | `direct` | Prompt-rewrite strategy (3.0 only). `direct`=DPE (default, most scenarios); `agent`=APE (finer rewriting, **text-to-image only**). Only takes effect when `prompt_extend=true`. |
| `prompt_extend` | true | Enable prompt rewriting. When `true`, rewriting follows `prompt_extend_mode`. |
| `size` | **none** (auto) | `width*height`. Continuous range: total pixels 512×512–2048×2048, aspect ratio 1:8–8:1. **No default — omit it and the model auto-recommends resolution from the prompt.** |
| `n` | 1 | Output images: 1–6. **Billed per image.** |
| `negative_prompt` | — | Content to exclude. Max 500 chars. |
| `watermark` | false | "Qwen-Image" watermark in lower-right corner. |
| `seed` | random | Reproducibility seed [0, 2147483647]. |

**Prompt length**: recommended ≤ **4500 Token** (the 2.0 series limit is 1300 Token); excess is truncated.

**Response `usage` differences (3.0 only)**: the 3.0 series returns `output_width` / `output_height` (instead of `width` / `height`) and `output_image_count` / `output_image_type` (instead of `image_count`), plus `input_image_count` / `input_image_type`. The `output_image_type` billing tier is `qima_output_1k` (pixel area ≤ 2,250,000) or `qima_output_2k` (> 2,250,000).

### Text-to-Image Models — Endpoint & Parameters

**Endpoint**: `POST /api/v1/services/aigc/text2image/image-synthesis` (async-only)

**Payload format**: `input.prompt` (NOT messages format).

```bash
curl -sS -X POST 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'X-DashScope-Async: enable' \
  -d '{
    "model": "qwen-image-plus",
    "input": {
        "prompt": "A healing-style poster featuring three puppies playing on green grass"
    },
    "parameters": {"size": "1664*928", "n": 1, "prompt_extend": true, "watermark": false}
  }'
```

Then poll with `GET /api/v1/tasks/{task_id}`. Response contains `output.results[].url`.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `n` | 1 | Output images (1–4). **Billed per image.** |
| `size` | `1328*1328` | Fixed resolutions only (see below). |
| `prompt_extend` | true | Intelligent prompt rewriting. |
| `watermark` | false | "AI Generated" watermark. |
| `negative_prompt` | — | Content to exclude. |
| `seed` | random | Reproducibility seed. |

**Fixed resolutions for qwen-image-plus/max:**

| Aspect Ratio | Size |
|-------------|------|
| 16:9 | 1664×928 |
| 4:3 | 1472×1104 |
| 1:1 | 1328×1328 |
| 3:4 | 1104×1472 |
| 9:16 | 928×1664 |

---

## Important Notes

1. **Image URLs are valid for only 24 hours.** Download and save images immediately after generation.
2. **Cost = unit price × number of images.** The `n` and `max_images` parameters directly affect cost. Always set `n=1` during testing.
3. **prompt_extend trade-off.** Significantly improves short prompts, but adds 3–4s latency and may drift from original intent. Set `prompt_extend=false` when you need precise control over composition.
4. **Synchronous vs. asynchronous.** wan2.6-t2i, wan2.6-image (editing mode), and qwen-image-edit series support synchronous calls. Interleaved text-image sync requires streaming; use async mode. wan2.5 and earlier models use async only. `qwen-image-plus` and `qwen-image-max` use async text2image endpoint only.
5. **Prompt length limit.** Supports both Chinese and English. Maximum 2,000 characters for wan2.6-image, 2,100 characters for wan2.6-t2i; excess is automatically truncated. `qwen-image-2.0-pro-2026-06-22` supports up to 1k tokens of instruction input.
6. **Region isolation.** API key, endpoint, and model must belong to the same region. Cross-region calls result in authentication failures.
7. **Async task_id is valid for 24 hours.** Do not create duplicate tasks; use polling to retrieve the result.

---

## FAQ

**Q: How do I choose between wan2.6-t2i and qwen-image-2.0-pro?**
A: Use wan2.6-t2i for realistic photography and diverse artistic styles. Use qwen-image-2.0-pro for complex text rendering tasks (posters, PPT illustrations, coupons). Both handle text well, but Qwen-Image is stronger for complex layouts.

**Q: When should I use wan2.6-image vs wan2.6-t2i?**
A: **Always use `wan2.6-t2i` for pure text-to-image (prompt only, no reference images).** `wan2.6-image` is an image editing model — it requires either `reference_images` (1–4 images for style transfer, subject consistency, editing) or `enable_interleave: true` (for interleaved text-image output). Using `wan2.6-image` without either will error or auto-fallback to `wan2.6-t2i`.

**Q: How do I get more consistent results?**
A: Use the `seed` parameter to fix the random seed. Disable `prompt_extend` to prevent the LLM from rewriting and drifting from your intent. Use `negative_prompt` to exclude unwanted elements.

**Q: When should I use wan2.7-image-pro vs wan2.6-t2i for text-to-image?**
A: `wan2.7-image-pro` is a multi-function model — it supports both t2i and image editing in one model, with thinking mode for higher quality and 4K support. Use it when you want the highest quality or may later need editing. `wan2.6-t2i` is a dedicated t2i model — slightly faster for simple text-to-image tasks since it doesn't carry editing overhead.

**Q: What is sequential multi-image mode?**
A: Set `enable_sequential=true` with `wan2.7-image-pro` or `wan2.7-image` to generate coherent image sequences (1–12 images) with the same subject across different scenes. Useful for storyboards, character sheets, or seasonal series. Note: thinking_mode is disabled in sequential mode.

**Q: Does the API support image-to-image / reference images?**
A: Yes. `wan2.7-image-pro` / `wan2.7-image` support 0–9 reference images with advanced features (bbox editing, sequential mode). `wan2.6-image` supports 1–4 reference images for style transfer, subject consistency, and interleaved output. `qwen-image-edit` series supports 1–3 reference images. Use the `reference_images` field in the script (URLs or local paths; local files are auto-uploaded). For multi-image composition, reference images by order in the prompt: "the style of image 1 and the background of image 2".

**Q: How does interleaved text-image output work?**
A: Set `enable_interleave=true` with `wan2.6-image`. The model generates mixed text and image content. Use async mode (the script auto-enables it). The response contains interleaved text and image items in `output.choices[0].message.content`. The script saves images and a markdown file. Note: `qwen-image-edit` series does **not** support interleaved output.

**Q: How do I optimize costs for batch generation?**
A: Set `n=1` to generate and evaluate one image at a time. Increase `n` after confirming quality.

**Q: When to use qwen-image-plus vs qwen-image-2.0-pro for text-to-image?**
A: `qwen-image-plus` uses the `text2image` endpoint with fixed resolutions — good for batch workflows with standard aspect ratios. `qwen-image-2.0-pro` uses the `multimodal-generation` endpoint with flexible resolutions and can also do image editing. Use `qwen-image-plus` for simple text-to-image; use `qwen-image-2.0-pro` when you need text rendering precision or image editing.

**Q: What's the difference between qwen-image-edit series and wan2.6-image?**
A: Both use the `multimodal-generation` endpoint with `messages` format. Key differences: qwen-image-edit supports max 3 input images (vs wan's 4), `n` up to 6 (vs wan's 4), and does not support interleaved output. qwen-image-edit excels at precise text editing in images and element manipulation.

---

## z-image-turbo — Open-source SOTA T2I

### Definition

`z-image-turbo` is an open-source 6B-parameter text-to-image model with 8-step inference, hosted on the QianWen platform. It targets fast, low-cost text-to-image generation. The model has stricter payload constraints than the Wan/Qwen-Image series:

- **Sync-only** — uses the standard multimodal-generation sync endpoint; async invocation is not supported.
- **Single text content per message** — `messages[0].content` must contain exactly one `{text}` item.
- **No `n` parameter** — multi-image output is not supported (the server returns 400 if `n` is provided).
- **No reference images** — image input is not accepted.
- **Allowed parameters only**: `size`, `prompt_extend`, `seed`.

### Endpoint

```
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
```

### Parameters

| Parameter        | Default | Description                                                                |
|------------------|---------|----------------------------------------------------------------------------|
| `size`           | `1024*1024` | Output resolution as `width*height`. Common: `1024*1024`, `1280*720`, `720*1280`. |
| `prompt_extend`  | true    | Auto-rewrite the prompt for better quality (adds 2–4s latency).            |
| `seed`           | random  | Reproducibility seed `[0, 2147483647]`.                                    |

> [!IMPORTANT]
> Do not include `n`, `negative_prompt`, `watermark`, `reference_images`, `reference_image`, `enable_interleave`, `enable_sequential`, `thinking_mode`, `bbox_list`, or `color_palette` — none of these are supported by z-image-turbo and may cause 400 errors or be silently ignored.

### Examples

**curl (sync)**

```bash
curl -sS 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "z-image-turbo",
    "input": {
      "messages": [{"role": "user", "content": [{"text": "A cyberpunk street at night, neon signs, rain"}]}]
    },
    "parameters": {"size": "1024*1024", "prompt_extend": true}
  }'
```

The image URL is at `output.choices[0].message.content[0].image` in the response.

**Python (urllib, sync)**

```python
import json, os
from urllib import request

req = request.Request(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    data=json.dumps({
        "model": "z-image-turbo",
        "input": {"messages": [{"role": "user", "content": [{"text": "A cyberpunk street at night"}]}]},
        "parameters": {"size": "1024*1024", "prompt_extend": True},
    }).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {os.environ['DASHSCOPE_API_KEY']}",
        "Content-Type": "application/json",
    },
    method="POST",
)
with request.urlopen(req, timeout=120) as resp:
    data = json.loads(resp.read())
print(data["output"]["choices"][0]["message"]["content"][0]["image"])
```

### Use via this skill's script

The script auto-routes z-image-turbo to the dedicated payload builder and forces sync mode:

```bash
python3 scripts/image.py \
  --model z-image-turbo \
  --request '{"prompt":"A cyberpunk street at night","size":"1024*1024"}' \
  --output output/z-image/output.png
```

If `reference_images` or `n>1` is passed, the script logs a warning and silently drops them before calling the API.
