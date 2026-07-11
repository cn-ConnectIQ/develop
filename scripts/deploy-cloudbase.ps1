# 玖莅 CloudBase 云托管部署脚本（非交互）
# 用法: .\scripts\deploy-cloudbase.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$envId = "connectiq-d6gc2sul3855abd4e"
$service = "connectiq-web"

Write-Host "==> 部署 $service 到 CloudBase ($envId)" -ForegroundColor Cyan

# 灰度部署选「否」
"否" | tcb cloudrun deploy `
  --serviceName $service `
  --port 3000 `
  --env-id $envId `
  --force

if ($LASTEXITCODE -ne 0) {
  Write-Host "部署失败，退出码 $LASTEXITCODE" -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "部署命令已提交，请在控制台查看构建/部署日志" -ForegroundColor Green
