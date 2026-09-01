# Qwen Video Generation — Execution Guide

Fallback paths when the bundled script (Path 1) fails or is unavailable.

## Path 0 · Environment Fix

When the script fails due to environment issues (not API errors):

1. **`python3` not found**: Try `python --version` or `py -3 --version`. Use whichever returns 3.9+. If none work, help the user install Python 3.9+ from https://www.python.org/downloads/.
2. **Version too low** (`Python 3.9+ required` or `SyntaxError`): Install Python 3.9+ alongside existing Python, then use `python3.9` or `python3.11` explicitly.
3. **SSL errors** (`CERTIFICATE_VERIFY_FAILED`): On macOS, run `/Applications/Python\ 3.x/Install\ Certificates.command`. On Linux/Windows, set `SSL_CERT_FILE` to point to your CA bundle.
4. **Proxy**: Set `HTTPS_PROXY=http://proxy:port` before running the script.

After fixing, retry the script (Path 1). If the environment is unfixable, fall through to **Path 2 (curl)** below — curl is available on most systems without Python.

## Path 2 · Direct API Call (curl)

All video generation is **asynchronous**: submit a task, get a `task_id`, then poll until complete.

### Step 1 — Submit task

**t2v example:**

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-DashScope-Async: enable" \
  -d '{
    "model": "happyhorse-1.1-t2v",
    "input": {
      "prompt": "A detective walking through a rainy city at night"
    },
    "parameters": {
      "resolution": "720P",
      "duration": 5
    }
  }'
```

Extract `output.task_id` from the response.

**kf2v — different endpoint:**

```bash
curl -sS -X POST "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-DashScope-Async: enable" \
  -d '{
    "model": "wan2.2-kf2v-flash",
    "input": {
      "prompt": "A cat looks up to the sky",
      "first_frame_url": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/first.png",
      "last_frame_url": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/last.png"
    },
    "parameters": {
      "resolution": "720P"
    }
  }'
```

**Submit JSON examples for other modes:**

i2v:
```json
{"model":"happyhorse-1.1-i2v","input":{"media":[{"type":"first_frame","url":"https://img.alicdn.com/imgextra/i1/NotRealJustExample/frame.png"}],"prompt":"A cat running on grass"},"parameters":{"resolution":"720P","duration":5}}
```

r2v:
```json
{"model":"happyhorse-1.1-r2v","input":{"prompt":"character1 greets character2","media":[{"type":"reference_image","url":"https://img.alicdn.com/imgextra/i1/NotRealJustExample/person1.png"},{"type":"reference_image","url":"https://img.alicdn.com/imgextra/i1/NotRealJustExample/person2.png"}]},"parameters":{"resolution":"720P","duration":5}}
```

vace (image_reference):
```json
{"model":"wanx2.1-vace-plus","input":{"function":"image_reference","prompt":"A girl walks through a forest","ref_images_url":["https://img.alicdn.com/imgextra/i1/NotRealJustExample/girl.png","https://img.alicdn.com/imgextra/i1/NotRealJustExample/forest.png"],"obj_or_bg":["obj","bg"]},"parameters":{"size":"1280*720"}}
```

### Step 2 — Poll until done (repeat every 10–15s)

```bash
curl -sS "https://dashscope.aliyuncs.com/api/v1/tasks/TASK_ID" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY"
```

Wait until `output.task_status` is `SUCCEEDED` or `FAILED`. On success, extract the video URL from `output.video_url`.

### Step 3 — Download (URL valid 24 hours)

```bash
curl -o video.mp4 "VIDEO_URL_FROM_POLL_RESPONSE"
```

### API Endpoints

| Mode | Endpoint |
|------|----------|
| t2v, i2v, r2v, vace | `POST /api/v1/services/aigc/video-generation/video-synthesis` |
| kf2v | `POST /api/v1/services/aigc/image2video/video-synthesis` |
| Poll (all) | `GET /api/v1/tasks/{task_id}` |

### Region Endpoints

| Region | Base URL |
|--------|----------|
| Beijing (default) | `https://dashscope.aliyuncs.com/api/v1` |

For **local file inputs**, use Script Execution (Path 1) — the script auto-uploads to DashScope temp storage.

## Paths 3–5 · Fallback Cascade

When agent-executed paths (1–2) fail or shell is restricted:

**Path 3 — Generate Python script**: Read `scripts/video.py` to understand the API logic (mode detection, file upload, async polling, download). Write a self-contained Python script (stdlib `urllib`) tailored to the user's task. Present it for the user to save and run. Use `os.environ["DASHSCOPE_API_KEY"]` — never hardcode or expose the key.

**Path 4 — Generate curl commands**: Customize the curl templates from Path 2 with the user's specific parameters. Present as ready-to-copy commands. Include the polling loop guidance.

**Path 5 — Autonomous resolution**: Read `scripts/video.py` source and `references/*.md` to understand the full API contract. Reason about alternative approaches and implement.

For media merging (concat, trim, audio overlay), read [merge-media.md](merge-media.md) for ffmpeg CLI and moviepy recipes, then generate and run the appropriate code for the user's environment.

For advanced polling patterns, see [polling-guide.md](polling-guide.md).
