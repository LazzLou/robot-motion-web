$ErrorActionPreference = 'Stop'
$robotNode = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $robotNode) {
    $robotRuntimeRoot = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\runtimes\cua_node'
    if (Test-Path -LiteralPath $robotRuntimeRoot) {
        $robotNode = Get-ChildItem -Path (Join-Path $robotRuntimeRoot '*\bin\node.exe') -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
    }
}
if (-not $robotNode) { throw 'Install Node.js, then run this script again.' }
& $robotNode (Join-Path $PSScriptRoot 'serve.mjs')
