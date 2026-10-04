$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$robotGh = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $robotGh -and (Test-Path -LiteralPath 'C:\Program Files\GitHub CLI\gh.exe')) {
    $robotGh = 'C:\Program Files\GitHub CLI\gh.exe'
}
if (-not $robotGh) { throw 'GitHub CLI is missing. Install it and sign in with gh auth login first.' }

function Invoke-RobotGh {
    param([string[]]$Arguments)
    $result = & $robotGh @Arguments
    if ($LASTEXITCODE -ne 0) { throw "GitHub command failed: gh $($Arguments -join ' ')" }
    return $result
}
function Invoke-RobotGit {
    param([string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Git command failed: git $($Arguments -join ' ')" }
}
function Invoke-RobotProbe {
    param([string]$Executable, [string[]]$Arguments)
    $ErrorActionPreference = 'Continue'
    $output = & $Executable @Arguments 2>$null
    return @{ Code = $LASTEXITCODE; Output = $output }
}

$robotOwner = (Invoke-RobotGh -Arguments @('api', 'user', '--jq', '.login')).Trim()
if ($robotOwner -ne 'LazzLou') { throw "Signed in as $robotOwner; expected LazzLou. Run gh auth switch first." }
$robotRepo = "$robotOwner/robot-motion-web"
$robotOriginProbe = Invoke-RobotProbe -Executable 'git' -Arguments @('remote', 'get-url', 'origin')
$robotOrigin = $robotOriginProbe.Output
if ($robotOriginProbe.Code -eq 0) {
    if ($robotOrigin -notin @("https://github.com/$robotRepo.git", "https://github.com/$robotRepo", "git@github.com:$robotRepo.git")) {
        throw "Existing origin points elsewhere: $robotOrigin. It has not been changed."
    }
    $robotVisibility = Invoke-RobotGh -Arguments @('repo', 'view', $robotRepo, '--json', 'visibility', '--jq', '.visibility')
    if ($robotVisibility.Trim() -ne 'PUBLIC') { throw 'Existing repository is not public. Inspect it before proceeding.' }
} else {
    $robotExisting = Invoke-RobotProbe -Executable $robotGh -Arguments @('repo', 'view', $robotRepo, '--json', 'nameWithOwner')
    if ($robotExisting.Code -eq 0) { throw "$robotRepo already exists without a matching local origin. Inspect it before connecting; nothing was overwritten." }
    Write-Host "Creating public repository $robotRepo"
    Invoke-RobotGh -Arguments @('repo', 'create', $robotRepo, '--public', '--description', 'Interactive two-link robot and configuration-space demonstration', '--source', '.', '--remote', 'origin')
}

Invoke-RobotGit -Arguments @('add', '.github', '.gitignore', 'README.md', 'Start.ps1', 'Publish-GitHub.ps1', 'dist', 'package.json', 'serve.mjs', 'tests')
& git diff --cached --quiet
if ($LASTEXITCODE -eq 1) { Invoke-RobotGit -Arguments @('commit', '-m', 'Prepare robot motion app for GitHub Pages') }
elseif ($LASTEXITCODE -ne 0) { throw 'Unable to inspect staged changes.' }
Invoke-RobotGit -Arguments @('branch', '-M', 'main')
Invoke-RobotGh -Arguments @('auth', 'setup-git', '--hostname', 'github.com')
Invoke-RobotGit -Arguments @('push', '-u', 'origin', 'main')

Write-Host 'Configuring GitHub Pages'
$robotPages = Invoke-RobotProbe -Executable $robotGh -Arguments @('api', "repos/$robotRepo/pages")
if ($robotPages.Code -eq 0) {
    Invoke-RobotGh -Arguments @('api', '--method', 'PUT', "repos/$robotRepo/pages", '-f', 'build_type=workflow') | Out-Null
} else {
    Invoke-RobotGh -Arguments @('api', '--method', 'POST', "repos/$robotRepo/pages", '-f', 'build_type=workflow') | Out-Null
}

# Dispatch after enabling Pages; the first push may have run before it was enabled.
$robotDispatchAfter = [DateTimeOffset]::UtcNow.AddSeconds(-5)
Invoke-RobotGh -Arguments @('workflow', 'run', 'pages.yml', '--repo', $robotRepo, '--ref', 'main')
$robotHead = (& git rev-parse HEAD).Trim()
$robotRun = $null
for ($robotAttempt = 0; $robotAttempt -lt 30; $robotAttempt++) {
    $robotRuns = (Invoke-RobotGh -Arguments @('run', 'list', '--repo', $robotRepo, '--workflow', 'pages.yml', '--event', 'workflow_dispatch', '--limit', '10', '--json', 'databaseId,headSha,createdAt')) -join "`n"
    $robotParsedRuns = ConvertFrom-Json -InputObject $robotRuns
    $robotRun = $robotParsedRuns | Where-Object {
        $_.headSha -eq $robotHead -and [DateTimeOffset]::Parse($_.createdAt) -ge $robotDispatchAfter
    } | Select-Object -First 1
    if ($robotRun) { break }
    Start-Sleep -Seconds 2
}
if (-not $robotRun) { throw "Workflow was dispatched, but its run was not found. Check https://github.com/$robotRepo/actions" }
Invoke-RobotGh -Arguments @('run', 'watch', [string]$robotRun.databaseId, '--repo', $robotRepo, '--exit-status')
$robotUrl = (Invoke-RobotGh -Arguments @('api', "repos/$robotRepo/pages", '--jq', '.html_url')).Trim()
if (-not $robotUrl.StartsWith('https://')) { throw 'Deployment succeeded, but GitHub did not return an HTTPS URL.' }
$robotVerified = $false
for ($robotAttempt = 0; $robotAttempt -lt 12; $robotAttempt++) {
    try {
        $robotResponse = Invoke-WebRequest -Uri $robotUrl -UseBasicParsing -TimeoutSec 15
        if ($robotResponse.StatusCode -eq 200 -and $robotResponse.Content -match 'Robot motion with obstacles') { $robotVerified = $true; break }
    } catch { }
    Start-Sleep -Seconds 5
}
if (-not $robotVerified) { throw "GitHub reports a successful deployment, but the page could not yet be verified. Check $robotUrl" }
Invoke-RobotGh -Arguments @('repo', 'edit', $robotRepo, '--homepage', $robotUrl)
Write-Host "`nLive website: $robotUrl"
Write-Host "Repository: https://github.com/$robotRepo"
