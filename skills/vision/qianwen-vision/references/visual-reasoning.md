# Visual Reasoning Guide

> **Content validity**: 2026-08 | **Source**: [Visual Reasoning](https://platform.qianwenai.com/docs/developer-guides/text-generation/thinking)

---

## Overview

Visual reasoning models output their thinking process before the final answer. Suitable for complex tasks: solving math problems from images, analyzing chart data, understanding complex visual scenes, and reasoning about video content.

---

## Model Types

### Thinking-only (always reason)

| Model | Region | Notes |
|-------|--------|-------|
| `qvq-max` | China (cn-beijing) | **Streaming output only**. `incremental_output` defaults true. |
| `qvq-plus` | China (cn-beijing) | Streaming output only. |
| `qwen3-vl-235b-a22b-thinking` | China, Global | Open source. Streaming only. |
| `qwen3-vl-32b-thinking` | China, Global | Open source. Streaming only. |
| `qwen3-vl-30b-a3b-thinking` | China, Global | Open source. |
| `qwen3-vl-8b-thinking` | China, Global | Open source. |

### Hybrid thinking (toggle via `enable_thinking`)

| Model | Default | Notes |
|-------|---------|-------|
| `qwen3-vl-plus` | thinking **off** | Set `enable_thinking: true` to activate |
| `qwen3-vl-flash` | thinking **off** | Set `enable_thinking: true` to activate |
| `qwen3.8-max` | thinking **on** | Set `enable_thinking: false` to disable |
| `qwen3.8-flash` | thinking **on** | Set `enable_thinking: false` to disable |
| `qwen3.7-plus` | thinking **on** | Set `enable_thinking: false` to disable |
| `qwen3.7-flash` | thinking **on** | Set `enable_thinking: false` to disable |
| `qwen3.6-plus` | thinking **on** | Strong all-rounder. Set `enable_thinking: false` to disable |
| `qwen3.6-flash` | thinking **on** | Set `enable_thinking: false` to disable |
| `qwen3.5-plus` | thinking **on** | Set `enable_thinking: false` to disable |
| `qwen3.5-flash` | thinking **on** | Set `enable_thinking: false` to disable |

---

## API Reference

Same endpoint as standard vision: `POST /compatible-mode/v1/chat/completions`

### Key Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `enable_thinking` | bool | Enable/disable thinking (hybrid models only). Pass via `extra_body`. |
| `thinking_budget` | int | Max tokens for reasoning process. Controls thinking depth. |
| `stream` | bool | **Required for thinking-only models** (qvq-max, etc.). Recommended for all. |

### Streaming Response

The delta contains two separate fields:
- `reasoning_content`: The model's step-by-step thinking (billed as output tokens)
- `content`: The final answer

---

## Code Examples

### QVQ Visual Reasoning (Python)

```python
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

completion = client.chat.completions.create(
    model="qvq-max",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": "https://img.alicdn.com/imgextra/i1/O1CN01gDEY8M1W114Hi3XcN_!!6000000002727-0-tps-1024-406.jpg"}},
            {"type": "text", "text": "How do I solve this problem?"},
        ],
    }],
    stream=True,
    stream_options={"include_usage": True},
)

reasoning_content = ""
answer_content = ""
is_answering = False

for chunk in completion:
    if not chunk.choices:
        print(f"\nUsage: {chunk.usage}")
        continue

    delta = chunk.choices[0].delta
    if hasattr(delta, "reasoning_content") and delta.reasoning_content:
        reasoning_content += delta.reasoning_content
        if not is_answering:
            print(delta.reasoning_content, end="", flush=True)

    if hasattr(delta, "content") and delta.content:
        if not is_answering:
            is_answering = True
            print("\n--- Answer ---")
        answer_content += delta.content
        print(delta.content, end="", flush=True)
```

### Hybrid Thinking with VL-Plus (Python)

```python
completion = client.chat.completions.create(
    model="qwen3-vl-plus",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/chart.png"}},
            {"type": "text", "text": "Analyze the trends in this chart."},
        ],
    }],
    stream=True,
    extra_body={"enable_thinking": True},
)
```

### Video Reasoning (Python)

Video input uses the same thinking pipeline. Pass `video_url` (or `video` frame list) instead of `image_url`. The `fps` parameter controls frame extraction frequency.

```python
completion = client.chat.completions.create(
    model="qvq-max",
    messages=[{
        "role": "user",
        "content": [
            {"type": "video_url", "video_url": {"url": "https://img.alicdn.com/imgextra/i1/NotRealJustExample/clip.mp4"}, "fps": 2},
            {"type": "text", "text": "Analyze what happens in this video step by step."},
        ],
    }],
    stream=True,
    stream_options={"include_usage": True},
)
```

**Video duration limits**: 2s-2h (Qwen3.8/3.7/3.6/3.5 series) / 2s-1h (Qwen3-VL series) / 2s-10min (QVQ, Qwen2.5-VL). `fps` range [0.1, 10], default 2.0. Use lower fps for long videos to save tokens.

**Script usage**:

```bash
# Video reasoning with QVQ
python scripts/reason.py --request '{"prompt":"What happens and why?","video":"clip.mp4","fps":2}'

# Video frames reasoning
python scripts/reason.py --request '{"prompt":"Describe the action",
  "video_frames":["f1.jpg","f2.jpg","f3.jpg","f4.jpg"],"fps":2}' --print-response
```

---

## Important Notes

1. **QVQ models require streaming.** Non-streaming calls return an error. The skill script auto-enables streaming for QVQ.
2. **Thinking tokens are billed as output tokens.** This increases cost. Use `thinking_budget` to limit reasoning depth.
3. **System prompt**: In general (non-agent) scenarios, do not set a System Message for optimal performance. Pass instructions via User Message. For multi-turn agents, use the system message.
4. **Qwen3.6-plus/Qwen3.6-flash/Qwen3.5-plus thinking is on by default.** Disable with `enable_thinking: false` for simple tasks where speed matters.
5. **Structured output only in non-thinking mode.** JSON Schema and structured output are only supported when thinking is disabled.
6. **analyze.py also supports thinking.** Set `enable_thinking: true` in the request — the script auto-enables streaming. Use reason.py only for QVQ or dedicated reasoning workflows.
7. **Video reasoning supported.** Both `reason.py` and `analyze.py` accept `video` (URL) and `video_frames` (frame list) input with optional `fps` parameter. Video audio is not processed — models analyze frames only.
