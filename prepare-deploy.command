#!/bin/bash
# LogLens: check tools, build the React app, and create the Elastic Beanstalk upload zip.
cd "$(dirname "$0")"
mkdir -p deploy
OUT=deploy/diag.txt
{
  echo "== date"; date
  echo "== tools"
  for t in node npm git gh aws eb zip; do printf "%-5s " $t; command -v $t >/dev/null && ($t --version 2>&1 | head -1) || echo "NOT INSTALLED"; done
  echo "== aws identity (account only)"
  aws sts get-caller-identity --query '{Account:Account,Arn:Arn}' --output text 2>&1 | head -3
  echo "== aws region"; aws configure get region 2>&1
  echo "== elastic beanstalk environments"
  aws elasticbeanstalk describe-environments --query 'Environments[].[ApplicationName,EnvironmentName,Status,Health,CNAME,PlatformArn]' --output text 2>&1 | head -10
  echo "== github"; gh auth status 2>&1 | head -4
  echo "== git"; git remote -v; git status --short | head -20
} > "$OUT" 2>&1
cat "$OUT"

echo; echo "== Building React app ..."
npm run build --prefix client || { echo "BUILD FAILED"; read -p "Press Enter to close"; exit 1; }

echo "== Creating deploy bundle ..."
rm -rf deploy/bundle && mkdir -p deploy/bundle/server deploy/bundle/client
cp -R server/src server/package.json deploy/bundle/server/
cp -R client/dist deploy/bundle/client/
cp -R sample-logs deploy/bundle/
node -e '
const s=require("./server/package.json");
const p={name:"loglens",version:"1.0.0",private:true,description:"LogLens - AI triage for LTE/5G test logs",
 scripts:{start:"node server/src/index.js"},engines:{node:">=20"},dependencies:s.dependencies};
require("fs").writeFileSync("deploy/bundle/package.json",JSON.stringify(p,null,2));'
STAMP=$(date +%Y%m%d-%H%M)
(cd deploy/bundle && zip -qr "../loglens-eb-$STAMP.zip" . -x "*.DS_Store")
ls -lh deploy/*.zip | tee -a "$OUT"
echo; echo "Done. Tell Claude: 好了"
read -p "Press Enter to close"
