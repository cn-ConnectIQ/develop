# 玖莅 CloudBase 云托管部署脚本（非交互）
# 用法: .\scripts\deploy-cloudbase.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$envId = "connectiq-d6gc2sul3855abd4e"
$service = "connectiq-web"

Write-Host "==> 部署 $service 到 CloudBase ($envId)" -ForegroundColor Cyan

# PowerShell 管道对 tcb 交互提示不稳定，用 cmd echo 自动选「否」（非灰度）
cmd /c "echo 否| tcb cloudrun deploy --serviceName $service --port 3000 --env-id $envId --force"
if ($LASTEXITCODE -ne 0) {
  Write-Host "部署失败，退出码 $LASTEXITCODE" -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "部署命令已提交，请在控制台查看构建/部署日志" -ForegroundColor Green
