# MathMotion Architecture

## System Overview (2-Minute Read)

MathMotion transforms English prompts into Manim math animations through a sophisticated pipeline that combines AI code generation with sandboxed rendering.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                              │
│  (Next.js Frontend - React, TypeScript, Tailwind CSS)           │
│  - Home: Prompt input with style selection                      │
│  - Gallery: 22 curated pre-cached examples                      │
│  - Result: Video player + code viewer + error handling          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓ HTTP (JSON)
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                            │
│  POST /api/jobs/submit   → Create job, start async processing   │
│  GET  /api/jobs/[jobId]  → Poll job status (3-second intervals) │
└────────────────┬────────────────────────────┬───────────────────┘
                 │                            │
        ┌────────↓─────────┐        ┌────────↓────────┐
        ↓                  ↓        ↓                 ↓
    ┌────────────┐   ┌─────────────────┐   ┌──────────────────┐
    │  MongoDB   │   │  OpenRouter API │   │ Docker Daemon    │
    │  (Jobs DB) │   │  (LLM for code) │   │ (Sandbox render) │
    └────────────┘   └─────────────────┘   └──────────────────┘
```

### What Happens When You Submit a Prompt

1. **Create Job** (instant)
   - POST /api/jobs/submit receives prompt + style
   - Job created in MongoDB with status `queued`
   - Response includes job ID (browser navigates to result page)

2. **Generate Code** (10-30 seconds)
   - Backend calls OpenRouter API (Claude 3.5 Sonnet)
   - LLM generates Manim Python code from prompt
   - Code is validated for safety (no `exec()`, restricted imports)
   - Job status updated to `generating_code` with progress

3. **Render Video** (10-60 seconds)
   - Validated code is placed in isolated Docker container
   - Manim executes in sandbox with:
     - CPU limit: 2 cores
     - Memory limit: 1GB
     - Time limit: 2 minutes
     - No network access
   - Output MP4 is stored in MongoDB
   - Job status updated to `rendering` then `done`

4. **Display Results** (instant)
   - Browser polls /api/jobs/[jobId] every 3 seconds
   - When status becomes `done`, displays:
     - Video player
     - Generated Manim code with copy button
     - Natural-language explanation
     - Download link

### Failure Handling

If something fails at any stage:

1. **Error Captured**
   - Stack trace, output logs, stderr all logged
   - Job marked as `failed` with error details
   - Attempt number incremented

2. **User Options**
   - **Retry:** Submit same prompt as new attempt (3 max per prompt)
   - **Auto-Fix:** AI analyzes error + code, attempts repair (2 max per job)
   - **Modify Prompt:** Create new job with different wording

3. **Timeout Handling**
   - If job stuck in `queued` > 30 seconds → auto-fail
   - If `generating_code` > 3 minutes → auto-fail
   - If `rendering` > 90 seconds → auto-fail
   - Timeouts detected on each poll, automatically marked failed

---

## Core Components

### Frontend (Next.js + React)

#### Pages
- **`/`** - Home page with prompt input form
  - Text input for English description
  - Dropdown for animation style (3Blue1Brown, Classic, Minimalist, Dark)
  - Submit button + loading state
  - Rate limit feedback (shows remaining requests)

- **`/gallery`** - 22 curated mathematical examples
  - Click any card to generate (or use cached result)
  - Shows "Cached" badge if result already rendered
  - Gallery cache persists in localStorage (24 hours)

- **`/result/[jobId]`** - Results page
  - Real-time progress timeline (Queued → Generating Code → Rendering)
  - Video player with play/pause/fullscreen
  - Code viewer with syntax highlighting + copy button
  - Error display with logs (if failed)
  - Retry/Auto-fix/Regenerate buttons

#### Services
- **`useJobPolling.ts`** - React hook that polls `/api/jobs/[jobId]` every 3 seconds
- **`rateLimiter.ts`** - Enforces 10 requests per 5 minutes per IP
- **`promptCache.ts`** - Server-side cache of completed jobs (30-day TTL)
- **`galleryCache.ts`** - Client-side localStorage cache for gallery examples

### Backend (Next.js API Routes)

#### Endpoints
- **`POST /api/jobs/submit`**
  - Input: `{ prompt, stylePreset, parentJobId?, autoFixJobId? }`
  - Creates job, starts async processing
  - Returns: `{ job: { id, status, progress } }`

- **`GET /api/jobs/[jobId]`**
  - Input: Job ID
  - Checks for timeout, returns current job state
  - Returns: `{ job: { status, progress, output, error } }`

#### Services
- **`manimCodeGenerator.ts`** - Calls OpenRouter API
  - System prompt: Generate a single Manim Scene class
  - Validates code for safety (blacklists `exec`, `__import__`, etc.)
  - Returns code + natural-language explanation

- **`autoFixGenerator.ts`** - AI-powered error repair
  - Takes failed code + error logs
  - Calls LLM to suggest fixes
  - Validates repaired code

- **`manimRenderer.ts`** - Executes code in Docker
  - Creates isolated container from `manimcommunity/manim:latest`
  - Mounts validated code and output directory
  - Captures stdout, stderr, video output
  - Returns video path + logs or error details

- **`timeoutDetector.ts`** - Monitors stuck jobs
  - Checks elapsed time for each phase
  - Marks job as failed if thresholds exceeded
  - Thresholds: queued 30s, generating_code 3min, rendering 90s

### Database (MongoDB)

#### Collections
**`jobs`** - All animation generation requests
```javascript
{
  _id: ObjectId,
  status: 'queued' | 'generating_code' | 'rendering' | 'done' | 'failed',
  prompt: string,
  stylePreset: '3Blue1Brown' | 'Classic' | 'Minimalist' | 'Dark',

  // Timestamps
  createdAt: ISO8601,
  updatedAt: ISO8601,
  queuedAt: ISO8601,
  codeGenerationStartedAt: ISO8601,
  renderingStartedAt: ISO8601,

  // Retry tracking
  attemptNumber: 1,
  parentJobId: ObjectId,  // Link to previous attempt (if retry)
  maxAttempts: 3,

  // Auto-fix tracking
  autoFixAttemptCount: 0,
  isAutoFixJob: boolean,
  originalFailedJobId: ObjectId,

  // Output
  output: {
    code: string,        // Generated Manim code
    explanation: string, // Human-readable explanation
    videoUrl: string     // S3/local path to MP4
  },

  // Error handling
  error: {
    message: string,       // User-friendly error
    logs: string,          // Stack trace + stderr
    stage: 'code_generation' | 'rendering',
    type: 'validation' | 'runtime_error' | 'timeout' | 'network_error' | 'api_error',
    timestamp: ISO8601
  },

  // Caching
  isCacheHit: boolean,
  cachedFromJobId: ObjectId,  // If this job used a cached result

  // Progress
  progress: 0-100,
  progressMessage: string
}
```

---

## Job Lifecycle in Detail

### State Transitions

```
                  ┌─────────────────────────────────────────────┐
                  │                                             │
            START │                                             │
              ↓   │                                             │
        ┌─────────────┐                                          │
        │   queued    │   (0-30 seconds)                         │
        └─────────────┘   Waiting to start processing            │
              │ (check cache first - may skip to done)           │
              │                                                  │
              ↓                                                  │
        ┌──────────────────────┐                                │
        │  generating_code     │   (10-30 seconds)              │
        └──────────────────────┘   LLM creates Manim code       │
              │                    + validation                  │
              ├─→ FAILED (invalid code, API error, etc)    ──→┐ │
              │                                            │ │ │
              ↓                                            │ │ │
        ┌──────────────────────┐                           │ │ │
        │     rendering        │   (10-60 seconds)        │ │ │
        └──────────────────────┘   Docker runs Manim      │ │ │
              │                    Creates MP4             │ │ │
              ├─→ FAILED (runtime error, timeout, etc) ─→┐│ │ │
              │                                          ││ │ │
              ↓                                          ││ │ │
        ┌──────────────────────┐                        ││ │ │
        │       done           │   (instant)            ││ │ │
        └──────────────────────┘   Results shown to user││ │ │
              ↑                                          ││ │ │
              └──────────────────────────────────────────┘│ │ │
                  (Retry: parentJobId set)               │ │ │
                  (Auto-fix: repairs and re-runs)        │ │ │
                                                         │ │ │
                   ┌─────────────────────────────────────┘ │ │
                   │                                       │ │
                   ↓                                       │ │
            ┌─────────────┐                               │ │
            │   failed    │ (permanent)                   │ │
            └─────────────┘                               │ │
                 ↑                                        │ │
                 └────────────────────────────────────────┘ │
                 (Timeout/max retries/max auto-fixes)      │
                                                            │
            Timeout Detection (runs on every GET poll):    │
            - queued > 30s → FAILED                         │
            - generating_code > 180s → FAILED             │
            - rendering > 90s → FAILED                    │
                                                            │
                 ┌──────────────────────────────────────────┘
                 │ User can always see:
                 ├─ Current status + progress
                 ├─ Generated code (if available)
                 ├─ Error logs (if failed)
                 ├─ Retry button (if attempt < max)
                 ├─ Auto-fix button (if errors < max, only for validation/runtime)
                 └─ Regenerate button (gallery examples)
```

### Attempt Tracking

Each job has:
- **`attemptNumber`** (1, 2, 3 max) - sequential retries of same prompt
- **`autoFixAttemptCount`** (0, 1, 2 max) - AI repair attempts
- **`parentJobId`** - links retry to previous attempt

Example flow:
```
Job 1: "Draw circle" → fails with syntax error
  - attemptNumber: 1
  - autoFixAttemptCount: 0

User clicks "Auto-Fix"
Job 2: "Draw circle" (auto-fixed) → fails again
  - isAutoFixJob: true
  - originalFailedJobId: Job 1
  - autoFixAttemptCount: 1

User clicks "Retry"
Job 3: "Draw circle" (user modifies prompt) → succeeds
  - attemptNumber: 2
  - parentJobId: Job 1
  - autoFixAttemptCount: 0 (reset)
```

---

## Safety & Sandboxing

### Code Validation

Before any code runs, it's validated:

1. **Blacklist Check**
   - No `exec()`, `eval()`, `__import__()`, `open()` (file access)
   - No `subprocess`, `os.system`, network libraries

2. **Import Validation**
   - Only allowed: `manim`, `math`, `numpy`, `itertools`
   - No system access, no external APIs

3. **Structure Check**
   - Must contain exactly one `Scene` class
   - Must not be empty or too large (5KB+ is suspicious)

### Runtime Isolation

When code executes:

```
┌─────────────────────────────────────────┐
│  Docker Container (manimcommunity:latest)
│  ┌─────────────────────────────────────┐
│  │ Process: manim render script.py     │
│  │                                     │
│  │ CPU Limit: 2 cores                  │
│  │ Memory Limit: 1GB                   │
│  │ Time Limit: 2 minutes               │
│  │ Network: DISABLED                   │
│  │ File System: Read-only (except /tmp)│
│  │                                     │
│  │ Output: /tmp/media/videos/scene.mp4│
│  └─────────────────────────────────────┘
└─────────────────────────────────────────┘
     ↓ (stdout, stderr, video captured)
  Host System: Store in MongoDB
```

### What Can Go Wrong

1. **Validation Fails** → Error before execution
   - Code blocked as unsafe
   - LLM asked to regenerate
   - User sees "Code contains unauthorized operations"

2. **Syntax Error** → Manim fails to import
   - Captured from stderr
   - User sees error + logs
   - Can auto-fix or retry

3. **Runtime Error** → Manim fails during Scene construction
   - Missing object methods, wrong arguments
   - Captured from stderr
   - User can auto-fix

4. **Timeout** → Takes too long
   - Container killed after 2 minutes
   - Job marked failed
   - User sees "Rendering took too long"

5. **Memory/Resource Exceeded**
   - Container OOM-killed
   - Docker captures exit code
   - Job marked failed with resource limit message

---

## Caching Strategy

### Prompt Cache (Server-Side)

When a job completes successfully:
- SHA256 hash of `prompt + stylePreset`
- Store job in in-memory cache
- 30-day TTL
- Max 1000 entries (LRU cleanup)

Future identical requests:
- Check cache first
- If hit: return cached job immediately (instant)
- If miss: proceed normally, cache when done

### Gallery Cache (Client-Side)

Gallery examples cached in browser localStorage:
- Gallery example ID → job data
- 24-hour TTL
- Auto-cleared when cache version incremented
- Survives page reload

Benefits:
- Instant gallery renders on repeat clicks
- Survives browser restart (24 hours)
- No server load for cached content

---

## Performance Characteristics

### Response Times (Typical)

| Stage | Time | Notes |
|-------|------|-------|
| Cache hit | <100ms | Instant result from cache |
| Job creation | <1s | Database write |
| Code generation | 10-30s | OpenRouter API + validation |
| First manim render | 30-90s | Docker image pull + compile + render |
| Subsequent renders | 10-60s | Manim already loaded |
| **Total (no cache)** | **50-180s** | Sum of above |

### Concurrency

- **Per-IP Rate Limit:** 10 requests per 5 minutes
- **API Processing:** Async (non-blocking) with callbacks
- **Database:** MongoDB (Atlas or local) handles concurrent reads
- **Docker Rendering:** Sequential on single host (can parallelize with k8s)

### Scalability

Current design:
- Single Next.js server (can scale horizontally)
- Single MongoDB (can replicate)
- Single Docker daemon (renders sequentially)

To scale rendering:
- Use job queue (Redis, RabbitMQ)
- Multiple render workers (separate containers/servers)
- Video storage on S3/GCS instead of local disk

---

## Key Design Decisions

### Why OpenRouter?

- Broad LLM access (Claude, GPT-4, etc.) through single API
- Simple billing, no long-term contracts
- Good uptime SLA
- Supports structured output (code + explanation)

### Why Docker for Rendering?

- **Safety:** Isolated process, resource limits, no host access
- **Reproducibility:** Same image = same output
- **Cleanup:** Kill container, all artifacts gone
- **Scaling:** Container orchestration (Docker Compose, k8s)

### Why MongoDB?

- Flexible schema (job states vary)
- Fast inserts (high throughput)
- Document storage (code + logs in one record)
- Easy local development (local docker container)

### Why Next.js?

- Full-stack (API + Frontend in one codebase)
- Built-in optimization (code splitting, image optimization)
- TypeScript support
- Fast development iteration

### Why Client-Side Polling?

- Simpler than WebSocket (no stateful connections)
- Works behind any firewall/proxy
- Browser handles reconnection automatically
- 3-second interval = responsive enough for demo

---

## Extension Points

### Easy to Add

- **More Gallery Examples** - Add to `GALLERY_EXAMPLES` array
- **New Animation Styles** - Add style template to system prompt
- **Better Error Messages** - Improve error classification in `failJob()`
- **Caching Layers** - Add Redis for distributed cache
- **Telemetry** - Log job metrics to analytics service

### Harder to Add

- **Real-time Updates** - Replace polling with WebSocket
- **Parallel Rendering** - Job queue + worker pool
- **Video Storage** - S3/GCS integration for MP4s
- **User Authentication** - Auth layer + per-user quotas
- **Multi-language Prompts** - Translate before code generation

---

## Testing in Development

### Quick Local Test

```bash
# Terminal 1: Start app
docker-compose up

# Terminal 2: Test with curl
curl -X POST http://localhost:3000/api/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Draw a circle",
    "stylePreset": "3Blue1Brown"
  }'

# Copy the job ID from response, then poll:
curl http://localhost:3000/api/jobs/{JOB_ID}
```

### View Logs

```bash
# Full stack logs
docker-compose logs -f

# Just the app
docker-compose logs -f app

# Just MongoDB
docker-compose logs -f mongodb
```

### Inspect Database

```bash
# Connect to MongoDB
docker exec -it mathmotion-mongodb mongosh

# In mongosh shell:
use mathmotion
db.jobs.find({}).pretty()
db.jobs.findOne({ status: 'failed' })
```

---

## Recruitment Note

What this demonstrates:
- ✓ **Full-stack architecture** - Frontend, API, database, async processing
- ✓ **AI integration** - LLM prompting, structured output, error recovery
- ✓ **Safety engineering** - Code validation, sandboxing, resource limits
- ✓ **User experience** - Real-time feedback, error handling, retry logic
- ✓ **DevOps** - Docker, containerization, local development experience
- ✓ **Database design** - Document schema, indexing, concurrent access
- ✓ **Performance** - Caching, rate limiting, timeout detection
- ✓ **Production readiness** - Error logging, graceful degradation, monitoring

---

See [README.md](./README.md) for setup instructions and demo walkthrough.
