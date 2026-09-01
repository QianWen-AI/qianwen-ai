# Qwen Text Chat — API Supplementary Guide

> **Content validity**: 2026-08 | **Sources**: [OpenAI compatibility](https://platform.qianwenai.com/docs/api-reference/preparation/install-sdk) · [Qwen API](https://platform.qianwenai.com/docs/api-reference/chat/dashscope) · [Function calling](https://platform.qianwenai.com/docs/developer-guides/text-generation/function-calling) · [Models](https://www.qianwenai.com/models)

---

## Definition

Qwen text generation models accessed through an **OpenAI-compatible** interface. Migrate existing OpenAI code by updating three values: `base_url`, `api_key`, and `model`. Supports text generation, multi-turn conversations, code writing, reasoning, and function calling.

---

## Use Cases

| Scenario | Recommended Model | Notes |
|----------|------------------|-------|
| General conversation / content generation | `qwen3.7-plus` | **Recommended default.** Multimodal vision-language, enhanced Agent execution & coding. 1M context. |
| Multimodal (text+image+video) | `qwen3.6-plus` | Strong coding & universal recognition. 1M context. Thinking on by default. |
| Strongest reasoning / coding | `qwen3.8-max` | Latest flagship. 2.4T MoE, native vision-language, hybrid thinking (on by default), 1M context. Best for complex tasks. |
| Fast next-gen (Qwen3.8) | `qwen3.8-flash` | Fast Qwen3.8. Multimodal (text+image+video), hybrid thinking (on by default), 1M context. Cost-effective. |
| Flagship agent tasks | `qwen3.7-max` | 1M context, thinking mode, function calling, built-in tools, structured output. |
| Next-gen balanced | `qwen3.7-plus` | 1M context, thinking, function calling, built-in tools. Cost-effective for AI agents and coding. |
| Next-gen lightweight | `qwen3.7-flash` | 1M context, full features at lowest cost in Qwen3.7 series. |
| General conversation (alt) | `qwen3.5-plus` | Balanced performance, cost, speed, 1M context, thinking on by default. |
| Low-latency real-time interaction | `qwen3.5-flash` / `qwen-turbo` | Fastest response time. Suitable for chatbots. |
| Complex tasks (legacy) | `qwen3-max` | Previous-gen flagship. Best for complex reasoning. |
| Code generation / completion | `qwen3-coder-next` | Top recommendation. `qwen3-coder-plus` for highest quality, `qwen3-coder-flash` for speed. |
| Deep reasoning / math | `qwq-plus` | Chain-of-thought (CoT) reasoning. |
| Ultra-long document processing | `qwen-long` | 10M token context. |
| Agent / tool calling | `qwen3.8-max` / `qwen3.7-plus` / `qwen3.6-plus` | Most complete function calling and built-in tool support. |
| Machine translation | `qwen-mt-plus` | Best quality, 92 languages. `qwen-mt-flash` for speed, `qwen-mt-lite` for real-time chat. Uses `translation_options` parameter. |
| Role-playing / character dialog | `qwen-plus-character` | Character restoration, empathetic dialog. For Japanese or other languages, specify via system prompt. |

---

## Key Usage

### Regional Endpoints

| Region | base_url |
|--------|----------|
| Beijing (default) | `https://dashscope.aliyuncs.com/compatible-mode/v1` |

### Non-streaming Call

```python
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)
resp = client.chat.completions.create(
    model="qwen3.7-plus",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"},
    ],
)
print(resp.choices[0].message.content)
```

### Streaming (recommended for interactive use)

```python
stream = client.chat.completions.create(
    model="qwen3.7-plus",
    messages=[{"role": "user", "content": "Write a haiku."}],
    stream=True,
    stream_options={"include_usage": True},
)
for chunk in stream:
    if chunk.choices and chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### Function Calling

Workflow: **Define tools → Model returns tool call instruction → Execute tool → Send result back → Get final answer.**

```python
tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get weather for a city",
        "parameters": {
            "type": "object",
            "properties": {"location": {"type": "string"}},
            "required": ["location"],
        },
    },
}]

resp = client.chat.completions.create(
    model="qwen3.7-plus",
    messages=[{"role": "user", "content": "What's the weather in Beijing?"}],
    tools=tools,
)
# resp.choices[0].message.tool_calls contains function name and arguments
# Execute the function, then send result back with role="tool"
```

Supported models: Qwen3.8-Max/Flash, Qwen3.7-Max/Plus/Flash, Qwen3.6-Plus/Flash, Qwen-Max/Plus/Flash/Turbo, Qwen3.5/3 series, qwen3-vl-plus/flash, qwen3-omni-flash.

### Thinking Mode

**Model defaults apply**: `qwen3.8-max`, `qwen3.8-flash`, `qwen3.7-max`, `qwen3.7-plus`, `qwen3.7-flash`, `qwen3.6-plus`, `qwen3.6-flash`, `qwen3.5-plus` and `qwen3.5-flash` have thinking mode **enabled by default**. For these models, do NOT set `enable_thinking` unless you want to override the default behavior.

For other models (`qwen3-max`, `qwen-plus`, `qwen-turbo`, etc.), thinking mode is off by default. Only enable when the user explicitly requests step-by-step reasoning:

```python
# For qwen3.6-plus/qwen3.5-plus/flash: thinking is ON by default, no need to set
resp = client.chat.completions.create(
    model="qwen3.6-plus",
    messages=[{"role": "user", "content": "Solve this problem."}],
)

# For other models: enable thinking only when user explicitly requests it
resp = client.chat.completions.create(
    model="qwen3-max",
    messages=[{"role": "user", "content": "Solve 17 × 23 step by step."}],
    extra_body={"enable_thinking": True},  # Only for non-default models
)

# Script usage: add --enable-thinking flag to override defaults
# python scripts/text.py --request '{"messages":[...]}' --enable-thinking
```

**When to disable thinking for qwen3.8-max/qwen3.8-flash/qwen3.7-*/qwen3.6-plus/qwen3.6-flash/qwen3.5-plus/flash**: Set `enable_thinking: false` for simple chat, real-time interaction, or when you want faster responses without extended reasoning.

### Key Request Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | **Required.** Model ID. |
| `messages` | array | **Required.** Conversation history. Format: `{"role": "...", "content": "..."}`. Roles: `system`, `user`, `assistant`. `system` can only appear at `messages[0]`. Last element must have `user` role. |
| `temperature` | float | Controls randomness. Range: [0, 2). Higher values produce more diverse output. |
| `top_p` | float | Nucleus sampling threshold. Range: (0, 1.0]. |
| `max_tokens` | int | Maximum number of output tokens. |
| `stream` | bool | Enable streaming output. |
| `tools` | array | Tool definitions for function calling. |
| `stop` | string/array | Stop generation when specified string or token is about to be output. |

### Key Response Fields

| Field | Description |
|-------|-------------|
| `choices[0].message.content` | Generated text. |
| `choices[0].message.tool_calls` | Tool call instructions (if applicable). |
| `choices[0].finish_reason` | `stop` = normal completion; `length` = max_tokens reached. |
| `usage.prompt_tokens` / `completion_tokens` | Token consumption. |

---

## Important Notes

1. **Prefer streaming.** Non-streaming blocks until the full response is generated (10–60s+ for long outputs). Always use `stream=True` for interactive scenarios.
2. **API keys are region-specific.** Use the `cn-beijing` (Beijing) endpoint with your API key.
3. **openai SDK version:** Requires ≥1.55.0. Older versions conflict with httpx ≥0.28, causing a `proxies` TypeError.
4. **Thinking mode varies by model.** `qwen3.8-max`, `qwen3.8-flash`, `qwen3.7-max`, `qwen3.7-plus`, `qwen3.7-flash`, `qwen3.6-plus`, `qwen3.6-flash`, `qwen3.5-plus` and `qwen3.5-flash` have thinking mode enabled by default; other models have it off. Only override with `enable_thinking` when you want to change the default behavior.
5. **Function calling constraints.** `tools` works with `stream=True` on current models (the tool name arrives in the first chunk and arguments accumulate across subsequent chunks). Still incompatible with `n > 1`.
6. **messages format.** `system` role can only appear at `messages[0]`. The last message must have the `user` role.
7. **Some models have limited regional availability.** `qwen-long` (10M context), `qwen-math-plus`, and third-party
   models are not available in `cn-beijing`. Check
   the [Model List](https://www.qianwenai.com/models) for the latest availability.

---

## FAQ

**Q: How do I migrate from OpenAI?**
A: Change three values: `api_key` to your DASHSCOPE_API_KEY, `base_url` to the corresponding regional endpoint, and `model` to a Qwen model name. All other code remains compatible.

**Q: When should I use streaming vs. non-streaming?**
A: Use streaming for interactive scenarios (chat, real-time output). Use non-streaming for batch processing or when you need the complete JSON response at once. With streaming, set `stream_options={"include_usage": True}` to receive token usage in the last chunk.

**Q: Which models support function calling?**
A: Qwen3.8-max/flash, Qwen3.7-max/plus/flash, Qwen3.6-plus/flash, Qwen-Max/Plus/Flash/Turbo series, Qwen3.5/3/2.5 series, qwen3-vl-plus/flash, qwen3-omni-flash, and third-party models (deepseek, kimi, glm).

**Q: What is the difference between `qwen3.7-plus` and `qwen3.6-plus`?**
A: `qwen3.7-plus` is the latest recommended default (2026-06-01) with multimodal vision-language, enhanced Agent execution, and full coding capability. `qwen3.6-plus` is the previous generation with strong multimodal recognition. `qwen3.7-plus` is recommended as default for new projects. For strongest capability, use `qwen3.8-max`.

**Q: How do I control output length?**
A: Use `max_tokens` to limit output token count. Use `stop` to set stop sequences. Each model has its own default output limit.

**Q: What should I do when I get a 429 error?**
A: 429 indicates QPS/QPM rate limit exceeded or insufficient quota. Implement exponential backoff retry, or check remaining quota in the console.
