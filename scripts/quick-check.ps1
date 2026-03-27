Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Running quick checks..."

$requiredFiles = @(
    "index.html",
    "css/style.css",
    "js/main.js",
    "js/config.js",
    "js/submodule/sceneSetup.js",
    "js/submodule/GPUComputeSystem.js",
    "js/submodule/birdSystem.js",
    "js/submodule/recording.js",
    "js/submodule/uniformSync.js",
    "js/shaders/BoidVelocityFragmentShader.js",
    "js/shaders/BoidPositionFragmentShader.js"
)

$missing = @()
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missing += $file
    }
}

if ($missing.Count -gt 0) {
    Write-Error ("Missing required files:`n - " + ($missing -join "`n - "))
}

$configText = Get-Content -Raw "js/config.js"
if ($configText -notmatch "simulation\s*:") { Write-Error "CONFIG.simulation block not found." }
if ($configText -notmatch "environment\s*:") { Write-Error "CONFIG.environment block not found." }
if ($configText -notmatch "performance\s*:") { Write-Error "CONFIG.performance block not found." }

$mainText = Get-Content -Raw "js/main.js"
if ($mainText -notmatch "initComputeRenderer") { Write-Error "main.js missing initComputeRenderer usage." }
if ($mainText -notmatch "updatePerformanceHUD") { Write-Error "main.js missing performance HUD update." }

$shaderText = Get-Content -Raw "js/shaders/BoidVelocityFragmentShader.js"
if ($shaderText -notmatch "safeNormalize") { Write-Error "Velocity shader missing safeNormalize." }

Write-Host "Quick checks passed."
