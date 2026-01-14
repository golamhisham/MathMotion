# Generated Videos

This directory stores rendered Manim animation videos.

- Videos are named by job ID: `{jobId}.mp4`
- Served statically at: `/videos/{jobId}.mp4`
- Automatically created during job rendering
- Should be added to .gitignore (except this README)

## Cleanup

Videos should be periodically cleaned up to save disk space.
Consider implementing a cleanup cron job in production.
