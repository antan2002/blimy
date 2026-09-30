# blimy shell integration for PowerShell (Windows PowerShell 5.1 and pwsh 7+).
# Loaded with -NoExit -Command so the user's profile has already run; wraps the
# prompt to emit OSC 133 marks and OSC 7 directory reports, and uses PSReadLine
# to mark the moment a command starts.
if ($env:blimy_SHELL_INTEGRATION_LOADED -or -not $env:blimy_SHELL_INTEGRATION) {
    return
}
$env:blimy_SHELL_INTEGRATION_LOADED = "1"

$Global:__blimyEsc = [char]27
$Global:__blimyBel = [char]7
$Global:__blimyCommandRunning = $false
$Global:__blimyUserPrompt = $null
if (Test-Path Function:\Prompt) {
    $Global:__blimyUserPrompt = (Get-Item Function:\Prompt).ScriptBlock
}

function Global:__blimyOsc([string] $payload) {
    return "$Global:__blimyEsc]$payload$Global:__blimyBel"
}

function Global:__blimyCurrentDirectoryReport {
    $path = $PWD.ProviderPath
    if (-not $path) {
        return ""
    }
    $path = $path -replace '\\', '/'
    if ($path -notmatch '^/') {
        $path = "/$path"
    }
    $host_name = if ($env:COMPUTERNAME) { $env:COMPUTERNAME } else { "localhost" }
    return __blimyOsc "7;file://$host_name$path"
}

function Global:Prompt {
    $lastSucceeded = $?
    $nativeExit = $Global:LASTEXITCODE
    $exitCode = if ($lastSucceeded) { 0 } elseif ($nativeExit -is [int] -and $nativeExit -ne 0) { $nativeExit } else { 1 }

    $output = ""
    if ($Global:__blimyCommandRunning) {
        $output += __blimyOsc "133;D;$exitCode"
        $Global:__blimyCommandRunning = $false
    }
    $output += __blimyCurrentDirectoryReport
    $output += __blimyOsc "133;A"

    $promptText = if ($Global:__blimyUserPrompt) { & $Global:__blimyUserPrompt } else { "PS $($PWD.Path)> " }
    if ($promptText -is [array]) {
        $promptText = -join $promptText
    }

    return "$output$promptText$(__blimyOsc '133;B')"
}

if (Get-Module -Name PSReadLine) {
    Set-PSReadLineKeyHandler -Chord Enter -ScriptBlock {
        $Global:__blimyCommandRunning = $true
        [Console]::Write((__blimyOsc "133;C"))
        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
    }
}
