#!/bin/bash

# Submit a job
echo "Submitting job..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test animation", "stylePreset": "Classic"}')

JOB_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$JOB_ID" ]; then
  echo "Failed to submit job. Response: $RESPONSE"
  exit 1
fi

echo "Job submitted. ID: $JOB_ID"

# Poll status
for i in {1..10}; do
  sleep 1
  STATUS_RESPONSE=$(curl -s http://localhost:3000/api/jobs/$JOB_ID)
  STATUS=$(echo $STATUS_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  MESSAGE=$(echo $STATUS_RESPONSE | grep -o '"progressMessage":"[^"]*"' | cut -d'"' -f4)
  
  echo "Time: ${i}s - Status: $STATUS - Message: $MESSAGE"
  
  if [ "$STATUS" == "done" ] || [ "$STATUS" == "failed" ]; then
    echo "Job finished."
    break
  fi
done
