# Workflow Recommendations

When user requirements exceed a single mode's limits, **suggest combining modes or switching to a more capable model** before starting. Ask the user to confirm the approach.

## Duration > 5s

kf2v (first+last frame) and vace are capped at **5s**. If the user wants a longer video:

1. **Preferred**: Use **happyhorse-1.1-t2v** (default, 3–15s, TP+PAYG) or **happyhorse-1.1-i2v** (3–15s) which natively support longer durations with audio. Alternatively, **wan2.6-t2v** (up to 15s) or **wan2.6-i2v** (up to 15s) also support longer durations. If the user has a first frame image, i2v is a direct replacement for kf2v with longer duration support.
2. **If kf2v is essential** (user needs both first AND last frame control): Generate the 5s kf2v video first, then extend it using **vace `video_extension`** — trim the kf2v output to a ≤3s tail clip and use it as `first_clip_url` to generate the next 5s segment. Repeat for additional segments, then concatenate all segments (see [merge-media.md](merge-media.md)).
3. **For any mode**: To produce videos >15s, chain multiple generations — use the last frame or tail clip of each segment as input for the next. Concatenate final segments (see [merge-media.md](merge-media.md)). Inform the user this is a multi-step workflow.

## Improving kf2v Image Fidelity

kf2v generates a 5s transition between first and last frames. By design the model **interpolates motion** between the two frames — it respects the visual content of both frames but heavily relies on the prompt to determine *how* the transition happens. If generated video doesn't match the input images well:

1. **Turn off `prompt_extend`** — Smart rewriting can drift from original intent. Set `"prompt_extend": false` to keep the model closer to your literal description.
2. **Write transition-focused prompts** — Instead of describing static scenes, describe the *motion/change*: "camera gradually rises from eye level", "person slowly turns around". The prompt should bridge the visual gap between the two frames.
3. **Minimize visual difference** between frames — If first and last frame are radically different (different scene, different character), the model may produce artifacts. Keep frames within the same scene/subject.
4. **Use higher resolution** — `"resolution": "1080P"` (wan2.2-kf2v-flash) produces more detail-faithful output than 480P/720P.
5. **Consider alternatives when image fidelity matters most**:
   - **i2v (wan2.6-i2v)** — Uses only the first frame but respects it more faithfully, supports up to 15s + audio. Best when the starting image must be preserved exactly.
   - **vace `image_reference`** — Lets you mark images as subject (`obj`) or background (`bg`), giving explicit control over how each image is referenced.
   - **r2v** — For character-consistent multi-reference. Preserves character identity across scenes.

## Audio Needed but Mode is Silent-Only

kf2v and vace produce **silent video only**. If the user also wants audio:

1. **Switch mode**: If the user can relax the first+last frame constraint, recommend **happyhorse-1.1-i2v** (default, first-frame + audio, 3–15s, TP+PAYG) or **happyhorse-1.1-t2v** (text + audio, 3–15s). Alternatively, **wan2.6-i2v** (first-frame + audio, up to 15s) or **wan2.6-t2v** (text + audio, up to 15s) also support `audio_url` for custom audio or auto-dubbing.
2. **Post-process**: Generate the silent video first, then add an audio track (see [merge-media.md](merge-media.md) for ffmpeg/moviepy recipes), or use a separate TTS step (see **qianwen-audio-tts** for speech synthesis) to generate the audio file first.
3. **Always inform the user** about the silent limitation before generating, and propose the alternative.

## Multi-Shot Narrative (Cinematic Storytelling)

wan2.6 models (t2v, i2v, r2v) natively support **multi-shot** video — multiple camera angles and scenes in a single generation, up to 15s. This is the recommended approach for cinematic storytelling.

**How to use:**

1. Set `shot_type: "multi"` AND `prompt_extend: true` in the request.
2. Structure the prompt using `第N个镜头[Xs-Ys]` format (Chinese) or describe sequential scenes clearly:

```
第1个镜头[0-3秒] 雨夜街头，侦探快步前行，镜头从远处跟随。
第2个镜头[3-5秒] 侦探推开老旧建筑的大门，镜头推近特写。
第3个镜头[5-8秒] 室内昏暗灯光下，侦探发现一封信，低头阅读。
```

3. For multi-character stories, combine with **r2v** mode: provide reference videos/images for each character, use `character1`/`character2` in prompt.

**Limits:** Single generation max 15s. For longer narratives, generate multiple multi-shot segments and chain them (use the last frame of segment N as the first frame of segment N+1 via i2v).

## VACE Post-Processing Pipeline

VACE functions can be chained as **post-processing steps** after initial video generation. Common pipelines:

| Pipeline | Steps | Use case |
|----------|-------|----------|
| Generate + Extend | t2v/i2v → vace `video_extension` (×N) | Make a 5s video into 10s, 15s, ... |
| Generate + Outpaint | t2v/i2v → vace `video_outpainting` | Expand 16:9 to 9:16 (horizontal to vertical) |
| Generate + Edit | t2v/i2v → vace `video_edit` | Replace a character or remove an object |
| Generate + Repaint | t2v/i2v → vace `video_repainting` | Change art style while keeping motion |
| kf2v + Extend + Audio | kf2v → vace `video_extension` → concatenate segments → add audio | Controlled transition, longer, with sound |

**Chaining rules:**
- Each VACE step outputs ≤5s, 720P, silent video.
- For `video_extension`: input clip must be ≤3s. If extending a 5s video, trim the last 2-3s to prepare `first_clip_url` (see [merge-media.md](merge-media.md)).
- Download each intermediate video (URL expires in 24h) before feeding it to the next step.
- After all segments are generated, concatenate them and optionally overlay audio (see [merge-media.md](merge-media.md)).
- Inform the user of the full plan and get confirmation before starting a multi-step pipeline.

## Complex Multi-Step Video Projects

For requests like "generate a kf2v transition, extend it to 15s, and add narration":

1. Plan the full pipeline with estimated step count and total time
2. Present the plan to the user and get confirmation
3. Execute one step at a time, saving intermediate outputs to the session output directory
4. After all video steps complete, concatenate segments and add audio if needed (see [merge-media.md](merge-media.md))
