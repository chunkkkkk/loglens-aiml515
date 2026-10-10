#!/bin/bash
# LogLens: create a GitHub repository and push the code.
# You type your GitHub username and a personal access token; nothing is saved to disk.
cd "$(dirname "$0")"
REPO="loglens-aiml515"
echo "== LogLens -> GitHub"
read -s -p "GitHub personal access token (input hidden): " GHTOKEN; echo
GHTOKEN=$(printf "%s" "$GHTOKEN" | tr -d "[:space:]")
[ -z "$GHTOKEN" ] && { echo "Missing token."; read -p "Press Enter"; exit 1; }
RESP=$(curl -s -w "\nHTTP:%{http_code}" -H "Authorization: Bearer $GHTOKEN" -H "Accept: application/vnd.github+json" https://api.github.com/user)
HTTPCODE=$(echo "$RESP" | sed -n 's/^HTTP://p')
GHUSER=$(echo "$RESP" | sed -n 's/^ *"login": *"\([^"]*\)".*/\1/p' | head -1)
if [ -z "$GHUSER" ]; then
  echo "GitHub did not accept the token (HTTP $HTTPCODE, token length ${#GHTOKEN} characters)."
  echo "Tip: copy the token again from GitHub; a classic token starts with ghp_ and is 40 characters."
  read -p "Press Enter"; exit 1
fi
echo "GitHub username: $GHUSER"

echo "== Checking that no secrets will be committed"
git rm -r --cached --quiet video server/data deploy 2>/dev/null
git add -A
if git diff --cached --name-only | grep -E '(^|/)\.env$|ai-errors\.log|\.db$'; then
  echo "STOP: a secret or data file is staged. Nothing was pushed."; read -p "Press Enter"; exit 1
fi
# Fix the author email of the earlier local commit if it was made with an email instead of a username.
if git log -1 --format=%ae | grep -q '@.*@'; then git -c user.name="Chun Kit Kwong" -c user.email="${GHUSER}@users.noreply.github.com" commit -q --amend --no-edit --reset-author; fi
git -c user.name="Chun Kit Kwong" -c user.email="${GHUSER}@users.noreply.github.com" commit -q -m "Docs: document CodePipeline continuous deployment from GitHub to Elastic Beanstalk" || echo "(nothing new to commit)"
git log --oneline | head -5

echo "== Creating repository $GHUSER/$REPO"
CODE=$(curl -s -o /tmp/gh_create.json -w "%{http_code}" -H "Authorization: Bearer $GHTOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/user/repos -d "{\"name\":\"$REPO\",\"description\":\"LogLens - AI triage for failed LTE/5G test logs (React, Express, SQLite, Claude API, AWS Elastic Beanstalk)\",\"homepage\":\"http://loglens-aiml515.us-east-1.elasticbeanstalk.com/\",\"private\":false}")
if [ "$CODE" = "201" ]; then echo "Repository created."; elif grep -q "already exists" /tmp/gh_create.json; then echo "Repository already exists, continuing."; else echo "Could not create repository (HTTP $CODE):"; cat /tmp/gh_create.json | head -5; read -p "Press Enter"; exit 1; fi
rm -f /tmp/gh_create.json

echo "== Pushing"
git push "https://${GHUSER}:${GHTOKEN}@github.com/${GHUSER}/${REPO}.git" main 2>&1 | sed "s/${GHTOKEN}/***/g"
git remote remove origin 2>/dev/null; git remote add origin "https://github.com/${GHUSER}/${REPO}.git"
unset GHTOKEN
echo; echo "Done: https://github.com/${GHUSER}/${REPO}"
open "https://github.com/${GHUSER}/${REPO}"
read -p "Press Enter to close"
