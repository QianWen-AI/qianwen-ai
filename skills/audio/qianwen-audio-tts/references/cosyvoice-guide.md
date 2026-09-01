# CosyVoice TTS Guide

CosyVoice models use **WebSocket API** (real-time) or **HTTP NRT API** (non-real-time). The bundled script calls the PAYG HTTP NRT API directly and uses the DashScope SDK for WebSocket requests.

## Models

| Model | API | Use Case | Voice Support | Instruction Control |
|-------|-----|----------|---------------|---------------------|
| `cosyvoice-v3-flash` | WebSocket / HTTP NRT | High quality, fast | System voices (80+ built-in) | ✓ |
| `cosyvoice-v3-plus` | WebSocket / HTTP NRT | Highest quality | System voices (80+ built-in) | — |
| `cosyvoice-v3.5-flash` | WebSocket / HTTP NRT | High-performance, multi-language (11 langs) | ⚠️ Custom voices only | ✓ |
| `cosyvoice-v3.5-plus` | WebSocket / HTTP NRT | Ultra-expressive, multi-language (11 langs) | ⚠️ Custom voices only | ✓ |

> **⚠️ Important**: `cosyvoice-v3.5-flash` and `cosyvoice-v3.5-plus` do **NOT** support any system voices (longanyang, longanhuan, etc.). You must provide a custom voice ID created via Voice Cloning or Voice Design before using these models.

### CosyVoice v3.5 vs v3

| Feature | v3.5 | v3 |
|---------|------|----|
| System voice support | ✖ (custom voices only) | ✓ (80+ built-in voices) |
| Instruction control (`instruction` param) | ✓ (both flash & plus) | ✓ (flash only) |
| Languages | 11 (zh, en, de, fr, ru, ja, ko, pt, th, id, vi) | 10 |
| First-packet latency | Significantly reduced | Standard |
| Pronunciation accuracy | Enhanced | Good |
| Prosody and audio quality | Improved | Good |
| Voice cloning fidelity | Enhanced (high similarity) | Good |
| Voice design | ✓ | ✓ |
| Free-style instruction | ✓ | Limited |

> **Key upgrade**: CosyVoice v3.5 supports **free-style instruction control** for both flash and plus variants — use natural language to describe dialect, emotion, speaking pace, or character personality. Also supports voice cloning and voice design with improved speaker similarity.
>
> **⚠️ Prerequisite for v3.5**: You **must** first create a custom voice via [Voice Cloning](https://platform.qianwenai.com/docs/developer-guides/speech/voice-cloning) or Voice Design before using v3.5 models. System voices (longanyang, longanhuan, longhuhu_v3, etc.) will return HTTP 418 errors with v3.5.

## Prerequisites

- **DashScope SDK** (venv recommended):
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate  # Windows: .venv\Scripts\activate
  pip install dashscope>=1.25.17
  ```
- **API Key**: Same as Qwen TTS (`DASHSCOPE_API_KEY` or `QIANWEN_API_KEY`)

> **SDK version**: The bundled script requires `dashscope>=1.25.17` for its WebSocket path. PAYG HTTP NRT requests use the public HTTP API directly.

## Run Script

**Discovery:** `python3 <this-skill-dir>/scripts/tts_cosyvoice.py --help`

```bash
python3 scripts/tts_cosyvoice.py --text "Hello, world!"
```

| Argument | Description |
|----------|-------------|
| `--text`, `-t` | **Required** — text to synthesize |
| `--model`, `-m` | Model ID (default: `cosyvoice-v3-flash`) |
| `--voice`, `-v` | Voice ID (default: `longanyang`) |
| `--output`, `-o` | Output file (default: `output/qianwen-audio-tts/cosyvoice.mp3`) |
| `--format`, `-f` | Audio format: mp3, wav, pcm (default: mp3) |
| `--instruction` | Free-style instruction for speech control (v3.5 and v3-flash) |
| `--language-hints` | Target language hint (e.g. `zh`, `en`) |

## Available Voices

> **Note**: The system voices below are only available for `cosyvoice-v3-flash` and `cosyvoice-v3-plus`. They are **NOT** supported by v3.5 models.

| Voice | Description |
|-------|-------------|
| longanyang | Sunny young man (male) |
| longanhuan | Energetic cheerful female |
| longhuhu_v3 | Innocent lively girl |

> See [voice-list](https://platform.qianwenai.com/docs/api-reference/speech-synthesis/voice-list) for full list.

## Examples

```bash
# Basic synthesis (v3, default — system voice)
python3 scripts/tts_cosyvoice.py -t "Hello, world!"

# Chinese with specific voice (v3)
python3 scripts/tts_cosyvoice.py -t "你好世界" -v longanhuan

# CosyVoice v3.5 (requires custom voice ID)
python3 scripts/tts_cosyvoice.py -t "Professional narration" -m cosyvoice-v3.5-plus -v <your-custom-voice-id>

# With instruction control (v3.5 + custom voice)
python3 scripts/tts_cosyvoice.py -t "欢迎光临我们的店铺" -m cosyvoice-v3.5-flash -v <id> --instruction "用热情洋溢的声音，语速稍快"

# Legacy v3 models still supported
python3 scripts/tts_cosyvoice.py -t "Hello" -m cosyvoice-v3-plus

# Multiple files (use --output to avoid overwriting)
python3 scripts/tts_cosyvoice.py -t "First sentence" -o output/qianwen-audio-tts/part1.mp3
python3 scripts/tts_cosyvoice.py -t "Second sentence" -o output/qianwen-audio-tts/part2.mp3
```

> **Tip**: Default output overwrites previous file. Use `-o` with different filenames for batch tasks.

> **Note**: Qwen-Audio-TTS models (`qwen-audio-3.0-tts-plus` / `qwen-audio-3.0-tts-flash`) are handled by `scripts/tts.py` — see `SKILL.md` or `api-guide.md` for usage.

## Error Handling

| Error Pattern | Resolution |
|---------------|------------|
| `dashscope SDK not installed` | Run `pip install dashscope>=1.25.17` |
| `does not support system voices` | v3.5 models require a custom voice ID. Create one via Voice Cloning or Voice Design on the platform. |
| `WebSocket connection failed` | Check network; verify API key |
| `Invalid voice` | Use CosyVoice voices, not Qwen TTS voices (Cherry, Ethan, etc.). Each model has its own voice set — do not mix. |
| `InvalidParameter` / `Engine error [411]` | Voice not supported by the selected model. Check voice list for your model. |
| `HTTP 418` | System voice used with v3.5 model. Switch to v3 or provide a custom voice ID. |

## Character Counting & Billing

CosyVoice v3.5 models are billed per character:

- Chinese characters = **2 characters**
- Other characters (punctuation, letters, digits) = **1 character**
- SSML tags are **not counted**

| Model | Pricing |
|-------|--------|
| `cosyvoice-v3.5-flash` | [See pricing](https://www.qianwenai.com/models/cosyvoice-v3.5-flash) |
| `cosyvoice-v3.5-plus` | [See pricing](https://www.qianwenai.com/models/cosyvoice-v3.5-plus) |
