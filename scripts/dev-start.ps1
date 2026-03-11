# dev-start.ps1 - Start AISigma in development mode
# Launches Flask backend and Vite frontend in separate PowerShell windows

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $projectRoot "app\main.py"))) {
    $projectRoot = Get-Location
}

Write-Host ""
Write-Host "=== AISigma Dev Start ===" -ForegroundColor Magenta
Write-Host "Project root: $projectRoot" -ForegroundColor DarkGray
Write-Host ""

$frontendPath = Join-Path $projectRoot "frontend"
if (-not (Test-Path (Join-Path $frontendPath "node_modules"))) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    Push-Location $frontendPath
    npm install
    Pop-Location
    Write-Host "Done." -ForegroundColor Green
    Write-Host ""
}

Write-Host "Starting Flask backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$projectRoot'; Write-Host 'Flask Backend (Ctrl+C to stop)' -ForegroundColor Yellow; python -m app.main"
) -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Starting Vite frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$frontendPath'; Write-Host 'Vite Frontend (Ctrl+C to stop)' -ForegroundColor Yellow; npm run dev"
) -WindowStyle Normal

Write-Host ""
Write-Host "=== Servers started ===" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Both servers run in separate windows." -ForegroundColor DarkGray
Write-Host ""
