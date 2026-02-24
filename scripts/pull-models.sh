#!/bin/bash
# pull-models.sh — run inside ollama container to ensure model is pulled
# Usage: MODEL_NAME=qwen2.5:7b /pull-models.sh

set -e

# Start ollama server in background
ollama serve &
OLLAMA_PID=$!

# Wait for ollama to be ready
echo "[pull-models] Waiting for Ollama to start..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "[pull-models] Ollama is ready"
    break
  fi
  sleep 1
done

# Pull model if specified
if [ -n "$MODEL_NAME" ]; then
  echo "[pull-models] Checking for model: $MODEL_NAME"
  if ! ollama list 2>/dev/null | grep -q "^${MODEL_NAME%%:*}"; then
    echo "[pull-models] Pulling model: $MODEL_NAME"
    ollama pull "$MODEL_NAME"
    echo "[pull-models] Model pulled successfully"
  else
    echo "[pull-models] Model already present"
  fi
fi

# Keep ollama running
wait $OLLAMA_PID
