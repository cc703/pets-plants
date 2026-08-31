$ErrorActionPreference = 'Stop'

function Invoke-ReleaseCheck {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  $startedAt = Get-Date
  Write-Host "[pre-release] START $Name"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "[pre-release] FAIL $Name (exit code $LASTEXITCODE)"
  }
  $duration = ((Get-Date) - $startedAt).TotalSeconds.ToString('0.0')
  Write-Host "[pre-release] PASS $Name (${duration}s)"
}

Invoke-ReleaseCheck -Name 'typecheck' -Command { npm run typecheck }
Invoke-ReleaseCheck -Name 'unit checks' -Command { npm run test:unit }
Invoke-ReleaseCheck -Name 'sensitive config scan' -Command { npm run test:secrets }
Invoke-ReleaseCheck -Name 'migration tests' -Command { npm run test:migrations }
Invoke-ReleaseCheck -Name 'database summary' -Command { npm run db:summary }
Invoke-ReleaseCheck -Name 'server smoke' -Command { npm run test:server:smoke }
Invoke-ReleaseCheck -Name 'web build' -Command { npm run build:web }
Invoke-ReleaseCheck -Name 'UI smoke' -Command { npm run test:ui:smoke }
Invoke-ReleaseCheck -Name 'test data dry-run' -Command { npm run db:cleanup:dry-run }
Invoke-ReleaseCheck -Name 'git whitespace check' -Command { git diff --check }

Write-Host '[pre-release] PASS all checks'
