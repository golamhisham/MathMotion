# MathMotion

Transform English prompts into beautiful Manim math animations. Get the rendered video, the code that made it, and a natural-language explanation—all in one place.

**Input:** "Show why d/dx x² = 2x with a moving tangent line"

**Output:**
- MP4 animation (rendered safely in a sandbox)
- Python Manim code (ready to customize)
- Natural-language explanation of what the code does

**📚 Quick Links:**
- [**DEMO.md**](./DEMO.md) - 5-minute walkthrough (for recruiters)
- [**ARCHITECTURE.md**](./ARCHITECTURE.md) - Technical deep-dive (2-minute overview)

---

## Quick Start (Local)

### Prerequisites
- Docker & Docker Compose
- An OpenRouter API key (free tier available at https://openrouter.ai)

### Run Everything in One Command

```bash
# Clone the repository
git clone <repository-url>
cd MathMotion

# Copy the example environment file
cp .env.example .env.local

# Edit .env.local and add your OpenRouter API key
# OPENROUTER_API_KEY=your-key-here

# Start everything (MongoDB, frontend, API)
docker-compose up --build
```

That's it! The app will be available at **http://localhost:3000**.

### What Happens Behind the Scenes
1. MongoDB starts and stores all your jobs and results
2. The Next.js frontend + API starts on port 3000
3. When you submit a prompt, the backend:
   - Calls OpenRouter to generate Manim code
   - Validates the code for safety
   - Runs it in a sandboxed Docker container
   - Stores the MP4, code, and logs in MongoDB
4. Your browser polls for updates and displays results

---

## Features

- **Gallery Mode:** Click curated examples and watch instant renders (with caching)
- **Custom Prompts:** Write your own animation descriptions
- **Progress Tracking:** See real-time "Generating Code → Rendering" status
- **Error Handling:** Failed renders show logs + options to retry or auto-fix
- **Code Inspection:** Copy generated Manim code with one click
- **Video Download:** Download rendered MP4s with sensible filenames
- **Rate Limiting:** 10 requests per 5 minutes per IP (prevents abuse)
- **Prompt Caching:** Identical prompt+style combinations return cached results instantly

---

## Environment Setup

### Required Variables

**OpenRouter API Key**
- Sign up at https://openrouter.ai
- Copy your API key
- Set in `.env.local`: `OPENROUTER_API_KEY=sk-or-v1-...`

### Optional Variables

```bash
# Database (defaults to localhost MongoDB)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=mathmotion

# Rendering timeouts and limits
RENDER_TIMEOUT_MS=120000           # 2 minutes max per render
RENDER_MEMORY_LIMIT_MB=1024        # 1GB max memory
RENDER_CPU_LIMIT=2                 # 2 CPU cores max
TEMP_DIR=/tmp/mathmotion           # Temporary file storage
```

---

## Development (Without Docker)

If you prefer to run locally without containers:

```bash
# Install dependencies
npm install

# Start MongoDB (in a separate terminal)
# Using Docker: docker run -p 27017:27017 mongo:7.0
# Or install MongoDB locally

# Set up environment
cp .env.example .env.local
# Edit .env.local with your API key

# Run development server
npm run dev
```

Visit http://localhost:3000

---

## How It Works

### Architecture

```
User Browser
    ↓
Next.js Frontend (React)
    ↓
API Endpoints (/api/jobs/submit, /api/jobs/[jobId])
    ↓
MongoDB (store jobs, results, logs)
    ↓
OpenRouter API (generate Manim code)
    ↓
Manim Sandbox (render code in isolated Docker)
    ↓
Video File (stored & served back to user)
```

### Job Lifecycle

1. **Queued** – Job received, waiting to start
2. **Generating Code** – LLM creating Manim code from prompt
3. **Rendering** – Manim running in sandbox, creating MP4
4. **Done** – Video ready, shown on result page
5. **Failed** – Something went wrong; user can retry or use auto-fix

### Safety Features

- Manim code is validated before execution (no `exec()`, restricted imports)
- Rendering runs in an isolated Docker container with:
  - CPU limits (2 cores max)
  - Memory limits (1GB max)
  - Time limits (2 minutes max)
  - No network access
- All generated code is logged (easy debugging if something fails)

---

## Demo Walkthrough

### For Recruiters / First-Time Users

1. **Open the Gallery** (http://localhost:3000/gallery)
   - See 22 curated mathematical animations
   - Click any card and watch it render
   - Repeated renders are instant (cached)

2. **Try a Custom Prompt** (http://localhost:3000)
   - "Draw a circle and animate it rotating"
   - "Show the area under a sine curve from 0 to π"
   - Watch the real-time progress: Queued → Generating Code → Rendering

3. **Inspect the Code**
   - When done, scroll down to see the Manim code
   - Click "Copy Code" to copy it
   - Download the MP4 with "Download MP4"

4. **If Something Fails**
   - You'll see the error and logs
   - Try "Retry" (with a different prompt) or "Auto-Fix" (AI attempts repair)

---

## Troubleshooting

### Docker Compose won't start

**Issue:** `docker: command not found`
- **Solution:** Install Docker Desktop (includes Docker Compose)
- https://www.docker.com/products/docker-desktop

**Issue:** `Bind for 0.0.0.0:3000 failed: port is already in use`
- **Solution:** Another app is using port 3000
  ```bash
  # On Mac/Linux: kill the process using port 3000
  lsof -ti:3000 | xargs kill -9

  # Or use a different port:
  docker-compose up -p 8000:3000 app
  ```

### MongoDB connection errors

**Issue:** `MongoServerError: connect ECONNREFUSED 127.0.0.1:27017`
- **Solution:** Make sure the MongoDB container is running
  ```bash
  docker-compose ps
  # Should show: mathmotion-mongodb is healthy
  ```

### OpenRouter API errors

**Issue:** `OPENROUTER_API_KEY: not found`
- **Solution:** Make sure you set it in `.env.local`
  ```bash
  echo "OPENROUTER_API_KEY=your-key-here" >> .env.local
  ```

**Issue:** `Rate limit exceeded` or `Invalid API key`
- **Solution:**
  - Verify your key at https://openrouter.ai/keys
  - Check your account has credits remaining
  - The free tier has limits; paid accounts are faster

### Rendering times are slow

**Issue:** Animations take 30+ seconds to render
- **Possible causes:**
  - First-time render of Manim image (downloads 2GB+)
  - Complex animation prompt (lots of objects, long duration)
  - System is under heavy load
- **Solution:**
  - First render includes image download; subsequent renders are faster
  - Try simpler prompts (e.g., "draw a triangle")
  - Check Docker resource allocation (Settings → Resources)

### Video player shows "Failed to load video"

**Issue:** Animation renders but video won't play
- **Solution:**
  - Refresh the page
  - Check browser console for network errors
  - Ensure the file was actually created: `docker exec mathmotion-app ls /tmp/mathmotion/`

---

## Building & Deployment

### Production Build

```bash
npm run build
npm start
```

### Build Docker Image

```bash
docker build -t mathmotion:latest .
```

### Deploy to Production

Use the provided `docker-compose.yml` with environment variables:

```bash
OPENROUTER_API_KEY=your-key docker-compose up -d
```

---

## Project Structure

```
├── app/                      # Next.js app directory
│   ├── page.tsx             # Home page (prompt input)
│   ├── gallery/             # Gallery page (curated examples)
│   ├── result/[jobId]/      # Result page (video + code)
│   └── api/
│       ├── jobs/submit      # POST endpoint (create job)
│       └── jobs/[jobId]     # GET endpoint (poll status)
│
├── components/               # React components
│   ├── PromptForm.tsx       # Prompt input UI
│   ├── result/
│   │   ├── LoadingProgress.tsx    # Stage timeline + progress bar
│   │   ├── VideoPlayer.tsx        # Video + download button
│   │   ├── CodeDisplay.tsx        # Code viewer + copy button
│   │   └── ErrorDisplay.tsx       # Error messages + retry buttons
│   └── gallery/
│       └── ExampleCard.tsx   # Gallery card UI
│
├── lib/                      # Utilities & services
│   ├── mongodb.ts           # Database connection
│   ├── jobRepository.ts     # Job CRUD operations
│   ├── constants.ts         # Gallery examples, timeouts
│   ├── hooks/
│   │   └── useJobPolling.ts # Poll job status every 3 seconds
│   └── services/
│       ├── manimCodeGenerator.ts    # LLM code generation
│       ├── manimRenderer.ts         # Sandbox rendering
│       ├── autoFixGenerator.ts      # Auto-fix using LLM
│       ├── promptCache.ts           # Cache identical prompts
│       ├── galleryCache.ts          # Cache gallery results
│       ├── rateLimiter.ts           # Rate limiting per IP
│       └── timeoutDetector.ts       # Timeout detection
│
├── public/                   # Static assets
├── Dockerfile                # Container build
├── docker-compose.yml        # Full local stack
├── .env.example             # Environment template
└── README.md                # You are here
```

---

## Technology Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Node.js
- **Database:** MongoDB
- **LLM:** OpenRouter API (Claude 3.5 Sonnet)
- **Rendering:** Manim Community, Docker (sandbox)
- **Deployment:** Docker Compose (local/production)

---

## Known Limitations

- Manim animations are limited to ~1 minute duration and simple scenes
- Very complex animations may fail or timeout
- Generated code is not guaranteed to be perfect (manual review recommended)
- Rate limited to 10 requests per 5 minutes per IP
- Requires OpenRouter account (but free tier available)

---

## Contributing

Want to improve MathMotion? Areas for contribution:

- Add more gallery examples
- Improve prompt → code quality
- Optimize rendering performance
- Add new animation styles
- Enhance error messages

---

## License

MIT (see LICENSE file)

---

## Questions?

- Check the troubleshooting section above
- Review the demo flow for expected behavior
- Inspect browser console and Docker logs: `docker-compose logs app`
