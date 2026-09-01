# Qwen Image Generation — Execution Guide

Fallback paths when the bundled script (Path 1) fails or is unavailable.

## Path 0 · Environment Fix

When the script fails due to environment issues (not API errors):

1. **`python3` not found**: Try `python --version` or `py -3 --version`. Use whichever returns 3.9+. If none work, help the user install Python 3.9+ from https://www.python.org/downloads/.
2. **Version too low** (`Python 3.9+ required` or `SyntaxError`): Install Python 3.9+ alongside existing Python, then use `python3.9` or `python3.11` explicitly.
3. **SSL errors** (`CERTIFICATE_VERIFY_FAILED`): On macOS, run `/Applications/Python\ 3.x/Install\ Certificates.command`. On Linux/Windows, set `SSL_CERT_FILE` to point to your CA bundle.
4. **Proxy**: Set `HTTPS_PROXY=http://proxy:port` before running the script.

After fixing, retry the script (Path 1). If the environment is unfixable, fall through to **Path 2 (curl)** below — curl is available on most systems without Python.

## Path 2 · Direct API Call (curl)

### Sync mode (wan2.6, recommended)

**Step 1 — Generate image:**

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7-image",
    "input": {
      "messages": [{"role": "user", "content": [{"text": "A cozy flower shop with wooden door"}]}]
    },
    "parameters": {
      "size": "1280*1280",
      "prompt_extend": true,
      "n": 1
    }
  }'
```

**Step 2 — Extract image URL** from `output.results[0].url`:

```json
{
  "output": {
    "results": [{"url": "https://dashscope-result-...oss-cn-beijing.aliyuncs.com/..."}]
  },
  "usage": {"image_count": 1}
}
```

**Step 3 — Download the image** (URL valid 24 hours):

```bash
curl -o image.png "IMAGE_URL_FROM_STEP_2"
```

### Async mode (wan2.5 and older models)

**Step 1 — Submit task:**

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-DashScope-Async: enable" \
  -d '{
    "model": "wan2.5-t2i-preview",
    "input": {
      "prompt": "A cozy flower shop with wooden door",
      "negative_prompt": "blurry, low quality"
    },
    "parameters": {
      "size": "1280*1280",
      "n": 1
    }
  }'
```

Extract `output.task_id` from response.

**Step 2 — Poll until done** (repeat every 5–10s):

```bash
curl -sS "https://dashscope.aliyuncs.com/api/v1/tasks/TASK_ID" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY"
```

Wait until `output.task_status` is `SUCCEEDED` (or `FAILED`).

**Step 3 — Download** from `output.results[0].url`:

```bash
curl -o image.png "IMAGE_URL_FROM_POLL_RESPONSE"
```

**Region endpoints** (replace base URL as needed):

| Region | Base URL |
|--------|----------|
| Beijing (default) | `https://dashscope.aliyuncs.com/api/v1` |

### wan2.7-image-pro: Text-to-image with thinking mode (sync)

**Step 1 — Generate image:**

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7-image-pro",
    "input": {
      "messages": [{"role": "user", "content": [{"text": "A cozy flower shop with delicate wooden door and morning sunlight"}]}]
    },
    "parameters": {
      "size": "4K",
      "n": 1,
      "thinking_mode": true,
      "watermark": false
    }
  }'
```

**Step 2 — Extract image URL** from `output.choices[0].message.content[0].image`, then download.

### wan2.7-image-pro: Sequential multi-image (sync)

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7-image-pro",
    "input": {
      "messages": [{"role": "user", "content": [{"text": "A stray orange cat through four seasons"}]}]
    },
    "parameters": {
      "size": "2K",
      "enable_sequential": true,
      "n": 4,
      "watermark": false
    }
  }'
```

Multiple images returned in `output.choices[0].message.content[].image`.

### wan2.7-image-pro: Image editing with references (sync)

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7-image-pro",
    "input": {
      "messages": [{"role": "user", "content": [
        {"text": "Apply the graffiti from image 2 onto the car in image 1"},
        {"image": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/car.jpg"},
        {"image": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/graffiti.jpg"}
      ]}]
    },
    "parameters": {
      "size": "2K",
      "n": 1,
      "watermark": false
    }
  }'
```

Extract image URL from `output.choices[0].message.content[0].image`, then download.

### wan2.6-image: Image editing (sync)

**Step 1 — Generate edited image:**

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.6-image",
    "input": {
      "messages": [{"role": "user", "content": [
        {"text": "Apply watercolor painting style to this photo"},
        {"image": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/photo.jpg"}
      ]}]
    },
    "parameters": {
      "size": "1K",
      "n": 1,
      "prompt_extend": true,
      "enable_interleave": false,
      "watermark": false
    }
  }'
```

**Step 2 — Extract image URL** from `output.choices[0].message.content[0].image`:

```json
{
  "output": {
    "choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": [{"image": "https://...", "type": "image"}]}}],
    "finished": true
  },
  "usage": {"image_count": 1, "size": "1376*768"}
}
```

**Step 3 — Download the image** (URL valid 24 hours):

```bash
curl -o edited.png "IMAGE_URL_FROM_STEP_2"
```

### wan2.6-image: Multi-image composition (sync)

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.6-image",
    "input": {
      "messages": [{"role": "user", "content": [
        {"text": "Generate a sunset scene based on the style of image 1 and the background of image 2"},
        {"image": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/style.jpg"},
        {"image": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/background.jpg"}
      ]}]
    },
    "parameters": {"size": "1K", "n": 1, "prompt_extend": true, "enable_interleave": false}
  }'
```

### wan2.6-image: Interleaved text-image output (async)

**Step 1 — Submit task:**

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-DashScope-Async: enable" \
  -d '{
    "model": "wan2.6-image",
    "input": {
      "messages": [{"role": "user", "content": [
        {"text": "Give me a three-image tutorial for making latte art"}
      ]}]
    },
    "parameters": {"enable_interleave": true, "max_images": 3, "size": "1280*1280"}
  }'
```

Extract `output.task_id` from the response.

**Step 2 — Poll until done** (repeat every 10s):

```bash
curl -sS "https://dashscope.aliyuncs.com/api/v1/tasks/TASK_ID" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY"
```

Wait until `output.task_status` is `SUCCEEDED`. The response `output.choices[0].message.content` contains interleaved `{type: "text", text: "..."}` and `{type: "image", image: "URL"}` items.

**Step 3 — Download images** from the interleaved content:

```bash
# Download each image URL from the interleaved content
curl -o image_1.png "IMAGE_URL_1"
curl -o image_2.png "IMAGE_URL_2"
curl -o image_3.png "IMAGE_URL_3"
```

### wan2.5-i2i-preview: Single-image editing (async-only)

**Step 1 — Submit task:**

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-DashScope-Async: enable" \
  -d '{
    "model": "wan2.5-i2i-preview",
    "input": {
      "prompt": "Change the dress to a vintage lace long dress with embroidery details",
      "images": ["https://img.alicdn.com/imgextra/i3/O1CN0157XGE51l6iL9441yX_!!6000000004770-49-tps-1104-1472.webp"]
    },
    "parameters": {"prompt_extend": true, "n": 1}
  }'
```

Extract `output.task_id` from response.

**Step 2 — Poll until done** (repeat every 5–10s):

```bash
curl -sS "https://dashscope.aliyuncs.com/api/v1/tasks/TASK_ID" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY"
```

Wait until `output.task_status` is `SUCCEEDED`.

**Step 3 — Download** from `output.results[0].url`:

```bash
curl -o edited.png "IMAGE_URL_FROM_POLL_RESPONSE"
```

### wan2.5-i2i-preview: Multi-image fusion (async-only)

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-DashScope-Async: enable" \
  -d '{
    "model": "wan2.5-i2i-preview",
    "input": {
      "prompt": "Place the alarm clock from Image 1 next to the vase on the table in Image 2",
      "images": [
        "https://img.alicdn.com/imgextra/i3/O1CN0157XGE51l6iL9441yX_!!6000000004770-49-tps-1104-1472.webp",
        "https://img.alicdn.com/imgextra/i3/O1CN01SfG4J41UYn9WNt4X1_!!6000000002530-49-tps-1696-960.webp"
      ]
    },
    "parameters": {"prompt_extend": true, "n": 1}
  }'
```

Then poll and download as in the single-image case above.

### qwen-image-2.0-pro: Image editing (sync)

**Step 1 — Generate edited image:**

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-image-2.0-pro",
    "input": {
      "messages": [{"role": "user", "content": [
        {"image": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250925/thtclx/input1.png"},
        {"image": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250925/iclsnx/input2.png"},
        {"text": "Make the girl from Image 1 wear the black dress from Image 2"}
      ]}]
    },
    "parameters": {
      "size": "1024*1536",
      "n": 2,
      "prompt_extend": true,
      "watermark": false
    }
  }'
```

**Step 2 — Extract image URLs** from `output.choices[0].message.content[].image`:

```json
{
  "output": {
    "choices": [{"finish_reason": "stop", "message": {"role": "assistant", "content": [{"image": "https://...", "type": "image"}, {"image": "https://...", "type": "image"}]}}]
  }
}
```

**Step 3 — Download the images** (URLs valid 24 hours):

```bash
curl -o edited_1.png "IMAGE_URL_1"
curl -o edited_2.png "IMAGE_URL_2"
```

### qwen-image-2.0-pro: Pure text-to-image (sync)

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-image-2.0-pro",
    "input": {
      "messages": [{"role": "user", "content": [
        {"text": "A vintage coffee shop poster with elegant calligraphy: Open Daily 7AM-9PM"}
      ]}]
    },
    "parameters": {"size": "1024*1536", "n": 1, "prompt_extend": true}
  }'
```

Extract image URL from `output.choices[0].message.content[0].image`, then download.

### qwen-image-plus / qwen-image-max: Text-to-image (async)

**Step 1 — Submit task:**

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-DashScope-Async: enable" \
  -d '{
    "model": "qwen-image-plus",
    "input": {
      "prompt": "A healing-style hand-drawn poster featuring three puppies playing with a ball on green grass"
    },
    "parameters": {"size": "1664*928", "n": 1, "prompt_extend": true, "watermark": false}
  }'
```

Extract `output.task_id` from response.

**Step 2 — Poll until done** (repeat every 5–10s):

```bash
curl -sS "https://dashscope.aliyuncs.com/api/v1/tasks/TASK_ID" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY"
```

Wait until `output.task_status` is `SUCCEEDED`.

**Step 3 — Download** from `output.results[0].url`:

```bash
curl -o image.png "IMAGE_URL_FROM_POLL_RESPONSE"
```

**Valid sizes for qwen-image-plus/max:** `1664*928` (16:9), `1472*1104` (4:3), `1328*1328` (1:1), `1104*1472` (3:4), `928*1664` (9:16)

## Paths 3–5 · Fallback Cascade

When agent-executed paths (1–2) fail or shell is restricted:

**Path 3 — Generate Python script**: Read `scripts/image.py` to understand the API logic (sync/async, file upload, download, image editing, interleaved output). Write a self-contained Python script (stdlib `urllib`) tailored to the user's task. Present it for the user to save and run. Use `os.environ["DASHSCOPE_API_KEY"]` — never hardcode or expose the key.

**Path 4 — Generate curl commands**: Customize the curl templates from Path 2 with the user's specific parameters. Present as ready-to-copy commands.

**Path 5 — Autonomous resolution**: Read `scripts/image.py` source and `references/*.md` to understand the full API contract. Reason about alternative approaches and implement.

For **local file references** (e.g. `reference_images` pointing to local paths), Path 1 is strongly preferred — the script auto-uploads to DashScope temp storage and injects the `oss://` URL.
