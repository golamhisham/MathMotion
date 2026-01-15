# MathMotion Demo Walkthrough

## For Recruiters (5-Minute Demo)

Follow these steps to see the system in action:

### Setup (1 minute)

```bash
# Get the app running
docker-compose up --build

# In your browser, go to:
# http://localhost:3000
```

Wait for the app to load (you'll see "MathMotion" header).

### Demo Flow (4 minutes)

#### Step 1: Gallery (1 minute)
1. Click **Gallery** in the navigation
2. Scroll through the 22 examples
   - Each card shows title, style, and a "Cached" badge (if run before)
3. Click **"Visualize π as Limit"** (or any Minimalist example)
   - Watch the progress: "Queued" → "Generating Code" → "Rendering"
   - Takes 30-60 seconds on first run (includes Docker image download)
4. When done:
   - Video plays at the top
   - Generated Manim code visible below
   - Click **"Copy Code"** (turns green with checkmark)
   - Click **"Download MP4"** (shows spinner while downloading)

#### Step 2: Custom Prompt (1.5 minutes)
1. Go back to **Home**
2. In the prompt box, type: `"Draw a square and rotate it 360 degrees"`
3. Select style: **"3Blue1Brown"** (or your preference)
4. Click **Generate**
   - See the progress timeline update in real-time
   - Watch as it goes through each stage
5. When done, scroll down to see:
   - The generated Python code
   - An explanation of what the code does
6. Try **Copy Code** again

#### Step 3: Error Handling (1 minute)
1. Submit a tricky prompt: `"Show the quaternion group Q8 with all 24 rotations"`
   - This is intentionally complex and will likely fail
2. When it fails, you'll see:
   - Error message explaining what went wrong
   - Full stack trace and logs (scroll down)
   - **Retry** button (try different prompt)
   - **Auto-Fix** button (AI repairs the code)
3. Click **Auto-Fix** to see the system attempt recovery
4. Or click **Retry** and modify the prompt: `"Draw a square and rotate it"`

#### Step 4: Observe Caching (30 seconds)
1. Go back to Gallery
2. Click the same example from Step 1
3. **Notice: It's instant now!**
   - The badge shows "Cached"
   - Result loads in <1 second (no waiting)
   - This demonstrates the prompt caching layer

---

## Common Things to Watch For

### Progress States (Shows Real-Time Status)
As a job processes, you'll see:
- **⏳ Queued** - Gray dot, waiting to start
- **⚙️ Generating Code** - Blue dot, actively generating Manim code
- **🎬 Rendering** - Blue dot, running animation in Docker
- **✓ Complete** - Green dots for finished stages
- **Progress bar** - Shows percentage through current stage

### Video Player Features
- Click **play** to watch the animation
- Click **fullscreen** for bigger view
- **Download MP4** button downloads with sensible filename (e.g., `manim-draw-circle-1705...mp4`)

### Code Features
- **Copy Code** button turns blue → green (shows success)
- Code is syntax-highlighted Python
- Shows exactly what the LLM generated
- You could copy and run this in Manim locally

### Rate Limiting Feedback
- If you submit 10+ times in 5 minutes
- You'll see: "Requests remaining: 3/10" in blue box
- After limit: "Rate limited. Please try again in 240 seconds"
- Shows the system is production-ready (no spam)

---

## Expected Behavior by Prompt Type

### Easy (Usually Works - 30-60 seconds)
```
"Draw a circle"
"Rotate a triangle"
"Show a sine wave"
"Draw a rectangle and fill it with blue"
"Move a point from A to B along a straight line"
```

**Result:** Clean animation, fast render

### Medium (Often Works - 60-120 seconds)
```
"Show the Pythagorean theorem with 3-4-5 triangle"
"Animate the derivative of x squared"
"Draw the unit circle and show sin/cos"
```

**Result:** More complex, may need retry if Manim complains

### Hard (May Fail - Multiple Retries)
```
"Show all 24 rotations of a cube"
"Render the Mandelbrot set"
"Animate quantum superposition"
```

**Result:** Likely needs tweaks, good for showing auto-fix

---

## What's Happening Behind the Scenes

### When You Click "Generate"

1. **Frontend** sends request to API
2. **Backend** creates job in MongoDB
3. **LLM** (OpenRouter) generates Manim code (10-30s)
4. **Validation** checks for unsafe code
5. **Docker** spins up container with Manim
6. **Manim** compiles the Python code
7. **Video** is generated and stored
8. **Frontend** polls every 3 seconds and displays progress

### Network Requests You Could Inspect (Browser DevTools)

```
POST /api/jobs/submit
→ Response: { job: { id: "...", status: "queued" } }

GET /api/jobs/65a1b2c3d4e5f6g7h8i9j0k1  [polls every 3 seconds]
→ Response: { job: { status: "generating_code", progress: 25 } }
→ Response: { job: { status: "rendering", progress: 50 } }
→ Response: { job: { status: "done", output: { ... } } }
```

---

## If Something Breaks (Troubleshooting)

### "Can't connect to localhost:3000"
- Check if app is running: `docker-compose ps`
- If not, run: `docker-compose up --build`

### "Video player shows black screen"
- Try refreshing the page
- First-time render needs to download Docker image (~2GB)
- Check Docker resource limits (Settings → Resources)

### "Rate limit exceeded after a few clicks"
- Expected behavior (10 per 5 minutes)
- Wait 5 minutes or start a new docker-compose instance
- In development, you can increase limit in `lib/services/rateLimiter.ts`

### "Prompt generated broken code"
- This is intentional - LLMs aren't perfect!
- Try rephrasing: "Draw a simple square" vs "Draw an equilateral square"
- Use **Auto-Fix** to let AI repair
- Check the error logs (full stderr shown)

### "Docker out of memory"
- Rendering is resource-heavy
- Check Docker Desktop settings (allocate more RAM)
- Try simpler prompts first

---

## Recruiting Talking Points

### Technical Depth
- "Look at the error logs - full stack traces, not just 'failed'"
- "Notice the timeout detection - jobs can't get stuck forever"
- "The staging timeline shows real-time progress, not fake loading"

### Safety
- "All generated code is validated before execution"
- "Rendering happens in isolated Docker containers with CPU/memory/time limits"
- "No way for user input to break the system"

### User Experience
- "Real-time progress updates via polling"
- "Intelligent retry/auto-fix for error recovery"
- "Caching makes gallery examples instant on repeat"
- "Proper error messages, not cryptic stack traces"

### Scalability
- "Async job processing (request returns immediately)"
- "Can add more render workers with job queue"
- "Rate limiting prevents abuse"
- "MongoDB scales horizontally"

### DevOps
- "Single `docker-compose up` command"
- "Full stack: frontend, API, database, sandbox"
- "No manual services to start"
- "Works exactly same locally and in production"

---

## Gallery Examples You'll See

The 22 examples cover:

**Calculus** (derivatives, integrals, limits)
- Derivative of x²
- Area under sine curve
- Limit approaching π

**Linear Algebra** (matrices, vectors, transformations)
- Matrix multiplication
- Linear transformation visualization
- Eigenvector decomposition

**Geometry** (shapes, transformations, 3D)
- Pythagorean theorem
- Möbius strip in 3D
- Line intersection in 3D

**Probability & Series** (distributions, convergence)
- Normal distribution
- Geometric series convergence
- Monte Carlo π approximation

**Advanced** (complex numbers, topology, special functions)
- Complex plane rotations
- Prime spiral patterns
- Bézier curves

Each example is tested to work reliably - good for demos.

---

## Next Steps After Demo

### Impressed? Here's What You're Looking At

- **~5,000 lines of code** in TypeScript/Python
- **~50 components** for UI
- **8 service modules** for business logic
- **Multi-stage job processing** with real-time updates
- **Robust error handling** with recovery options
- **Production-ready** Docker setup
- **Clear documentation** (README + ARCHITECTURE)

### You Can...

1. **Read the Code**
   - Start at [app/result/[jobId]/page.tsx](app/result/[jobId]/page.tsx)
   - Follow the job lifecycle in [lib/jobRepository.ts](lib/jobRepository.ts)
   - Check LLM integration in [lib/services/manimCodeGenerator.ts](lib/services/manimCodeGenerator.ts)

2. **Modify and Extend**
   - Change prompt instructions in `manimCodeGenerator.ts`
   - Add more gallery examples in `lib/constants.ts`
   - Tweak styling in Tailwind CSS classes

3. **Deploy**
   - Set environment variables
   - Run `docker-compose up -d`
   - Works on any machine with Docker

---

## Video Recording Tips

If you want to record a demo:

1. **Setup** - Show running `docker-compose up` (skip the build time)
2. **Gallery** - Quick click through gallery, then click one example
3. **Wait** - Let it render (fast-forward in post if needed)
4. **Show Results** - Highlight copy button, download button, error handling
5. **Custom Prompt** - Type a simple one, watch it generate
6. **Code View** - Show the generated code, copy button in action

**Total video time:** 3-5 minutes

Key moments to emphasize:
- Real-time progress updating
- Error display with logs
- Instant cached results
- Clean UI/UX

---

See [README.md](./README.md) for setup and [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details.
