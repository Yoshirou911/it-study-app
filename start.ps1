$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

try {
    $venvPy = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

    if (-not (Test-Path $venvPy)) {
        if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
            Write-Host ""
            Write-Host "エラー: Python が見つかりません。" -ForegroundColor Red
            Write-Host "https://www.python.org/downloads/ からインストールしてください。"
            Write-Host "インストール時に「Add python.exe to PATH」に必ずチェックを入れてください。"
            exit 1
        }

        Write-Host "初回セットアップを行っています。少々お待ちください..."
        python -m venv (Join-Path $PSScriptRoot ".venv")

        if (-not (Test-Path $venvPy)) {
            Write-Host ""
            Write-Host "エラー: 仮想環境の作成に失敗しました。" -ForegroundColor Red
            exit 1
        }

        & $venvPy -m pip install -q -r (Join-Path $PSScriptRoot "requirements.txt")
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "エラー: 依存パッケージのインストールに失敗しました。" -ForegroundColor Red
            exit 1
        }
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
}
catch {
    Write-Host ""
    Write-Host "エラーが発生しました:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
