# Task Polling Guide

Video generation tasks are **asynchronous**: the API returns a `task_id` immediately, video rendering happens server-side (typically 1–10 min). The script provides **4 flexible execution patterns** to fit different workflows.

## Script Arguments for Polling Control

| Argument | Default | Description |
|----------|---------|-------------|
| `--poll-interval` | `15` | Seconds between status checks |
| `--timeout` | `600` | Max total wait (seconds). Exits with error if exceeded |
| `--submit-only` | off | Submit task, print `task_id` to stdout, exit immediately |
| `--task-id ID` | — | Operate on an existing task (skip submission) |
| `--poll-once` | off | With `--task-id`: single status check, print JSON to stdout, exit |
| `--quiet` / `-q` | off | Suppress progress output (errors still shown) |

## Pattern 1: Poll Until Done (default)

Submit + auto-poll until `SUCCEEDED` / `FAILED`. Progress is printed to stderr:

```
  [0s]  task=abc-123  status=PENDING
  [15s] task=abc-123  status=RUNNING  progress=0/1
  [45s] task=abc-123  status=RUNNING  progress=0/1
  [90s] task=abc-123  status=SUCCEEDED  video_url=ready
```

```bash
python3 scripts/video.py \
  --request '{"prompt":"..."}' \
  --poll-interval 15 --timeout 600 \
  --print-response
```

To suppress progress, add `--quiet`.

**Recommended intervals by task complexity:**

| Scenario | `--poll-interval` | `--timeout` | Typical time |
|----------|-------------------|-------------|--------------|
| t2v / i2v — 5s, 720P | `10` | `300` | 1–3 min |
| t2v / i2v — 10–15s, 720P | `15` | `600` | 3–6 min |
| t2v / i2v — 10–15s, 1080P, multi-shot | `20` | `900` | 5–10 min |
| kf2v — 5s | `10` | `300` | 1–3 min |
| r2v — 2–10s, multi-character | `15` | `600` | 2–5 min |
| vace — any function | `10` | `300` | 1–4 min |

## Pattern 2: Interactive Multi-Run (recommended for agents)

Split the lifecycle into **short, atomic steps**. Each invocation does exactly ONE thing.

**Step A — Submit:**

```bash
python3 scripts/video.py \
  --request '{"prompt":"A cat running across a meadow","duration":5}' \
  --submit-only
```

Output (stdout): `task_id`. Stderr shows mode and model:

```
Mode: t2v | Model: happyhorse-1.1-t2v
Task submitted: abc-1234-5678
```

**Step B — Check status (repeat until done):**

```bash
python3 scripts/video.py \
  --task-id abc-1234-5678 --poll-once \
  --output output/qianwen-video-generation/ --print-response
```

- **Exit code 2** = still running → stderr shows status, stdout shows full JSON. Wait, then check again.
- **Exit code 0** = done → auto-downloads video, saves `response.json`, prints video URL.
- **Exit code 1** = failed → stderr shows error message.

**Complete agent workflow:**

```
1. --submit-only → get TASK_ID, inform user of billing (link to [official pricing page](https://platform.qianwenai.com/docs/developer-guides/getting-started/pricing) — **never guess a cost figure**)
2. Inform user: "Video generation in progress — estimated 2-3 minutes..."
3. Wait 15-30s (do other work or sleep)
4. --task-id $TASK_ID --poll-once → show user current status
5. If exit code 2 → goto step 3
6. If exit code 0 → done, show user the video
7. If exit code 1 → show error, suggest fix
```

## Pattern 3: Resume Full Poll

Let the script handle the entire polling loop for an existing task:

```bash
python3 scripts/video.py \
  --task-id abc-1234-5678 \
  --poll-interval 10 --timeout 300 \
  --output output/qianwen-video-generation/ --print-response
```

## Pattern 4: Quiet Mode

Add `--quiet` / `-q` to suppress progress output:

```bash
python3 scripts/video.py \
  --request '{"prompt":"..."}' --quiet --print-response
```

## Agent Behavior During Long Waits

When executing a video task, **always**:

1. **Inform the user** of the expected wait time before submitting.
2. **Show progress**: Relay key milestones to the user.
3. **On timeout**: The script exits with an error and prints a resume hint (`--task-id {task_id}`). The task may still be running server-side — give the user the `task_id`.
4. **On failure**: Report `output.message` from the response and suggest fixes.
