#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <port> [port...]"
  exit 1
fi

for port in "$@"; do
  pids=$(lsof -ti tcp:"$port" || true)
  if [ -z "$pids" ]; then
    echo "No process on port $port"
    continue
  fi
  echo "Killing processes on port $port: $pids"
  kill -9 $pids
  echo "Done"
done
