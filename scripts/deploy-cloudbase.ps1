# 玖莅 CloudBase 云托管部署脚本（非交互）
# 用法: .\scripts\deploy-cloudbase.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$envId = "connectiq-d6gc2sul3855abd4e"
$service = "connectiq-web"

Write-Host "==> 部署 $service 到 CloudBase ($envId)" -ForegroundColor Cyan

# tcb 仍会问「是否灰度」；默认已选「否」，回车即可。管道需用 cmd。
$cmd = "echo.| tcb cloudrun deploy --serviceName $service --port 3000 --env-id $envId --force"
cmd /c $cmd
if ($LASTEXITCODE -ne 0) {
  Write-Host "部署失败，退出码 $LASTEXITCODE" -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "部署已提交。构建进度:" -ForegroundColor Green
Write-Host "https://tcb.cloud.tencent.com/dev?envId=$envId#/platform-run/service/detail?serverName=$service&tabId=deploy&envId=$envId"
