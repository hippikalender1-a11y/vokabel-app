param([string]$msg = "Update")
git add .
git commit -m $msg
git push
npm run deploy
