# SAHJONY — Executive Control Plane

A hybrid local/cloud monitoring dashboard built on Next.js (App Router) with a
client-side voice command engine and a graceful, fallback-capable inference proxy.

## What is real vs. scaffolded

This is an honest build. Every value on the dashboard is tagged:

- **MEASURED** — read live from this host (CPU model/load/utilization, memory,
  uptime, GPU identity, `docker ps` state, inference-backend reachability).
- **SIMULATED** — synthesized for layout (token velocity / queue depth). There
  is no real token stream in a standalone build; wire your inference loop into
  `/api/llm` to make these live.
- **N/A** — genuinely unavailable on this hardware (e.g. live VRAM/compute,
  which needs an NVIDIA GPU + `nvidia-smi`).

### Hardware note
This machine is a Mac with an **AMD Radeon Pro 5300** — not an NVIDIA GPU. Local
GPU-accelerated **NVIDIA NIM cannot run here**. The app is built to work anyway:
the LLM proxy targets any OpenAI-compatible endpoint and falls back cleanly.

## Run it

```bash
npm install
cp .env.local.example .env.local   # optional; defaults work offline
npm run dev                        # http://localhost:3000
```

The dashboard runs with zero external services — backends show as offline and
velocity is simulated until you connect an inference endpoint.

## Inference backends (Section 4)

`/api/llm` tries, in order:
1. **Local NIM/Ollama** at `NIM_BASE_URL` (default `http://localhost:8000/v1`)
2. **Cloud mirror** at `CLOUD_LLM_BASE_URL` (only if set)

If none respond it returns a `503` with an actionable message — never a silent
failure. `/api/health` probes `/models` on each backend for the status panel.

- On a CUDA host: `NGC_API_KEY=... docker compose up -d` (see `docker-compose.yml`).
- On this Mac: run [Ollama](https://ollama.com) and set
  `NIM_BASE_URL=http://localhost:11434/v1`, or set `CLOUD_LLM_*`.

## Voice engine (Section 5)

Fully client-side via the Web Speech API (Chrome/Safari) — no API keys, no cost.
`SpeechRecognition` captures, `SpeechSynthesis` replies. Intent is parsed
semantically (`lib/intent.ts`), not by string equality, so paraphrases work:
"evaluate my local processing speed", "how fast am I running", "ship the build"
→ the right action. The **Deploy Post** control is bound to voice with an
arm → confirm step.

## Cross-device fleet (Section 2) — consent-based

The registry (`/api/devices`) is **opt-in only**. A device appears solely after
it enrolls itself with a valid `DEVICE_ENROLL_TOKEN` (unset = enrollment
disabled). This control plane deliberately does **not** push or insert runtimes
onto remote machines — that would be indistinguishable from malware. Build the
device agent as software an owner installs knowingly.

## Deploy to Vercel (Section 6)

```bash
git init && git add -A && git commit -m "init"
gh repo create <name> --private --source=. --push   # or push to an existing remote
vercel                                              # link & deploy
```

Set `CLOUD_LLM_*` (and any others) in Vercel project env — never commit secrets.
`.gitignore` already excludes env files, keys, Docker volumes, and NIM weights.
Note: a cloud Vercel deployment cannot reach `localhost` NIM; expose local
inference via a tunnel (ngrok/Cloudflared) and point `NIM_BASE_URL` at it, or
rely on the cloud mirror.

## Layout

```
app/
  api/telemetry  → live host CPU/mem/GPU/docker
  api/health     → inference backend probes
  api/llm        → OpenAI-compatible proxy w/ fallback
  api/devices    → consent-based device registry
  page.tsx       → dashboard
components/       → VoiceEngine, UI primitives
lib/             → types, semantic intent parser
```
