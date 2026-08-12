$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$port = 8000
$venvPy = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

# python.exe の有無だけでは、venv作成後にインストールが失敗した状態を見逃してしまう。
# 実際に必要なパッケージを読み込めるかどうかで判定する。
$venvReady = $false
if (Test-Path $venvPy) {
    & $venvPy -c "import fastapi, uvicorn, sqlalchemy, jinja2, qrcode" 2>$null
    $venvReady = ($LASTEXITCODE -eq 0)
}

if (-not $venvReady) {
    Write-Host "初回セットアップを行っています。少々お待ちください..."
    if (-not (Test-Path $venvPy)) {
        python -m venv (Join-Path $PSScriptRoot ".venv")
    }
    & $venvPy -m pip install -q -r (Join-Path $PSScriptRoot "requirements.txt")
}

$dbPath = Join-Path $PSScriptRoot "data\study.db"
if (-not (Test-Path $dbPath)) {
    Write-Host "学習データを準備しています..."
    & $venvPy (Join-Path $PSScriptRoot "seed_db.py")
}

# 同じWi-Fiにつながった他の端末から開くためのアドレスを調べる。
$lanIp = $null
try {
    $lanIp = (Get-NetIPConfiguration |
        Where-Object { $null -ne $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
        Select-Object -First 1).IPv4Address.IPAddress
} catch {
    $lanIp = $null
}

# ファイアウォールで許可されていないと、他の端末から接続できない。
$fwAllowed = $false
try {
    $fwAllowed = [bool](Get-NetFirewallRule -DisplayName "STACK IT学習帳" -ErrorAction SilentlyContinue |
        Where-Object { $_.Enabled -eq "True" -and $_.Action -eq "Allow" })
} catch {
    $fwAllowed = $false
}

Write-Host ""
Write-Host "  STACK - IT学習帳" -ForegroundColor Yellow
Write-Host "  ------------------------------------------"
Write-Host "  このPC        : http://127.0.0.1:$port/"
if ($lanIp) {
    Write-Host "  他の端末から  : http://${lanIp}:$port/" -ForegroundColor Cyan
    Write-Host "                  (同じWi-Fi / LANに接続していること)"
    Write-Host "  QRコードで開く: http://127.0.0.1:$port/connect" -ForegroundColor Cyan
} else {
    Write-Host "  他の端末から  : ネットワークに接続されていないため利用できません"
}
Write-Host ""

if ($lanIp -and -not $fwAllowed) {
    Write-Host "  ※ 他の端末からつながらない場合は、管理者として起動したPowerShellで" -ForegroundColor DarkYellow
    Write-Host "     次を1度だけ実行してファイアウォールを許可してください:" -ForegroundColor DarkYellow
    Write-Host "     New-NetFirewallRule -DisplayName 'STACK IT学習帳' -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Private"
    Write-Host ""
}

Write-Host "  このウィンドウを閉じるとアプリは終了します。"
Write-Host ""

Start-Job -ScriptBlock {
    Start-Sleep -Seconds 3
    Start-Process "http://127.0.0.1:8000/"
} | Out-Null

# 0.0.0.0 で待ち受けると、LAN内の他の端末からも接続できるようになる。
# 認証機能はないため、信頼できるネットワークでのみ使うこと。
& $venvPy -m uvicorn app.main:app --host 0.0.0.0 --port $port
