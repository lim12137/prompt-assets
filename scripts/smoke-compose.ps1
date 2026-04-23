[CmdletBinding()]
param(
  [string]$ComposeFile = "docker-compose.yml",
  [string]$HealthUrl = "http://localhost:3000/api/health",
  [int]$HealthRetries = 30,
  [int]$HealthIntervalSeconds = 2
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )

  Write-Host "==> $Name"
  & $Action
}

Invoke-Step -Name "Validate compose config" -Action {
  docker compose -f $ComposeFile config | Out-Null
}

Invoke-Step -Name "Pull GHCR images" -Action {
  docker compose -f $ComposeFile pull
}

Invoke-Step -Name "Start services" -Action {
  docker compose -f $ComposeFile up -d
}

Invoke-Step -Name "Show service status" -Action {
  docker compose -f $ComposeFile ps
}

Write-Host "==> Check health endpoint: $HealthUrl"
$healthOk = $false

for ($attempt = 1; $attempt -le $HealthRetries; $attempt++) {
  try {
    $response = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 5

    if ($response.StatusCode -eq 200) {
      Write-Host "Health check passed on attempt $attempt"
      Write-Output $response.Content
      $healthOk = $true
      break
    }
  }
  catch {
    Start-Sleep -Seconds $HealthIntervalSeconds
  }
}

if (-not $healthOk) {
  throw "Health check failed after $HealthRetries attempts: $HealthUrl"
}
