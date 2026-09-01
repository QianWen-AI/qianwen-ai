# Qwen Audio TTS — API Supplementary Guide

> **Content validity**: 2026-08 | **Sources**: [TTS API](https://platform.qianwenai.com/docs/api-reference/speech-synthesis/qwen-tts) · [TTS Guide](https://platform.qianwenai.com/docs/developer-guides/speech/tts) · [Voice List](https://platform.qianwenai.com/docs/api-reference/speech-synthesis/voice-list) · [TTS Models](https://platform.qianwenai.com/docs/developer-guides/speech/tts-models)

---

## Definition

Text-to-speech synthesis service that produces natural, human-like voices. Supports **16+ system voices**, 10 languages, streaming real-time playback, **natural language instruction control** for tone and emotion, and custom voices via **voice cloning** (from audio samples) and **voice design** (from text descriptions). The key differentiator is the `instructions` parameter, which uses natural language to precisely control speech rate, emotion, and character personality.

---

## Use Cases

| Scenario | Recommended Model | Notes |
|----------|------------------|-------|
| General speech synthesis / announcements | `qwen3-tts-flash` | Fast, multi-language, billed per character. |
| Audiobooks / game dubbing / radio dramas | `qwen3-tts-instruct-flash` | Control emotion, rate, and character via `instructions`. |
| High-quality professional TTS | `qwen-audio-3.0-tts-plus` | **Default**. Instruction control, voice cloning, multi-language. TP + PAYG. |
| Low-latency real-time interaction | `qwen-audio-3.0-tts-flash` | PAYG-only; instruction control, voice cloning, optimized for speed. Specify `--model` explicitly. |
| High-performance multi-language TTS | `cosyvoice-v3.5-flash` | Instruction control, 11 languages. Custom voices only. |
| Ultra-expressive multi-language TTS | `cosyvoice-v3.5-plus` | Instruction control, 11 languages. Custom voices only. |
| Brand voice customization (from text description) | `qwen3-tts-vd-2026-01-26` | Design a new voice from a text description without audio samples. |
| Brand voice customization (from audio sample) | `qwen3-tts-vc-2026-01-22` | Clone a voice from audio samples with high fidelity. |
| Navigation / notifications | `qwen3-tts-flash` | Short text, high frequency, low cost. |

---

## Key Usage

### Non-streaming Synthesis

```python
import os, dashscope

dashscope.base_http_api_url = 'https://dashscope.aliyuncs.com/api/v1'

resp = dashscope.MultiModalConversation.call(
    model="qwen3-tts-flash",
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    text="Today is a wonderful day to build something people love!",
    voice="Cherry",
    language_type="English",
)
print(resp.output.audio.url)  # Audio URL, valid for 24 hours
```

### Streaming Synthesis (real-time playback)

```python
resp = dashscope.MultiModalConversation.call(
    model="qwen3-tts-flash",
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    text="Today is a wonderful day to build something people love!",
    voice="Cherry",
    language_type="English",
    stream=True,
)
for chunk in resp:  # Each chunk contains Base64-encoded audio data
    print(chunk)
```

### Instruction Control (Instruct model only)

Use natural language to describe the desired speech style:

```python
resp = dashscope.MultiModalConversation.call(
    model="qwen3-tts-instruct-flash",
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    text="Welcome to our grand opening! We have amazing deals waiting for you!",
    voice="Cherry",
    instructions="Fast speech rate, with a clear rising intonation, suitable for introducing fashion products.",
    optimize_instructions=True,
)
```

### Instruction Control (CosyVoice v3.5 / Qwen-Audio-TTS)

CosyVoice v3.5 and Qwen-Audio-TTS models support free-style instruction control via the `instruction` parameter (note: singular, not plural). Use natural language to describe dialect, emotion, pace, or character.

> **⚠️ v3.5 models** (`cosyvoice-v3.5-flash`, `cosyvoice-v3.5-plus`) do **NOT** support system voices. You must provide a custom voice ID created via Voice Cloning or Voice Design.

> **Supported models for `instruction`**: `cosyvoice-v3.5-plus`, `cosyvoice-v3.5-flash`, `cosyvoice-v3-flash`, `qwen-audio-3.0-tts-plus`, `qwen-audio-3.0-tts-flash`.

### System Voice List

| voice Parameter | Gender | Description | Supported Models |
|----------------|--------|-------------|-----------------|
| `Cherry` | Female | Sunny, positive, friendly, and natural | Instruct + Flash + Qwen-TTS |
| `Serena` | Female | Gentle | Instruct + Flash + Qwen-TTS |
| `Ethan` | Male | Sunny, warm, energetic, and vibrant | Instruct + Flash + Qwen-TTS |
| `Chelsie` | Female | Two-dimensional virtual girlfriend | Instruct + Flash + Qwen-TTS |
| `Momo` | Female | Playful and mischievous | Instruct + Flash |
| `Vivian` | Female | Confident, cute, and slightly feisty | Instruct + Flash |
| `Moon` | Male | Bold and handsome | Instruct + Flash |
| `Maia` | Female | A blend of intellect and gentleness | Instruct + Flash |
| `Kai` | Male | A soothing audio spa for your ears | Instruct + Flash |
| `Nofish` | Male | A designer who cannot pronounce retroflex sounds | Instruct + Flash |
| `Bella` | Female | Playful little girl | Instruct + Flash |
| `Jennifer` | Female | Premium, cinematic-quality American English | Flash only |
| `Ryan` | Male | Full of rhythm, bursting with dramatic flair | Flash only |
| `Katerina` | Female | A mature-woman voice with rich, memorable rhythm | Flash only |
| `Aiden` | Male | An American English young man | Flash only |
| `Eldric Sage` | Male | A calm and wise elder | Flash only |

All voices support: Chinese (Mandarin), English, French, German, Russian, Italian, Spanish, Portuguese, Japanese, Korean.

### Voice Cloning (quick example)

```python
import requests

# Step 1: Upload audio sample and create a voice
url = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization"
resp = requests.post(url,
    headers={"Authorization": f"Bearer {os.getenv('DASHSCOPE_API_KEY')}"},
    files={"file": open("voice_sample.mp3", "rb")},
    data={"model": "qwen-voice-enrollment", "target_model": "qwen3-tts-vc-2026-01-22",
          "action": "create", "preferred_name": "my_brand_voice"})
custom_voice = resp.json()["output"]["voice"]

# Step 2: Use the cloned voice for synthesis
resp = dashscope.MultiModalConversation.call(
    model="qwen3-tts-vc-2026-01-22",  # Must match target_model
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    text="Hello, this is a test with a cloned voice.",
    voice=custom_voice,
)
```

### Key Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `model` | Yes | Model ID. |
| `text` | Yes | Text to synthesize. qwen3-tts-flash: max 600 characters. Qwen-TTS: max 512 tokens. |
| `voice` | Yes | System voice ID, or cloned/designed voice name. |
| `language_type` | No | Default: `Auto`. Specifying the exact language significantly improves synthesis quality over `Auto`. Supported: `Chinese`, `English`, `Japanese`, `Korean`, `French`, `German`, `Russian`, `Italian`, `Spanish`, `Portuguese`. |
| `instructions` | No | Natural language instructions for speech control. Max 1,600 tokens. Chinese and English only. **Qwen3-TTS-Instruct-Flash only.** |
| `optimize_instructions` | No | When true, the system semantically enhances `instructions` for better naturalness. Requires `instructions` to be set. Default: false. |
| `stream` | No | `false` = returns audio URL. `true` = streams Base64-encoded audio chunks. |

### Key Parameters (CosyVoice v3.5 / Qwen-Audio-TTS NRT — HTTP API)

| Parameter | Required | Description |
|-----------|----------|-------------|
| `model` | Yes | Model ID: `cosyvoice-v3.5-flash`, `cosyvoice-v3.5-plus`, `qwen-audio-3.0-tts-plus`, `qwen-audio-3.0-tts-flash`, `cosyvoice-v3-flash`, `cosyvoice-v3-plus` |
| `text` | Yes | Text to synthesize. Max 20,000 characters per call. |
| `voice` | Yes | Voice ID (model-specific). See [Qwen-Audio-TTS voice list](https://platform.qianwenai.com/docs/api-reference/speech-synthesis/qwen-audio-tts/voice-list) and [CosyVoice voice list](https://platform.qianwenai.com/docs/api-reference/speech-synthesis/cosyvoice/voice-list). |
| `instruction` | No | Free-style natural language instruction for speech control (dialect, emotion, pace, character). Supported by v3.5 and Qwen-Audio-TTS models. |
| `language_hints` | No | Target language hint list, e.g. `["zh"]`. Supported: `zh`, `en`, `fr`, `de`, `ja`, `ko`, `ru`, `pt`, `th`, `id`, `vi`, `es`, `it`, `ms`, `fil`, `ar`. |
| `format` | No | Audio format: `mp3` (default), `wav`, `pcm`, `opus`. |
| `sample_rate` | No | Sample rate (Hz): 8000, 16000, 22050 (default), 24000, 44100, 48000. |
| `stream` | No | `false` = returns audio URL. `true` = streams audio data chunks via iterator. |

---

## Important Notes

1. **Audio URLs are valid for only 24 hours.** Download immediately after generation.
2. **Specifying `language_type` significantly outperforms `Auto`.** When the text is in a single language, setting the exact language improves pronunciation accuracy and naturalness.
3. **`instructions` only works with the Instruct model.** The parameter is exclusive to `qwen3-tts-instruct-flash`. It has no effect on other models.
4. **Voice cloning `target_model` must match the synthesis `model`.** Otherwise synthesis fails.
5. **`SpeechSynthesizer` has been unified to `MultiModalConversation`.** In the DashScope Python SDK, the old `SpeechSynthesizer` interface has been replaced by `MultiModalConversation`. Parameters are fully compatible; only the interface name needs to change.
6. **Qwen-TTS (legacy) is not available in cn-beijing.** Use `qwen3-tts-flash` or `qwen3-tts-instruct-flash` instead.
7. **Streaming via HTTP** requires the header `X-DashScope-SSE: enable`. The Java SDK uses the `streamCall` interface.

---

## FAQ

**Q: How do I choose between qwen3-tts-flash and qwen3-tts-instruct-flash?**
A: Use flash for straightforward synthesis (announcements, navigation, reading aloud). Use instruct-flash when you need to control emotion, tone, and character expressiveness (audiobooks, dubbing). For the latest pricing comparison, see the [official pricing page](https://platform.qianwenai.com/docs/developer-guides/getting-started/pricing).

**Q: What is the difference between CosyVoice v3.5 and v3?**
A: CosyVoice v3.5 adds free-style instruction control (`instruction` parameter), reduces first-packet latency, improves pronunciation accuracy and prosody, and expands language support to 11 languages (Chinese, English, German, French, Russian, Japanese, Korean, Portuguese, Thai, Indonesian, Vietnamese). The v3.5-plus variant offers ultra-high expressiveness, while v3.5-flash prioritizes performance.

**Q: How do I use CosyVoice v3.5 or Qwen-Audio-TTS for non-real-time synthesis?**
A: Run `scripts/tts_cosyvoice.py`. For PAYG NRT models, the script calls the public HTTP API directly. Token Plan keys are **not** supported by `tts_cosyvoice.py` (it will reject them); Token Plan users should use `tts.py --model qwen-audio-3.0-tts-plus` instead. See the [cosyvoice-guide.md](cosyvoice-guide.md) for full details.

**Q: How do I make synthesized speech sound more natural?**
A: (1) Set `language_type` to match the text language. (2) Use the instruct model with `instructions` describing the desired style. (3) Enable `optimize_instructions=True` to let the system enhance the instructions.

**Q: What is the difference between voice cloning and voice design?**
A: Cloning (VC) replicates a voice from an audio sample — suitable for reproducing an existing voice. Design (VD) creates a new voice from a text description — suitable for designing brand voices from scratch.

**Q: What is the maximum text length per synthesis call?**
A: qwen3-tts-flash supports up to 600 characters. Qwen-TTS supports up to 512 tokens. For longer text, split into segments and concatenate the audio files.

**Q: How do I achieve real-time audio playback?**
A: Set `stream=True`. The Python SDK returns a generator; iterate over it to receive Base64-encoded audio chunks for decoding and playback.
