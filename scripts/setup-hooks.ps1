# setup-hooks.ps1 - Install Git hooks from scripts/
# Run once after cloning the repository

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$hooksDir = Join-Path $projectRoot ".git\hooks"

if (-not (Test-Path (Join-Path $projectRoot ".git"))) {
    Write-Host "Error: not a git repository." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Installing Git hooks ===" -ForegroundColor Magenta

$hooks = @(
    @{ Source = "pre-commit"; Dest = "pre-commit" },
    @{ Source = "pre-push"; Dest = "pre-push" }
)

foreach ($h in $hooks) {
    $src = Join-Path $PSScriptRoot $h.Source
    $dst = Join-Path $hooksDir $h.Dest
    
    if (-not (Test-Path $src)) {
        Write-Host "  Skip $($h.Source): file not found" -ForegroundColor Yellow
        continue
    }
    
    Copy-Item $src $dst -Force
    Write-Host "  Installed: $($h.Dest)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Hooks are active." -ForegroundColor Green
Write-Host ""
