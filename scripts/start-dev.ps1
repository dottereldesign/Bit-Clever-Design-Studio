param([switch]$Check)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$launchExitCode = 0

try {
    $nodeCommand = Get-Command node.exe -ErrorAction Stop
    $null = Get-Command cargo.exe -ErrorAction Stop
    if (-not (Test-Path -LiteralPath (Join-Path $projectDirectory 'node_modules\@tauri-apps\cli\tauri.js'))) {
        throw 'Dependencies are missing. Run npm ci in the project folder once, then open Design Dev again.'
    }

    if ($Check) {
        Write-Output 'Design Dev prerequisites found: Node.js, Cargo and Tauri CLI. No app was launched.'
        exit 0
    }

    if ($env:LOCALAPPDATA -match '[\\/]Packages[\\/]OpenAI\.Codex_') {
        throw 'Open Design Dev from your Windows desktop, outside Codex, so it uses your normal library.'
    }
    if ($env:DESIGN_VIEWER_TEST_DATA) {
        throw 'A test-library override is active. Open Design Dev from your normal Windows desktop instead.'
    }

    $Host.UI.RawUI.WindowTitle = 'Design Dev - live updates'
    Write-Host 'Design Dev: leave this terminal and the app open while editing.'
    Write-Host 'The first startup may compile Rust. Later CSS and frontend edits update live.'
    Write-Host 'On first launch, confirm your expected projects and library are present.'
    Push-Location -LiteralPath $projectDirectory
    try {
        & $nodeCommand.Source (Join-Path $PSScriptRoot 'desktop.mjs') dev
        $launchExitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    $launchExitCode = 1
}

if ($launchExitCode -ne 0 -and -not $Check) {
    Read-Host 'Press Enter to close' | Out-Null
}
exit $launchExitCode
