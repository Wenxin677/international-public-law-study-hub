#!/usr/bin/env bash
# Wait for the GitHub repo to exist, then push and verify. Runs in the background so the
# user can create the repo (and complete the browser sign-in) without blocking the chat.
set -u
cd "$HOME/dev/ipl-study-hub" || exit 1
REPO="https://github.com/Wenxin677/international-public-law-study-hub.git"
API="https://api.github.com/repos/Wenxin677/international-public-law-study-hub"

echo "[publisher] waiting for $API to exist (up to 25 minutes)…"
for i in $(seq 1 150); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$API")
  if [ "$code" = "200" ]; then echo "[publisher] repo found after $((i*10))s"; break; fi
  sleep 10
done
if [ "$code" != "200" ]; then echo "[publisher] repo never appeared (last HTTP $code) — nothing pushed"; exit 2; fi

echo "[publisher] pushing (a browser window may open for GitHub sign-in)…"
git remote set-url origin "$REPO"
git push -u origin main 2>&1 | tail -5
echo "[publisher] push finished with exit $?"

echo "[publisher] verifying server side…"
for f in docs/index.html README.md; do
  c=$(curl -s -o /dev/null -w "%{http_code}" "https://raw.githubusercontent.com/Wenxin677/international-public-law-study-hub/main/$f")
  echo "[publisher]   $f -> HTTP $c"
done
echo "[publisher] done"
