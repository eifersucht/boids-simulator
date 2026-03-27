Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$port = 8000
if ($args.Count -gt 0) {
    $parsed = 0
    if ([int]::TryParse($args[0], [ref]$parsed) -and $parsed -gt 0) {
        $port = $parsed
    }
}

Write-Host "Starting static server on http://localhost:$port"
python -m http.server $port
