# Verifies the Express backend is actually serving before reporting success.
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\verify-startup.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\verify-startup.ps1 -TimeoutSeconds 30
#
# Exit codes: 0 = STARTED, 1 = FAILED, 2 = TIMEOUT

[CmdletBinding()]
param(
    [int]$Port = 0,
    [int]$TimeoutSeconds = 30,
    [string]$BackendRoot = ''
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($BackendRoot)) {
    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $BackendRoot = Split-Path -Parent $scriptDir
}

function Get-EnvPort {
    param([string]$EnvPath)
    if (Test-Path -LiteralPath $EnvPath) {
        $match = Select-String -LiteralPath $EnvPath -Pattern '^\s*PORT\s*=\s*(\d+)' | Select-Object -First 1
        if ($match) { return [int]$match.Matches[0].Groups[1].Value }
    }
    return $null
}

if ($Port -le 0) {
    $envPort = Get-EnvPort -EnvPath (Join-Path $BackendRoot '.env')
    if ($envPort) { $Port = $envPort } else { $Port = 5000 }
}

$entry     = Join-Path $BackendRoot 'src\server.js'
$healthUrl = "http://127.0.0.1:$Port/api/health/live"
$logDir    = Join-Path $env:TEMP 'eqra-backend'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$outLog = Join-Path $logDir "stdout-$Port.log"
$errLog = Join-Path $logDir "stderr-$Port.log"

function Test-Health {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
        if ($response -and $response.ok) { return $response }
    } catch { }
    return $null
}

function Show-Tail {
    param([string]$Path, [int]$Lines = 15)
    if (Test-Path -LiteralPath $Path) {
        Get-Content -LiteralPath $Path -Tail $Lines -ErrorAction SilentlyContinue
    }
}

try {
    Write-Host "Checking $healthUrl ..."

    # 1) Already running and healthy? Do not start a second instance.
    $existing = Test-Health
    if ($existing) {
        Write-Host "STATUS: STARTED"
        Write-Host "  already serving on port $Port (no new process started)"
        Write-Host "  health: $($existing | ConvertTo-Json -Compress)"
        exit 0
    }

    # 2) Port occupied but not responding -> do not fight over the port.
    $listening = (Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue).TcpTestSucceeded
    if ($listening) {
        Write-Host "STATUS: FAILED"
        Write-Host "  Port $Port is in use but $healthUrl did not respond."
        Write-Host "  Next: inspect the listener with: Get-NetTCPConnection -LocalPort $Port -State Listen"
        exit 1
    }

    if (-not (Test-Path -LiteralPath $entry)) {
        Write-Host "STATUS: FAILED"
        Write-Host "  Entry file not found: $entry"
        exit 1
    }

    # Start a fresh instance, capturing stdout and stderr separately.
    Remove-Item -LiteralPath $outLog, $errLog -ErrorAction SilentlyContinue
    $proc = Start-Process -FilePath 'node' -ArgumentList 'src/server.js' `
        -WorkingDirectory $BackendRoot `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog `
        -WindowStyle Hidden -PassThru

    Write-Host "  launched node (PID $($proc.Id)); polling every 1s for up to ${TimeoutSeconds}s..."

    # Bounded polling: stop on success or when the process exits.
    for ($i = 1; $i -le $TimeoutSeconds; $i++) {
        Start-Sleep -Seconds 1

        if ($proc.HasExited) {
            Write-Host "STATUS: FAILED"
            Write-Host "  process exited with code $($proc.ExitCode)"
            Write-Host "  --- stderr (tail) ---"
            Get-Content -LiteralPath $errLog -Tail 15 -ErrorAction SilentlyContinue
            Write-Host "  --- stdout (tail) ---"
            Get-Content -LiteralPath $outLog -Tail 15 -ErrorAction SilentlyContinue
            exit 1
        }

        $health = Test-Health
        if ($health) {
            Write-Host "STATUS: STARTED"
            Write-Host "  port: $Port   PID: $($proc.Id)"
            Write-Host "  health: $($health | ConvertTo-Json -Compress)"
            exit 0
        }
    }

    Write-Host "STATUS: TIMEOUT"
    Write-Host "  process (PID $($proc.Id)) is still running but $healthUrl was not healthy within ${TimeoutSeconds}s."
    Write-Host "  --- stderr (tail) ---"
    Get-Content -LiteralPath $errLog -Tail 15 -ErrorAction SilentlyContinue
    Write-Host "  Next: confirm the service binds to $Port and review $errLog"
    exit 2
}
catch {
    Write-Host "STATUS: FAILED"
    Write-Host "  unexpected error: $($_.Exception.Message)"
    exit 1
}
