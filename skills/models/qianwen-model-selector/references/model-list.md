# Model List

> Source: https://www.qianwenai.com/models
> Updated: 2026-08-27

## Text Generation — Commercial

| Model ID          | Context                             | Thinking         | Key Info                                                                                                                           |
|-------------------|-------------------------------------|------------------|------------------------------------------------------------------------------------------------------------------------------------|
| qwen3.8-max        | 1M                                  | Yes (default on) | **Strongest flagship overall.** 2.4T params MoE. Multimodal (text + image + video). Surpasses 3.7 series significantly. |
| qwen3.8-flash      | 1M                                  | Yes (default on) | Fast Qwen3.8. Multimodal (text + image + video). Thinking mode.                                                            |
| qwen3.7-max        | 1M                                  | Yes (default on) | Qwen3.7 Max. Text-only. Strongest agentic coding, long-horizon execution.                                         |
| qwen3.7-plus       | 1M                                  | Yes (default on) | **Recommended default.** Qwen3.7 Plus. Multimodal vision-language. Enhanced Agent execution & coding, GUI perception. Tiered pricing. |
| qwen3.7-flash      | 1M                                  | Yes (default on) | Qwen3.7 Flash. Multimodal. Enhanced Agent execution, object recognition, spatial intelligence. Tiered pricing.                      |
| qwen3.6-plus      | 1M                                  | Yes (default on) | Multimodal (text + image + video). Strong coding & universal recognition. Surpasses qwen3-vl series. Tiered pricing. |
| qwen3.6-flash     | 1M                                  | Yes (default on) | Fastest Qwen3.6. Multimodal. Tiered pricing.                                                                                       |
| qwen3.5-plus      | 1M                                  | Yes (default on) | Multimodal (text + image + video input). On par with qwen3-max for text; surpasses qwen3-vl series for vision. Tiered pricing. |
| qwen3.5-flash     | 1M                                  | Yes (default on) | Fastest Qwen3.5. Tiered pricing.                                                                                                   |
| qwen3.6-max-preview | 256K                              | Yes (hybrid)     | Preview. Multimodal. Built-in tools (web search, code interpreter). Preview status — verify availability via CLI. Tiered pricing. |
| qwen3-max         | 262K                                | Yes (hybrid)     | Legacy. Built-in tools (web search, code interpreter). Tiered pricing.                                                   |
| qwen-plus         | 1M                                  | Yes (hybrid)     | General purpose (Qwen3 series). Tiered pricing.                                                                                    |
| qwen-flash        | 1M                                  | Yes (hybrid)     | Economy. Tiered pricing. Context cache supported.                                                                                  |
| qwen-turbo        | 131K                                | Yes (hybrid)     | Cheapest per-token.                                                                                                                |
| qwq-plus          | 131K                                | Always-on CoT    | Reasoning specialist. Max CoT 32K, response 8K.                                                                                    |
| qwen3-coder-next  | 262K                                | No               | Top code recommendation. Balances quality, speed, cost. Agentic coding, multi-turn tool calling.                                   |
| qwen3-coder-plus  | 1M                                  | No               | Best code model. Tiered pricing. Context cache supported.                                                                          |
| qwen3-coder-flash | 1M                                  | No               | Fast code model. Tiered pricing.                                                                                                   |
| qwen-plus-character | 32K                               | No               | Role-playing, character restoration, empathetic dialog.                                                                            |
| qwen-flash-character | 8K                               | No               | Role-playing, fast, lower cost.                                                                                                    |

## Text Generation — Open Source / Third Party

| Model ID          | Context | Thinking         | Source        | Key Info                                                                                  |
|-------------------|---------|------------------|---------------|-------------------------------------------------------------------------------------------|
| qwen3.8-27b       | 1M      | Yes (default on) | Open source   | Qwen3.8 open-source model. Multimodal capabilities aligned with the qwen3.8 series.       |
| qwen3.8-2.4t-a95b | 1M      | Yes (default on) | Open source   | Qwen3.8 open-source flagship. 2.4T params MoE (95B active). Strong reasoning & coding.     |
| qwen3.6-27b       | 262K    | Yes (default on) | Open source   | Qwen3.6 open-source model. Multimodal capabilities aligned with qwen3.6-plus.             |
| qwen3.5-27b       | 262K    | Yes (default on) | Open source   | Qwen3.5 open-source model. Strong text+vision baseline.                                   |
| deepseek-v4-flash | 1M      | Yes (`thinkingFormat: qwen`) | Third party (DeepSeek) | DeepSeek V4 Flash, hosted on QianWen. Verify availability via CLI.            |
| deepseek-v4-flash-0731 | 1M | Yes (`thinkingFormat: qwen`) | Third party (DeepSeek) | Lightweight MoE (284B/13B active). Native 1M context. Fast, low cost. Balanced general use. |
| deepseek-v4-pro   | 1M      | Yes (`thinkingFormat: qwen`) | Third party (DeepSeek) | DeepSeek V4 Pro. Deep reasoning model, thinking mode. |
| deepseek-v4-pro-0813 | 1M   | Yes (`thinkingFormat: qwen`) | Third party (DeepSeek) | Latest v4-pro snapshot. |
| glm-5.2           | 1M      | Yes              | Third party (Zhipu) | GLM-5.2 flagship. Long-horizon tasks. Strong reasoning, code, long-text understanding.       |
| glm-5.1           | 202K    | Yes              | Third party (Zhipu) | GLM-5.1, Anthropic + OpenAI compatible. Max output 128K.                          |
| kimi-k3           | 1M      | Yes              | Third party (Moonshot) | Kimi K3. 2.8T params. Native vision. Long-horizon coding, reasoning, knowledge.     |
| kimi-k2.7-code    | 262K    | Yes              | Third party (Moonshot) | Kimi K2.7 coding specialist. Multimodal (text+image+video).                    |
| kimi-k2.6         | 262K    | Yes              | Third party (Moonshot) | Kimi K2.6 long-context model.                                                  |
| MiniMax-M2.5      | 204K    | Yes              | Third party (MiniMax) | MiniMax M2.5. budgetTokens + output ≤ 32,768.                                   |

> Open-source models can be downloaded from [ModelScope](https://modelscope.cn) or HuggingFace. Third-party models are hosted on the QianWen platform; pricing/availability may differ from first-party Qwen models — always verify via `qianwen models info <id>`.

## Vision — Commercial

| Model ID | Context | Thinking | Key Info |
|----------|---------|----------|----------|
| qwen3-vl-plus | 262K | Yes (hybrid) | Best vision. Tiered pricing. Context cache supported. Max 16K tokens/image. (legacy, use qwen3.8-max/flash for new projects) |
| qwen3-vl-flash | 262K | Yes (hybrid) | Fast vision. Tiered pricing. Context cache supported. (legacy, use qwen3.8-max/flash for new projects) |
| qvq-max | 131K | Always-on CoT | Visual reasoning (math, charts). Max CoT 16K, response 8K. |
| qwen3.5-ocr | 65K | No | Latest OCR. PDF parsing, multi-turn, enhanced card/ID recognition. |
| qwen-vl-ocr | 38K | No | Legacy OCR specialist. Max 30K tokens/image. |
| qwen-vl-max | 131K | No | Best in Qwen2.5-VL series. |
| qwen-vl-plus | 131K | No | Qwen2.5-VL. Faster, good balance, 11 languages. |

## Omni — Commercial

| Model ID | Context | Thinking | Key Info |
|----------|---------|----------|----------|
| qwen3-omni-flash | 65K | Yes (hybrid) | Text/image/audio/video → text or speech. 49 voices, 10 languages. |
| qwen3.5-omni-plus | 262K | Yes (hybrid) | Latest omni. Text/image/audio/video input, text + audio output. Full Omni capabilities. |
| qwen3.5-omni-flash | 262K | Yes (hybrid) | Fast latest omni. Text/image/audio/video input, text + audio output. |
| qwen-omni-turbo | 32K | No | Legacy omni, max 2K output. Use qwen3-omni-flash instead. |
| qwen3-omni-flash-realtime | 128K | No | Streaming audio input + VAD. 49 voices, 10 languages. |
| qwen-omni-turbo-realtime | 32K | No | Legacy realtime. Use qwen3-omni-flash-realtime instead. |

## Translation — Commercial

| Model ID | Context | Key Info |
|----------|---------|----------|
| qwen-mt-plus | 16K | Highest quality. 92 languages. |
| qwen-mt-flash | 16K | Fast. |
| qwen-mt-lite | 16K | Cheapest. |
| qwen-mt-turbo | 16K | Balanced. |

## Image Generation

| Model ID | Key Info |
|----------|----------|
| qwen-image-3.0-pro | Latest flagship image model; high quality, strong text rendering, fused generation + multi-image editing |
| qwen-image-3.0 | Latest-generation image model; general-purpose generation + editing, strong text rendering |
| wan2.7-image-pro | **Multi-function** (4K support) — text-to-image, image editing (0–9 images), sequential multi-image, interactive editing (bbox), thinking mode, color palette. Max 4K for t2i, 2K for editing |
| wan2.7-image | **Multi-function** (faster) — same as pro but max 2K, no 4K support |
| wan2.6-t2i | Text-to-image, sync+async, best quality in wan2.6 series (legacy) |
| wan2.6-image | Image **editing** (NOT for pure text-to-image): style transfer, subject consistency (1–4 refs), interleaved text-image output, 2K. Requires reference_images or enable_interleave=true (legacy) |
| wan2.5-i2i-preview | Image editing: single-image editing, multi-image fusion (1–3 refs), subject consistency, async-only |
| wan2.5-t2i-preview | Flexible resolution text-to-image |
| wan2.2-t2i-flash | Fast text-to-image |
| wan2.2-t2i-plus | Quality text-to-image |
| qwen-image-2.0-pro | Fused generation + editing, text rendering, multi-image (1–3 input, 1–6 output) |
| qwen-image-2.0-pro-2026-06-22 | Latest snapshot: enhanced text rendering (1K token prompt), improved realism & semantic following |
| qwen-image-2.0 | Accelerated generation + editing |
| qwen-image-edit-max | Image editing, 1–6 output images |
| qwen-image-edit-plus | Image editing, 1–6 output images |
| qwen-image-edit | Image editing, 1 output image only |
| qwen-image-plus | Text-to-image, fixed resolutions, async only |
| qwen-image-max | Text-to-image, fixed resolutions |
| z-image-turbo | **Open-source SOTA T2I.** Sync-only; single text content; no `n`; no reference images. Parameters: `size`, `prompt_extend`, `seed`. |

## Video Generation

| Model ID | Key Info |
|----------|----------|
| wan2.7-t2v | Text-to-video, ratio control, auto-dubbing, 5000 char prompt, 720P/1080P |
| wan2.7-i2v | Image-to-video, unified media[] protocol: first/last frame, video continuation, audio sync |
| wan2.7-videoedit | **Video editing.** Uses `media[]` protocol with `{type:"video"|"reference_image", url}`. No `function` field. |
| wan2.7-r2v | Reference-to-video. Up to 5 mixed image/video refs, audio voice reference, 720P/1080P. |
| wan3.0-video | **Wan 3.0** unified video generation. Text/image-to-video with audio. |
| wan3.0-video-prime | **Wan 3.0 Prime** highest-quality video generation. Text/image-to-video with audio. |
| wan2.6-t2v | Text-to-video, audio, multi-shot, 2–15s |
| wan2.6-i2v / wan2.6-i2v-flash | Image-to-video, audio, multi-shot, 2–15s |
| wan2.6-r2v / wan2.6-r2v-flash | Reference-based, multi-character, 2–10s |
| wan2.2-kf2v-flash | First+last frame, 5s, silent |
| wanx2.1-vace-plus | Video editing (repainting, extension, outpainting), ≤5s, silent |
| happyhorse-1.1-t2v | **HappyHorse 1.1** text-to-video. 720P/1080P, 3–15s, with audio. Uses `resolution` + `ratio` parameters. |
| happyhorse-1.1-i2v | **HappyHorse 1.1** image-to-video. 720P/1080P, 3–15s, with audio. Uses `resolution` + `ratio` parameters. |
| happyhorse-1.1-r2v | **HappyHorse 1.1** reference-to-video. Multi-ref images, 720P/1080P, 3–15s, with audio. |
| happyhorse-1.0-t2v | HappyHorse 1.0 text-to-video. Uses `resolution` + `ratio` parameters. |
| happyhorse-1.0-i2v | HappyHorse 1.0 image-to-video. Uses `resolution` + `ratio` parameters. |
| happyhorse-1.0-r2v | HappyHorse 1.0 reference-to-video. Up to 9 reference images via `media[{type:"reference_image", url}]`. |
| happyhorse-1.0-video-edit | HappyHorse video editing. Same `media[]` protocol as wan2.7-videoedit. |

## TTS / ASR

| Model ID | Key Info |
|----------|----------|
| qwen-audio-3.0-tts-plus | **Highest quality.** Multi-language + Chinese dialects, instruction control, fine-grained tags. Professional scenarios. |
| qwen-audio-3.0-tts-flash | **Low-latency realtime.** Multi-language + Chinese dialects, instruction control. Realtime interaction. |
| cosyvoice-v3.5-plus | Ultra-high expressiveness. Voice clone + synthesis. 11 languages. Free-style instruction. |
| cosyvoice-v3.5-flash | High-performance TTS. Voice clone + synthesis. 11 languages. Reduced first-packet latency. |
| cosyvoice-v3-plus | CosyVoice v3 quality. Voice clone + synthesis. |
| cosyvoice-v3-flash | CosyVoice v3 fast. Voice clone + synthesis. |
| qwen3-tts-flash | Fast multi-language TTS |
| qwen3-tts-instruct-flash | Instruction-controlled TTS |
| qwen3-asr-flash | Real-time ASR |

## Embedding / Rerank

| Model ID | Key Info |
|----------|----------|
| text-embedding-v4 | Text embedding |
| qwen3-rerank | Reranking |

> **⚠️ Important**: The model list above is a **point-in-time snapshot** and may be outdated. Model availability
> changes frequently. **Always check the [official model list](https://www.qianwenai.com/models)
> for the authoritative, up-to-date catalog before making model decisions.**