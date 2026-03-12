# dev-deploy.ps1 - Interactive deploy pipeline: check -> build -> commit -> push
# Asks for confirmation at each step

param(
    [string]$CommitMessage = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $projectRoot ".git"))) {
    $projectRoot = Get-Location
}

Set-Location $projectRoot

Write-Host ""
Write-Host "=== AISigma Deploy Pipeline ===" -ForegroundColor Magenta

Write-Host ""
Write-Host "[1/5] Analyzing changes..." -ForegroundColor Cyan
$status = git status --porcelain 2>$null
if (-not $status) {
    Write-Host "No changes to deploy." -ForegroundColor Green
    Write-Host ""
    exit 0
}

$frontChanged = $status | Where-Object { $_ -match '^\s*[AM].*frontend/' }
$backChanged = $status | Where-Object { $_ -match '^\s*[AM].*app/' -and $_ -notmatch 'app/static/' }

Write-Host "Changed files:" -ForegroundColor White
git status --short
Write-Host ""

if ($frontChanged) { Write-Host "  [FRONT] Frontend changed" -ForegroundColor Cyan }
if ($backChanged) { Write-Host "  [BACK]  Backend changed" -ForegroundColor Yellow }

if ($frontChanged) {
    Write-Host ""
    Write-Host "[2/5] Frontend changed. Build? (npm run build)" -ForegroundColor Cyan
    $buildChoice = Read-Host "  [y/N]"
    if ($buildChoice -eq 'y' -or $buildChoice -eq 'Y') {
        Push-Location (Join-Path $projectRoot "frontend")
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Pop-Location
            Write-Host "Build failed. Aborted." -ForegroundColor Red
            exit 1
        }
        Pop-Location
        Write-Host "  Build complete." -ForegroundColor Green
    } else {
        Write-Host "  Build skipped." -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "[2/5] Frontend build not required." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "[3/5] Changes to commit:" -ForegroundColor Cyan
git --no-pager diff --stat
Write-Host ""
$confirmDiff = Read-Host "Continue? [y/N]"
if ($confirmDiff -ne 'y' -and $confirmDiff -ne 'Y') {
    Write-Host "Aborted." -ForegroundColor Red
    Write-Host ""
    exit 1
}

if (-not $CommitMessage) {
    Write-Host ""
    Write-Host "[4/5] Enter commit message:" -ForegroundColor Cyan
    $CommitMessage = Read-Host "  "
}
if (-not $CommitMessage.Trim()) {
    Write-Host "Commit message required. Aborted." -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "[4/5] Creating commit..." -ForegroundColor Cyan
git add .
git commit -m $CommitMessage.Trim()
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed. Nothing to commit?" -ForegroundColor Red
    Write-Host ""
    exit 1
}
Write-Host "  Commit created." -ForegroundColor Green

Write-Host ""
Write-Host "[5/5] Push to origin/main?" -ForegroundColor Cyan
$pushChoice = Read-Host "  [y/N]"
if ($pushChoice -eq 'y' -or $pushChoice -eq 'Y') {
    $null = git push origin main 2>&1
    if ($LASTEXITCODE -ne 0) {
        $null = git push origin master 2>&1
    }
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "  Push done. Amvera will deploy automatically." -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "  Push failed. Check remote and branch." -ForegroundColor Red
        Write-Host ""
        exit 1
    }
} else {
    Write-Host "  Push postponed. Commit saved locally." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "=== Done ===" -ForegroundColor Magenta
Write-Host ""
