$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$venvPy = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPy)) {
    Write-Host "初回セットアップを行っています。少々お待ちください..."
    python -m venv (Join-Path $PSScriptRoot ".venv")
    & $venvPy -m pip install -q -r (Join-Path $PSScriptRoot "requirements.txt")
}

$dbPath = Join-Path $PSScriptRoot "data\study.db"
if (-not (Test-Path $dbPath)) {
    Write-Host "学習データを準備しています..."
    & $venvPy (Join-Path $PSScriptRoot "seed_db.py")
}

Write-Host "アプリを起動しています。ブラウザが自動的に開きます。"
Write-Host "このウィンドウを閉じるとアプリは終了します。"

Start-Job -ScriptBlock {
    Start-Sleep -Seconds 3
    Start-Process "http://127.0.0.1:8000/"
} | Out-Null

& $venvPy -m uvicorn app.main:app --host 127.0.0.1 --port 8000
