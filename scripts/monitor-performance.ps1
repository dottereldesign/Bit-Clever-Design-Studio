param([ValidateRange(5,300)][int]$Seconds = 30)
$ErrorActionPreference = 'Stop'
$outputDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) '.tools\performance'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$samples = @()
$previous = @{}
for ($sample = 0; $sample -lt $Seconds; $sample++) {
    $now = [DateTime]::UtcNow
    # Process metadata only: no window titles, command lines or library contents.
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'design-viewer.exe' OR Name = 'Design.exe' OR Name = 'msedgewebview2.exe'"
    $appIds = @($processes | Where-Object Name -in @('design-viewer.exe','Design.exe') | ForEach-Object ProcessId)
    $included = @($appIds)
    do {
        $children = @($processes | Where-Object { $_.ParentProcessId -in $included -and $_.ProcessId -notin $included } | ForEach-Object ProcessId)
        $included += $children
    } while ($children.Count)
    foreach ($processId in $included) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if (-not $process) { continue }
        $cpuPercent = $null
        if ($previous.ContainsKey($processId)) {
            $elapsed = ($now - $previous[$processId].Time).TotalSeconds
            $cpuPercent = [Math]::Round(100 * ($process.CPU - $previous[$processId].CPU) / $elapsed / [Environment]::ProcessorCount, 2)
        }
        $samples += [pscustomobject]@{ time = $now.ToString('o'); pid = $processId; process = $process.ProcessName; cpuPercent = $cpuPercent; memoryMB = [Math]::Round($process.WorkingSet64 / 1MB, 1) }
        $previous[$processId] = @{ Time = $now; CPU = $process.CPU }
    }
    Start-Sleep -Seconds 1
}
$report = Join-Path $outputDirectory ('processes-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '.json')
ConvertTo-Json -InputObject $samples -Depth 3 | Set-Content -LiteralPath $report
Write-Output "Saved $($samples.Count) process samples to $report"
$samples | Group-Object process | ForEach-Object {
    [pscustomobject]@{ process = $_.Name; peakCpuPercent = ($_.Group.cpuPercent | Measure-Object -Maximum).Maximum; peakProcessMemoryMB = ($_.Group.memoryMB | Measure-Object -Maximum).Maximum }
}
