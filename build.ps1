# Đóng gói asset tối giản cho production.
# Chạy sau khi sửa assets/app.js hoặc assets/app.css.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

npx --yes esbuild assets/app.js --bundle --minify --format=esm --target=es2020 --charset=utf8 --outfile=assets/app.min.js
npx --yes esbuild assets/app.css --minify --charset=utf8 --outfile=assets/app.min.css
npx --yes esbuild assets/reset-password.js --minify --charset=utf8 --outfile=assets/reset-password.min.js

Write-Host 'Build xong: app.min.js, app.min.css, reset-password.min.js'
