# dev-check.ps1 - Analyze changes: what needs rebuild or restart
# Shows which parts of the project are affected (frontend, backend, config)

$ErrorActionPreference = "SilentlyContinue"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $projectRoot ".git"))) {
    $projectRoot = Get-Location
}

Set-Location $projectRoot

Write-Host ""
Write-Host "=== AISigma Dev Check ===" -ForegroundColor Magenta

$changes = git diff --name-only HEAD 2>$null
$staged = git diff --cached --name-only 2>$null
$allChanges = ($changes + $staged) | Select-Object -Unique | Where-Object { $_ }

if (-not $allChanges) {
    Write-Host ""
    Write-Host "[OK] No changes in working directory." -ForegroundColor Green
    Write-Host ""
    exit 0
}

$frontChanged = $allChanges | Where-Object { $_ -match '^frontend/' }
$backChanged = $allChanges | Where-Object { $_ -match '^app/' -and $_ -notmatch '^app/static/' }
$staticChanged = $allChanges | Where-Object { $_ -match '^app/static/' }
$configChanged = $allChanges | Where-Object { $_ -match '(requirements\.txt|amvera\.yaml|package\.json|vite\.config)' }

Write-Host ""
Write-Host "Changed files:" -ForegroundColor White
$allChanges | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
Write-Host ""

$hasAction = $false

if ($frontChanged) {
    Write-Host "[FRONTEND] Frontend files changed" -ForegroundColor Cyan
    Write-Host "  -> Vite HMR will update automatically (if npm run dev is running)" -ForegroundColor DarkGray
    Write-Host "  -> Before deploy: npm run build in frontend/" -ForegroundColor Yellow
    $hasAction = $true
}

if ($backChanged) {
    Write-Host "[BACKEND]  Backend files changed" -ForegroundColor Yellow
    Write-Host "  -> Restart Flask (Ctrl+C, then python -m app.main)" -ForegroundColor DarkGray
    $hasAction = $true
}

if ($configChanged) {
    Write-Host "[CONFIG]   Config files changed" -ForegroundColor Red
    Write-Host "  -> Check manually, may need to reinstall dependencies" -ForegroundColor DarkGray
    $hasAction = $true
}

if ($frontChanged -and -not $staticChanged) {
    Write-Host ""
    Write-Host "[!] WARNING: frontend/ changed but app/static/ not updated." -ForegroundColor Red
    Write-Host "    Before push run: cd frontend; npm run build" -ForegroundColor Yellow
    Write-Host ""
}

if (-not $hasAction) {
    Write-Host "[OK] Only app/static/ or docs - no restart needed." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
}
