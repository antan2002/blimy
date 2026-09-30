# Blimy shell integration for PowerShell (Windows PowerShell 5.1 and pwsh 7+).
# Loaded with -NoExit -Command so the user's profile has already run; wraps the
# prompt to emit OSC 133 marks and OSC 7 directory reports, and uses PSReadLine
# to mark the moment a command starts.
if ($env:BLIMY_SHELL_INTEGRATION_LOADED -or -not $env:BLIMY_SHELL_INTEGRATION) {
    return
}
$env:BLIMY_SHELL_INTEGRATION_LOADED = "1"

$Global:__BlimyEsc = [char]27
$Global:__BlimyBel = [char]7
$Global:__BlimyCommandRunning = $false
$Global:__BlimyUserPrompt = $null
if (Test-Path Function:\Prompt) {
    $Global:__BlimyUserPrompt = (Get-Item Function:\Prompt).ScriptBlock
}

function Global:__BlimyOsc([string] $payload) {
    return "$Global:__BlimyEsc]$payload$Global:__BlimyBel"
}

function Global:__BlimyCurrentDirectoryReport {
    $path = $PWD.ProviderPath
    if (-not $path) {
        return ""
    }
    $path = $path -replace '\\', '/'
    if ($path -notmatch '^/') {
        $path = "/$path"
    }
    $host_name = if ($env:COMPUTERNAME) { $env:COMPUTERNAME } else { "localhost" }
    return __BlimyOsc "7;file://$host_name$path"
}

function Global:Prompt {
    $lastSucceeded = $?
    $nativeExit = $Global:LASTEXITCODE
    $exitCode = if ($lastSucceeded) { 0 } elseif ($nativeExit -is [int] -and $nativeExit -ne 0) { $nativeExit } else { 1 }

    $output = ""
    if ($Global:__BlimyCommandRunning) {
        $output += __BlimyOsc "133;D;$exitCode"
        $Global:__BlimyCommandRunning = $false
    }
    $output += __BlimyCurrentDirectoryReport
    $output += __BlimyOsc "133;A"

    $promptText = if ($Global:__BlimyUserPrompt) { & $Global:__BlimyUserPrompt } else { "PS $($PWD.Path)> " }
    if ($promptText -is [array]) {
        $promptText = -join $promptText
    }

    return "$output$promptText$(__BlimyOsc '133;B')"
}

if (Get-Module -Name PSReadLine) {
    Set-PSReadLineKeyHandler -Chord Enter -ScriptBlock {
        $Global:__BlimyCommandRunning = $true
        [Console]::Write((__BlimyOsc "133;C"))
        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
    }
}
