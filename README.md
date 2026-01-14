# MathMotion

Text → Manim math animations: prompt in, MP4 + code out (sandboxed rendering).

MathMotion turns an English prompt like:

> “Show why d/dx x² = 2x with a moving tangent line”

into:

1. A short rendered MP4 animation
2. The Manim Python code (a single `Scene` class) that produced it
3. A short natural-language explanation

This is not a UI-only wrapper. It includes an orchestration API, async rendering jobs, a sandboxed render environment, and failure handling with logs.

---

## What you can do (MVP)

- Generate Manim code from a prompt (one Scene, no extra text)
- Render the code into a short MP4 inside a sandbox
- View results on a clean Result page (video, code, explanation)
- See render logs when a job fails
- Retry, regenerate, and attempt automatic fixes (bounded retries)
- Use a Gallery page with curated prompts that are always demo-able

---

## Demo flow (what recruiters should try)

1. Open **Gallery**
2. Click 2–3 sample prompts and watch MP4s render quickly
3. Open **Code** tab and copy the generated Manim Scene
4. Try one simple custom prompt (short, standard concepts)

---

## Architecture (high level)

Frontend (Next.js)

- Home: prompt + style preset + generate + progress states
- Result: MP4 player + Code + Explanation + Logs (on failure)
- Gallery: curated prompts for reliable demos

Backend (API)

- Creates jobs
- Calls LLM for Manim code + explanation
- Validates code (fast checks)
- Enqueues async render jobs
- Stores artifacts: mp4, code, logs, explanation

Worker + Sandbox

- Worker processes jobs asynchronously
- Sandbox runs Manim render with resource and time limits
- Logs are captured and stored

Job states:
`queued → generating_code → rendering → done | failed`

---

## Repository layout (planned)
