# QianWen Model Pricing (China)

> **Source**: [Official pricing page](https://platform.qianwenai.com/docs/developer-guides/getting-started/pricing) — check for the latest rates.
>
> **Important**: This file provides a **structural overview** of model categories and billing units. Specific prices, free quota amounts, and availability are subject to change without notice. Always refer to the [official pricing page](https://platform.qianwenai.com/docs/developer-guides/getting-started/pricing) for authoritative, up-to-date pricing data.
>
> All prices in **CNY**.

## Text Generation (per 1M tokens)

**Commercial models**: qwen3.8-max, qwen3.8-flash, qwen3.7-max, qwen3.7-plus, qwen3.7-flash, qwen3.6-max-preview, qwen3.6-plus, qwen3.6-flash, qwen3-max, qwen3.5-plus, qwen3.5-flash, qwen-plus, qwen-flash, qwen-turbo, qwq-plus, qwen3-coder-next, qwen3-coder-plus, qwen3-coder-flash, qwen-plus-character, qwen-flash-character

**Open-source models**: qwen3.8-27b, qwen3.8-2.4t-a95b, qwen3.6-35b-a3b, qwen3.6-27b, qwen3.5-397b-a17b, qwen3.5-122b-a10b, qwen3.5-27b, qwen3.5-35b-a3b, qwen3-235b-a22b, qwen3-32b, qwen3-30b-a3b, qwen3-8b

**Third-party / Partner models**: deepseek-v4-pro-0813, deepseek-v4-pro, deepseek-v4-flash, deepseek-v4-flash-0731, glm-5.2, glm-5.1, kimi-k3, kimi-k2.7-code, kimi-k2.6, MiniMax-M2.5

> Third-party models are hosted on the QianWen platform but billed/maintained by their respective providers. Pricing tiers and free quotas may differ from first-party Qwen models. Always verify via `qianwen models info <id>` before estimating cost.

- Billing unit: **per 1M tokens** (input and output priced separately)
- Some models have **tiered pricing** based on input context length (e.g. ≤32K, ≤128K, ≤256K, ≤1M)
- Thinking mode output may be priced differently from non-thinking output
- **Batch API**: 50% off for supported models
- Some models may offer a limited free quota — **do not assume the user has remaining free quota**; use the **qianwen-usage** skill to check, or verify in the [QianWen console](https://platform.qianwenai.com/home/benefits)

For per-token pricing, see each model's detail page, e.g. [qwen3.8-max](https://www.qianwenai.com/models/qwen3.8-max).

## Vision Understanding (per 1M tokens)

**Models**: qwen3.6-plus (multimodal), qwen3-vl-plus, qwen3-vl-flash, qwen-vl-ocr, qvq-max

- Billing unit: **per 1M tokens**
- Tiered pricing by input context length for some models

## Omni Models (per 1M tokens)

**Models**: qwen3-omni-flash, qwen-omni-turbo

- Billing unit: **per 1M tokens**
- Separate rates for text input, audio input, image/video input, text output, and audio output

## Image Generation (per image)

**Wan series**: wan2.7-image-pro, wan2.7-image, wan2.6-t2i, wan2.5-t2i-preview, wan2.2-t2i-flash, wan2.2-t2i-plus, wan2.5-i2i-preview, wan2.6-image

**Qwen Image series**: qwen-image-2.0-pro, qwen-image-2.0-pro-2026-06-22, qwen-image-2.0, qwen-image-edit-max, qwen-image-edit-plus, qwen-image-edit, qwen-image-plus, qwen-image-max

**Other**: z-image-turbo

- Billing unit: **per image generated**
- Multi-image output (n > 1) is billed per image

## Video Generation (per second)

**Wan series**: wan2.7-t2v, wan2.7-i2v, wan2.7-videoedit, wan2.6-t2v, wan2.6-i2v-flash, wan2.6-i2v, wan2.6-r2v-flash, wan2.6-r2v, wan2.5-t2v-preview, wan2.5-i2v-preview, wan2.2-t2v-plus, wan2.2-i2v-flash, wan2.2-i2v-plus, wan2.2-kf2v-flash, wanx2.1-vace-plus

**HappyHorse series**: happyhorse-1.1-t2v, happyhorse-1.1-i2v, happyhorse-1.1-r2v, happyhorse-1.0-t2v, happyhorse-1.0-i2v, happyhorse-1.0-r2v, happyhorse-1.0-video-edit

- Billing unit: **per second of generated video**
- Price varies by resolution (480P / 720P / 1080P)
- Audio-enabled models may have different rates than silent variants
- Video editing models (`wan2.7-videoedit`, `happyhorse-1.0-video-edit`) bill on the **output** video duration

For per-second pricing, see each model's detail page, e.g. [wan2.7-t2v](https://www.qianwenai.com/models/wan2.7-t2v).

## Speech Synthesis / TTS (per 10K characters)

**Models**: qwen-audio-3.0-tts-plus, qwen-audio-3.0-tts-flash, qwen3-tts-flash, qwen3-tts-instruct-flash, qwen3-tts-flash-realtime, qwen3-tts-instruct-flash-realtime, cosyvoice-v3.5-plus, cosyvoice-v3.5-flash, cosyvoice-v3-plus, cosyvoice-v3-flash

- Billing unit: **per 10,000 characters**

For per-character pricing, see each model's detail page, e.g. [qwen-audio-3.0-tts-plus](https://www.qianwenai.com/models/qwen-audio-3.0-tts-plus).

## Speech Recognition / ASR (per second of audio)

**Models**: qwen3-asr-flash, qwen3-asr-flash-filetrans, qwen3-asr-flash-realtime, fun-asr, fun-asr-realtime

- Billing unit: **per second of audio**

## Text Embedding (per 1M tokens)

**Models**: text-embedding-v4, text-embedding-v3

- Billing unit: **per 1M input tokens**

## Multimodal Embedding (per 1M tokens)

**Models**: tongyi-embedding-vision-plus, tongyi-embedding-vision-flash

- Billing unit: **per 1M input tokens**

## Text Rerank (per 1M tokens)

**Models**: qwen3-rerank

- Billing unit: **per 1M input tokens**

## Translation (per 1M tokens)

**Models**: qwen-mt-plus, qwen-mt-flash, qwen-mt-lite, qwen-mt-turbo

- Billing unit: **per 1M tokens** (input and output priced separately)

## Notes

- **API Key must be created from the** [QianWen Console](https://platform.qianwenai.com/home/api-keys).
- **Free quota**: Some models include a limited free quota after activating QianWen. **However**: free quota amounts, eligibility, and validity periods are subject to change without notice. Quotas may have already been consumed or expired. **Never assume the user has remaining free quota** — always present the paid unit price as the primary reference. Use the **qianwen-usage** skill to check remaining free tier quota, or direct the user to the [QianWen console](https://platform.qianwenai.com/home/benefits).
- **Batch calling**: Supported models get 50% off (both input and output).
- **Context cache**: Eligible models get input token discounts.
- **Tiered pricing**: Some models have higher per-token cost as input length increases.
- **For the latest prices**: Always check the [official pricing page](https://platform.qianwenai.com/docs/developer-guides/getting-started/pricing).
- **View actual usage and bills**: Use the **qianwen-usage** skill (standard `sk-` keys only), or visit the console: [Usage Analytics](https://platform.qianwenai.com/home/analytics) | [Pay-as-you-go Billing](https://platform.qianwenai.com/home/billing/pay-as-you-go) | [Token Plan Subscription](https://platform.qianwenai.com/home/billing/subscription/token-plan).
