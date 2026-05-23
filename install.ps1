# ─── 为人民服务 · 安装脚本 (Windows) ───

# PowerShell 5.1 UTF-8 support
chcp 65001 >$null 2>&1
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  为人民服务 · Serve the People" -ForegroundColor Cyan
Write-Host "  OpenCode 插件安装" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ─── 检查 Bun ───
$bun = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bun) {
    Write-Host "Error: 需要 Bun (https://bun.sh)" -ForegroundColor Red
    Write-Host "  安装: powershell -c `"irm bun.sh/install.ps1 | iex`""
    exit 1
}
$bunVer = bun --version
Write-Host "[OK] Bun $bunVer" -ForegroundColor Green

# ─── 搜索 OpenCode 配置文件 ───
$configCandidates = @(
    [System.IO.Path]::Combine($env:APPDATA, "opencode", "opencode.jsonc"),
    [System.IO.Path]::Combine($env:USERPROFILE, ".config", "opencode", "opencode.jsonc"),
    ".opencode\opencode.jsonc"
)
$openCodeConfig = $null
foreach ($c in $configCandidates) {
    if (Test-Path $c) {
        $openCodeConfig = $c
        break
    }
}

if ($openCodeConfig) {
    Write-Host "[OK] OpenCode 配置文件: $openCodeConfig" -ForegroundColor Green
} else {
    Write-Host "[WARN] 未找到 OpenCode 配置文件" -ForegroundColor Yellow
    $openCodeConfig = [System.IO.Path]::Combine($env:APPDATA, "opencode", "opencode.jsonc")
    Write-Host "  将使用: $openCodeConfig" -ForegroundColor Gray
}
Write-Host ""

# ─── 安装依赖 + 构建 ───
Write-Host "=> 安装依赖..." -ForegroundColor Yellow
bun install
Write-Host ""

Write-Host "=> 构建..." -ForegroundColor Yellow
bun run build
Write-Host ""

# ─── 检查构建产物 ───
if (-not (Test-Path "dist\index.js")) {
    Write-Host "Error: 构建失败" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] 构建成功 (dist/index.js)" -ForegroundColor Green

# ─── 注册到 OpenCode ───
$configDir = Split-Path $openCodeConfig -Parent
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

$pluginPath = $ScriptDir.Replace('\', '/')

if (Test-Path $openCodeConfig) {
    $content = Get-Content $openCodeConfig -Raw -ErrorAction SilentlyContinue
    if ($content -and $content.Contains($pluginPath)) {
        Write-Host "[OK] 插件已在 OpenCode 配置中注册" -ForegroundColor Green
    } else {
        Write-Host "=> 注册插件到 $openCodeConfig" -ForegroundColor Yellow
        # 尝试在 plugin 数组中添加
        if ($content -match '"plugin"\s*:\s*\[') {
            $content = $content -replace '"plugin"\s*:\s*\[', "`"plugin`": [`"$pluginPath`", "
            Set-Content -Path $openCodeConfig -Value $content
            Write-Host "[OK] 已注册" -ForegroundColor Green
        } else {
            Write-Host "[WARN] 无法自动修改配置，请手动添加:" -ForegroundColor Yellow
            Write-Host "  `"plugin`": [`"$pluginPath`"]" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "=> 创建 OpenCode 配置文件 $openCodeConfig" -ForegroundColor Yellow
    @"
{
  "plugin": ["$pluginPath"]
}
"@ | Set-Content -Path $openCodeConfig
    Write-Host "[OK] 配置已创建" -ForegroundColor Green
}
Write-Host ""

# ─── 完成 ───
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  安装完成！" -ForegroundColor Green
Write-Host ""
Write-Host "  重启 OpenCode 后即可使用以下 Agent:" -ForegroundColor White
Write-Host "  - guowuyuan (国务院)" -ForegroundColor Gray
Write-Host "  - fagaiwei  (发改委)" -ForegroundColor Gray
Write-Host "  - jianwei   (国家监委)" -ForegroundColor Gray
Write-Host "  - shenjishu (审计署)" -ForegroundColor Gray
Write-Host "  - danganju  (档案局)" -ForegroundColor Gray
Write-Host "  - kejibu    (科技部)" -ForegroundColor Gray
Write-Host "  - gongxinbu (工信部)" -ForegroundColor Gray
Write-Host "  - yingjibu  (应急管理部)" -ForegroundColor Gray
Write-Host "  - zhujianbu (住建部)" -ForegroundColor Gray
Write-Host "  - jiaoyubu  (教育部)" -ForegroundColor Gray
Write-Host "  - canshishi    (参事室)" -ForegroundColor Gray
Write-Host "  - xinxizhongxin (信息中心)" -ForegroundColor Gray
Write-Host "  - fenxiban      (分析办)" -ForegroundColor Gray
Write-Host ""
Write-Host "  模型配置: ~/.config/opencode/serve-the-people.jsonc" -ForegroundColor Gray
Write-Host "  插件注册: $openCodeConfig" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
