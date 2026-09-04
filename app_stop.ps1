$ErrorActionPreference = "SilentlyContinue"

# コンソールを隠して起動する構成にしたため、通常のウィンドウを閉じる方法では
# 終了できない。かわりに、このアプリのuvicornプロセスを名指しで止める。
$procs = Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -like "*it-study-app*" -and $_.CommandLine -like "*uvicorn*" }

if ($procs) {
    foreach ($proc in $procs) {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    }
    # 呼び出し元(app_stop.vbs)がこの終了コードを見て、表示するメッセージを選ぶ
    exit 0
} else {
    exit 1
}
