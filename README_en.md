<!-- <p align="center">
  <img src="[./assets/logo.png](https://www.qianwenai.com/)" width="160" alt="QianWen AI Skills" /> 
</p> -->

<h1 align="center">QianWen AI Skills</h1>

<p align="center">
  Fold QianWen's AI skills into your agent. Just talk.
</p>

<p align="center">
  <a href="https://github.com/QianWen-AI/qianwen-ai/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://github.com/QianWen-AI/qianwen-ai/stargazers"><img src="https://img.shields.io/github/stars/QianWen-AI/qianwen-ai?style=social" alt="Stars" /></a>
  <a href="https://agentskills.io"><img src="https://img.shields.io/badge/Agent%20Skills-compatible-brightgreen.svg" alt="Agent Skills" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-blue.svg" alt="Node.js" /></a>
</p>

<p align="center">
  <a href="./README.md">中文</a>
</p>

---

## Highlights

- 🤖 **Agent-native** — Your agent picks the model, tunes the call, and handles errors. You just talk.
- ⚡ **One-line install** — One command and you're ready. No SDK, no boilerplate.
- 🧠 **10 skills, one interface** — Text, image, video, voice, vision, model selection, auth, usage, payment, and skill discovery — all built in.
- 🌐 **Works across many agents** — Plug into many [Agent Skills](https://agentskills.io)-compatible agents instantly.

<p align="center">
  <a href="https://claude.com/claude-code"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/claudecode-color.svg" height="22" title="Claude Code" alt="Claude Code"/></a>
  &nbsp;
  <a href="https://www.cursor.com"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/cursor.svg" height="22" title="Cursor" alt="Cursor"/></a>
  &nbsp;
  <a href="https://github.com/google-gemini/gemini-cli"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/gemini-color.svg" height="22" title="Gemini CLI" alt="Gemini CLI"/></a>
  &nbsp;
  <a href="https://chatgpt.com/codex"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/codex-color.svg" height="22" title="Codex" alt="Codex"/></a>
  &nbsp;
  <a href="https://cline.bot"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/cline.svg" height="22" title="Cline" alt="Cline"/></a>
  &nbsp;
  <a href="https://antigravity.google/"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/antigravity-color.svg" height="22" title="Antigravity" alt="Antigravity"/></a>
  &nbsp;
  <a href="https://sourcegraph.com/amp"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/amp-color.svg" height="22" title="Amp" alt="Amp"/></a>
  &nbsp;
  <a href="https://manus.im"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/manus.svg" height="22" title="Manus" alt="Manus"/></a>
  &nbsp;
  <a href="https://qwen.ai/qwencode"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/qwen-color.svg" height="22" title="Qwen Code" alt="Qwen Code"/></a>
  &nbsp;
  <a href="https://qoder.com"><img src="./assets/qoder-favicon.svg" height="22" title="Qoder" alt="Qoder"/></a>
  &nbsp;
  <a href="https://github.com/opencode-ai/opencode"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/opencode.svg" height="22" title="opencode" alt="opencode"/></a>
  &nbsp;
  <a href="https://www.openclaw.ai"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/openclaw-color.svg" height="22" title="OpenClaw" alt="OpenClaw"/></a>
  &nbsp;
  <a href="https://roocode.com"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/roocode.svg" height="22" title="RooCode" alt="RooCode"/></a>
  &nbsp;
  <a href="https://kilo.ai"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/kilocode.svg" height="22" title="Kilo Code" alt="Kilo Code"/></a>
  &nbsp;
  <a href="https://windsurf.com"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/windsurf.svg" height="22" title="Windsurf" alt="Windsurf"/></a>
  &nbsp;
  <a href="https://github.com/All-Hands-AI/OpenHands"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/openhands-color.svg" height="22" title="OpenHands" alt="OpenHands"/></a>
  &nbsp;
  <a href="https://github.com/block/goose"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/goose.svg" height="22" title="Goose" alt="Goose"/></a>
  &nbsp;
  <a href="https://www.trae.ai"><img src="https://unpkg.com/@lobehub/icons-static-svg@latest/icons/trae-color.svg" height="22" title="TRAE" alt="TRAE"/></a>
  &nbsp;
  <a href="https://kiro.dev"><img src="./assets/kiro.svg" height="22" title="Kiro" alt="Kiro"/></a>
  &nbsp;
  <a href="https://devin.ai"><img src="./assets/devin.png" height="22" title="Devin" alt="Devin"/></a>
  &nbsp;
  <a href="https://www.augmentcode.com"><img src="./assets/augment.png" height="22" title="Augment Code" alt="Augment Code"/></a>
</p>

---

## Quick Start

### Manual Install

Requires Node.js 18+.

```bash
npx skills add QianWen-AI/qianwen-ai
```

When prompted, press `a` to select all skills, then Enter to confirm.

### Let Your Agent Handle It (Recommended)

Paste this into your AI Agent and let it handle everything:

```
Please install QianWen AI Skills for me:
1. Check if Node.js is installed, install it if not
2. Run: npx skills add QianWen-AI/qianwen-ai
3. If a skill selection prompt appears, select all skills and confirm
4. Once installed, start with "Skills acquired." then list what skills I got and walk me through what I can do with them
```

Once installed, the `qianwen-ops-auth` skill will guide you and your agent through API Key setup automatically.

---

## What You Can Do

Tell your agent what you need — it writes the code, picks the right QianWen model, and runs the job.

| Capability | Try saying... |
|------------|---------------|
| **Text at Scale** | "Write a script to call Qwen-Plus and polish the language in these 10,000 docs" · "Batch-summarize every PDF in this folder using the cheapest text model" |
| **Image Generation** | "Generate 20 product posters in different styles — try ink wash, flat, and 3D" · "Write a pipeline to add watermarks and expand the background of all images in /assets" |
| **Video Generation** | "Turn each of these 5 product shots into a 5-second showcase clip" · "Generate a cinematic intro video from this script and key frame" |
| **Voice** | "Convert all 30 chapters of this audiobook to speech, use a warm female voice" · "Generate bilingual audio intros for each episode in this podcast list" |
| **Vision** | "Write a script to extract text from every screenshot in this folder and save to an Excel" · "Batch-analyze these 200 floor plan images and output a room-by-room breakdown" |
| **Model Selection** | "Pick the cheapest model that can handle this translation batch" · "Choose a stronger reasoning model for this problem" |
| **Usage & Billing** | "Check my remaining free tier quota for qwen3.6-plus" · "Show me the cost breakdown for last month" · "Am I close to hitting my coding plan limits?" |

---

## Skills

| Skill | What it does |
|-------|-------------|
| `qianwen-text` | Text generation, chat, code, reasoning, function calling |
| `qianwen-vision` | Image & video understanding, OCR, chart analysis |
| `qianwen-image-generation` | Text-to-image, image editing, style transfer |
| `qianwen-video-generation` | Text-to-video, image-to-video, video editing |
| `qianwen-audio-tts` | Text-to-speech with multiple voice profiles |
| `qianwen-model-selector` | Recommends the right model for your use case |
| `qianwen-ops-auth` | API key and authentication management |
| `qianwen-usage` | Usage queries, free tier checks, subscriptions, billing |
| `qianwen-payment` | Payment center — account balance, account balance recharge, recharge guidance |
| `qianwen-find-skills` | Discover, compare, and install QianWen Agent Skills for a task |

---

## Contributing

We'd love your help! Here are a few ways to get involved:

- **Report bugs** — Something broke? [Open an issue](https://github.com/QianWen-AI/qianwen-ai/issues) with steps to reproduce.
- **Suggest features** — Have an idea for a new skill or improvement? File a feature request.
- **Submit PRs** — Fork the repo, create a branch, make your changes, and open a pull request.
- **Improve docs** — Typos, unclear wording, better examples — all welcome.

---

> **Disclaimer** — This skill calls QianWen APIs on your behalf; usage costs are billed to your account. AI-generated content may not always be accurate — review before relying on it. Keep your API Key secure. This project is provided as-is, without warranties of any kind.

## License

[Apache 2.0](./LICENSE)
