[CmdletBinding()]
param(
  [string]$SnapshotPath,
  [string]$DatabaseName = 'pet_planet_migration_rehearsal',
  [string]$MysqlPath = 'D:\MYSQL\bin\mysql.exe',
  [string]$ReportPath,
  [switch]$Reset
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $SnapshotPath) {
  $SnapshotPath = Join-Path $scriptRoot '..\server\schema.sql'
}
if (-not $ReportPath) {
  $ReportPath = Join-Path $scriptRoot '..\docs\release\legacy-migration-rehearsal-2026-08-24.md'
}

if ($DatabaseName -notmatch '^pet_planet_migration_rehearsal(?:_[a-zA-Z0-9-]+)?$') {
  throw "DatabaseName must be an explicitly scoped rehearsal database name."
}
if (-not (Test-Path -LiteralPath $MysqlPath)) {
  throw "mysql.exe was not found at $MysqlPath"
}
if (-not (Test-Path -LiteralPath $SnapshotPath)) {
  throw "Legacy snapshot was not found at $SnapshotPath"
}

$mysqlHost = if ($env:DB_HOST) { $env:DB_HOST } else { 'localhost' }
$mysqlPort = if ($env:DB_PORT) { $env:DB_PORT } else { '3306' }
$mysqlUser = if ($env:DB_USER) { $env:DB_USER } else { 'root' }
$envPath = Join-Path $scriptRoot '..\server\.env'
if (-not $env:DB_PASSWORD -and (Test-Path -LiteralPath $envPath)) {
  $passwordLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^DB_PASSWORD=(.*)$' } | Select-Object -First 1
  if ($passwordLine -match '^DB_PASSWORD=(.*)$') {
    $env:DB_PASSWORD = $Matches[1].Trim().Trim('"').Trim("'")
  }
}
if ($env:DB_PASSWORD) {
  # mysql reads MYSQL_PWD from this process only; avoid exposing passwords in commands or reports.
  $env:MYSQL_PWD = $env:DB_PASSWORD
}
$mysqlArgs = @("--host=$mysqlHost", "--port=$mysqlPort", "--user=$mysqlUser", '--default-character-set=utf8mb4')
$steps = [System.Collections.Generic.List[object]]::new()

function Invoke-MySqlText {
  param(
    [Parameter(Mandatory = $true)][string]$Sql,
    [string]$Label = 'SQL',
    [switch]$SkipDatabase
  )

  $started = Get-Date
  $targetArgs = if ($SkipDatabase) { $mysqlArgs } else { $mysqlArgs + "--database=$DatabaseName" }
  $output = $Sql | & $MysqlPath @targetArgs 2>&1
  $exitCode = $LASTEXITCODE
  $steps.Add([pscustomobject]@{
    label = $Label
    started = $started.ToString('o')
    exitCode = $exitCode
    output = ($output -join "`n")
  })
  if ($exitCode -ne 0) {
    throw "$Label failed (exit $exitCode): $($output -join "`n")"
  }
  return ($output -join "`n")
}

function Convert-SnapshotForDatabase {
  param([string]$Sql)
  $converted = $Sql -replace '(?im)^\s*CREATE\s+DATABASE\s+IF\s+NOT\s+EXISTS\s+pet_planet\b[^;]*;\s*', ''
  return ($converted -replace '(?im)^\s*USE\s+pet_planet\s*;', "USE $DatabaseName;")
}

function Invoke-MySqlScript {
  param(
    [Parameter(Mandatory = $true)][string]$Sql,
    [Parameter(Mandatory = $true)][string]$Label,
    [switch]$SkipDatabase
  )

  $tempPath = Join-Path ([IO.Path]::GetTempPath()) "pet-planet-migration-$([guid]::NewGuid().ToString('N')).sql"
  [IO.File]::WriteAllText($tempPath, $Sql, [Text.UTF8Encoding]::new($false))
  try {
    $started = Get-Date
    $targetArgs = if ($SkipDatabase) { $mysqlArgs } else { $mysqlArgs + "--database=$DatabaseName" }
    $quotedArgs = ($targetArgs | ForEach-Object { '"' + $_ + '"' }) -join ' '
    $commandLine = '"' + $MysqlPath + '" ' + $quotedArgs + ' < "' + $tempPath + '"'
    $output = & cmd.exe /d /c $commandLine 2>&1
    $exitCode = $LASTEXITCODE
    $steps.Add([pscustomobject]@{
      label = $Label
      started = $started.ToString('o')
      exitCode = $exitCode
      output = ($output -join "`n")
    })
    if ($exitCode -ne 0) {
      throw "$Label failed (exit $exitCode): $($output -join "`n")"
    }
  }
  finally {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }
}

function Invoke-MigrationFile {
  param([string]$FileName, [int]$Pass)
  $filePath = Join-Path $scriptRoot "..\server\migrations\$FileName"
  $sql = Get-Content -LiteralPath $filePath -Raw
  $sql = $sql -replace '(?im)^\s*USE\s+pet_planet\s*;', "USE $DatabaseName;"
  Invoke-MySqlScript $sql "$FileName pass $Pass"
}

$migrationFiles = @(
  '002_auth_tables.sql',
  '003_community_tables.sql',
  '004_posts_stats_schema.sql',
  '005_email_reset_and_rate_limit.sql',
  '006_user_pets.sql',
  '007_email_identity.sql',
  '008_backfill_post_circle_ids.sql',
  '009_email_verification.sql',
  '010_email_login_codes.sql'
)

try {
  if ($Reset) {
    Invoke-MySqlText "DROP DATABASE IF EXISTS ``$DatabaseName``" 'reset rehearsal database' -SkipDatabase
  }
  Invoke-MySqlText "CREATE DATABASE IF NOT EXISTS ``$DatabaseName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" 'create rehearsal database' -SkipDatabase
  $snapshotSql = Convert-SnapshotForDatabase (Get-Content -LiteralPath $SnapshotPath -Raw)
  Invoke-MySqlScript $snapshotSql 'legacy snapshot import'

  foreach ($pass in 1..2) {
    foreach ($migrationFile in $migrationFiles) {
      Invoke-MigrationFile $migrationFile $pass
    }
  }

  $assertionSql = @'
SELECT CONCAT('posts.stats=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME = 'stats'));
SELECT CONCAT('posts.circle_id=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME = 'circle_id'));
SELECT CONCAT('posts.circle_id_index=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME = 'circle_id' AND SEQ_IN_INDEX = 1));
SELECT CONCAT('user_pets=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_pets'));
SELECT CONCAT('users.email_unique=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email' AND NON_UNIQUE = 0));
SELECT CONCAT('users.email_verified_at=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified_at'));
SELECT CONCAT('email_verification_tokens=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_verification_tokens'));
SELECT CONCAT('email_login_codes=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_login_codes'));
SELECT CONCAT('comments.parent_id_index=', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments' AND COLUMN_NAME = 'parent_id' AND NON_UNIQUE = 1));
'@
  $assertions = Invoke-MySqlText -Sql $assertionSql -Label 'schema assertions'

  $badAssertions = $assertions -split "`n" | Where-Object {
    $_ -match '=(0|$)'
  }
  if ($badAssertions) {
    throw "Schema assertions failed: $($badAssertions -join ', ')"
  }

  $status = 'PASS'
  $summary = "Rehearsal completed successfully for $DatabaseName. Snapshot imported once; migrations 002-010 executed twice."
}
catch {
  $status = 'FAIL'
  $summary = $_.Exception.Message
  throw
}
finally {
  $reportDirectory = Split-Path -Parent $ReportPath
  New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
  $lines = @(
    '# Legacy Migration Rehearsal',
    '',
    "- Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
    "- Status: **$status**",
    "- Rehearsal database: $DatabaseName",
    "- Snapshot: $SnapshotPath",
    "- Summary: $summary",
    '',
    '## Step Log',
    '',
    '| Step | Started | Exit code | Output |',
    '| --- | --- | ---: | --- |'
  )
  foreach ($step in $steps) {
    $safeOutput = ($step.output -replace '\|', '\|' -replace "`r?`n", '<br>')
    $lines += "| $($step.label) | $($step.started) | $($step.exitCode) | $safeOutput |"
  }
  $lines += @(
    '',
    '## Recovery',
    '',
    'If a rehearsal step fails, do not continue against a deployment database. Preserve the error output, rebuild this explicitly scoped rehearsal database from the legacy snapshot, fix the failed migration, and rerun both passes.',
    '',
    'The script only permits database names beginning with `pet_planet_migration_rehearsal`; it never drops an arbitrary database. `-Reset` is required to recreate an existing rehearsal database.'
  )
  Set-Content -LiteralPath $ReportPath -Value $lines -Encoding utf8
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}
