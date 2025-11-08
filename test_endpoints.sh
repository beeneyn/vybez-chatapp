#!/bin/bash
echo "Testing response times for various endpoints..."
echo ""

endpoints=(
  "/"
  "/check-session"
  "/chat.html"
  "/developer"
  "/admin"
)

for endpoint in "${endpoints[@]}"; do
  echo "Testing: $endpoint"
  curl -s -o /dev/null -w "  Response time: %{time_total}s | HTTP: %{http_code}\n" "http://localhost:5000$endpoint"
done
