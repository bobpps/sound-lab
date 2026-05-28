<#
.SYNOPSIS
  Generate isolated dev-server port configuration for a sound-lab worktree.

.DESCRIPTION
  Writes backend/.env.local and frontend/.env.local inside the current worktree
  with unique BACKEND_PORT and FRONTEND_PORT values derived from the GitHub
  issue number. Mainline checkout (without these files) keeps using the
  defaults 3000 / 5173.

  Offset formula: ((IssueNumber % 99) + 1)
    Backend port:  3000 + offset  (range 3001..3099)
    Frontend port: 5173 + offset  (range 5174..5272)

.PARAMETER IssueNumber
  Positive integer GitHub issue number associated with this worktree.

.PARAMETER Force
  Overwrite existing .env.local files. Default is to refuse.

.EXAMPLE
  pwsh ../../scripts/setup-worktree-env.ps1 -IssueNumber 81
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [int]$IssueNumber,

    [switch]$Force
)

$ErrorActionPreference = 'Stop'

if ($IssueNumber -le 0) {
    Write-Error "IssueNumber must be a positive integer (got $IssueNumber)."
    exit 1
}

$offset = ($IssueNumber % 99) + 1
$backendPort = 3000 + $offset
$frontendPort = 5173 + $offset

$worktreeRoot = (Get-Location).Path
$backendEnv = Join-Path $worktreeRoot 'backend\.env.local'
$frontendEnv = Join-Path $worktreeRoot 'frontend\.env.local'

foreach ($path in @($backendEnv, $frontendEnv)) {
    if ((Test-Path $path) -and -not $Force) {
        Write-Error "Refusing to overwrite existing file: $path. Pass -Force to regenerate."
        exit 1
    }
}

$backendContent = "PORT=$backendPort`n"
$frontendContent = "BACKEND_PORT=$backendPort`nFRONTEND_PORT=$frontendPort`n"

Set-Content -Path $backendEnv -Value $backendContent -Encoding utf8 -NoNewline
Set-Content -Path $frontendEnv -Value $frontendContent -Encoding utf8 -NoNewline

Write-Output "Worktree port assignment for issue ${IssueNumber}:"
Write-Output "  Backend:  http://localhost:$backendPort"
Write-Output "  Frontend: http://localhost:$frontendPort"
