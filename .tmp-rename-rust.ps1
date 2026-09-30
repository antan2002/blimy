# Second pass: Rust type aliases, constants and env vars.
#
# These are internal identifiers, not crate names: `AthasRuntime`, `ATHAS_*`
# constants and `ATHAS_*` environment variables. `ATHAS_SHELL_INTEGRATION` is a
# public env var other tools read, so it is listed here as Blimy and the old
# name is kept as an accepted alias rather than dropped.

$ErrorActionPreference = "Stop"
Set-Location "C:\Users\antan\Documents\github\blimy"

# Longest-first so `AthasAppHandle` is handled before `Athas`.
$renames = @(
  @{ from = "AthasAppHandle"; to = "BlimyAppHandle" },
  @{ from = "AthasRuntime"; to = "BlimyRuntime" },
  @{ from = "ATHAS_WINDOW_MATERIAL"; to = "BLIMY_WINDOW_MATERIAL" },
  @{ from = "ATHAS_WINDOW_STATE"; to = "BLIMY_WINDOW_STATE" },
  @{ from = "ATHAS_SSH_TEST_PORT"; to = "BLIMY_SSH_TEST_PORT" },
  @{ from = "ATHAS_SHELL_INTEGRATION"; to = "BLIMY_SHELL_INTEGRATION" },
  @{ from = "athas-shell-integration"; to = "blimy-shell-integration" }
)

$files = Get-ChildItem -Path "src-tauri", "crates" -Recurse -Include "*.rs", "*.toml" -File
$changed = 0
foreach ($file in $files) {
  $text = Get-Content -LiteralPath $file.FullName -Raw
  $original = $text
  foreach ($r in $renames) { $text = $text.Replace($r.from, $r.to) }
  if ($text -ne $original) {
    [System.IO.File]::WriteAllText($file.FullName, $text, (New-Object System.Text.UTF8Encoding $false))
    $changed++
  }
}
Write-Output "rust files updated: $changed"
