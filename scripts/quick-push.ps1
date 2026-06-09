# quick-push.ps1 - Quick commit and push (when everything is already verified)
# Usage: .\scripts\quick-push.ps1 -m "feat: description"

param(
    [Parameter(Mandatory=$true)]
    [string]$m
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $projectRoot ".git"))) {
    $projectRoot = Get-Location
}

Set-Location $projectRoot

$frontSrc = git diff --name-only HEAD 2>$null | Where-Object { $_ -match '^frontend/src/' }
$frontStaged = git diff --cached --name-only 2>$null | Where-Object { $_ -match '^frontend/src/' }
$staticFresh = git diff --name-only HEAD 2>$null | Where-Object { $_ -match '^app/static/' }
$staticStaged = git diff --cached --name-only 2>$null | Where-Object { $_ -match '^app/static/' }

$frontChanged = $frontSrc + $frontStaged | Select-Object -Unique
$staticChanged = $staticFresh + $staticStaged | Select-Object -Unique

if ($frontChanged -and -not $staticChanged) {
    Write-Host ""
    Write-Host "WARNING: frontend/src changed but app/static/ not updated!" -ForegroundColor Red
    Write-Host "Run: cd frontend; npm run build" -ForegroundColor Yellow
    Write-Host ""
    $proceed = Read-Host "Continue push without build? [y/N]"
    if ($proceed -ne 'y' -and $proceed -ne 'Y') {
        Write-Host "Aborted." -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
}

git add .
$status = git status --porcelain
if (-not $status) {
    Write-Host "No changes to commit." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

git commit -m $m
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed." -ForegroundColor Red
    Write-Host ""
    exit 1
}

git push origin main 2>$null
if ($LASTEXITCODE -ne 0) {
    git push origin master 2>$null
}
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Done. Amvera will deploy automatically." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Push failed." -ForegroundColor Red
    Write-Host ""
    exit 1
}
