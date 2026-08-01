$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
python -m http.server 5173 --bind 127.0.0.1

