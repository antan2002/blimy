# Rebrand the Rust workspace from athas-* crates to blimy-*.
#
# Crate names and their Rust identifiers appear in three places that must move
# together: the crate's own Cargo.toml `name`, the workspace members list, and
# every `use` site. Missing one leaves a dangling dependency.

$ErrorActionPreference = "Stop"

$repo = "C:\Users\antan\Documents\github\blimy"
Set-Location $repo

# Crate name -> Rust identifier. Hyphenated names become underscored in `use`.
$crates = @(
  @{ name = "athas"; id = "athas" },
  @{ name = "athas-ai"; id = "athas_ai" },
  @{ name = "athas-database"; id = "athas_database" },
  @{ name = "athas-debugger"; id = "athas_debugger" },
  @{ name = "athas-exec-path"; id = "athas_exec_path" },
  @{ name = "athas-extensions"; id = "athas_extensions" },
  @{ name = "athas-fff-search"; id = "athas_fff_search" },
  @{ name = "athas-github"; id = "athas_github" },
  @{ name = "athas-lsp"; id = "athas_lsp" },
  @{ name = "athas-project"; id = "athas_project" },
  @{ name = "athas-remote"; id = "athas_remote" },
  @{ name = "athas-runtime"; id = "athas_runtime" },
  @{ name = "athas-terminal"; id = "athas_terminal" },
  @{ name = "athas-tooling"; id = "athas_tooling" },
  @{ name = "athas-version-control"; id = "athas_version_control" },
  @{ name = "athas-wsl"; id = "athas_wsl" }
)

# Longest name first so `athas-version-control` is replaced before `athas`.
$ordered = $crates | Sort-Object { -$_.name.Length }

$files = @(
  Get-ChildItem -Path "src-tauri", "crates" -Recurse -Include "*.rs", "Cargo.toml" -File
  Get-Item "Cargo.toml" -ErrorAction SilentlyContinue
)

$changed = 0
foreach ($file in $files) {
  $text = Get-Content -LiteralPath $file.FullName -Raw
  $original = $text

  foreach ($crate in $ordered) {
    $oldName = $crate.name
    $newName = $oldName -replace "^athas", "blimy"
    $text = $text.Replace($oldName, $newName)
  }
  foreach ($crate in $ordered) {
    $text = $text.Replace($crate.id, ($crate.id -replace "^athas", "blimy"))
  }

  if ($text -ne $original) {
    [System.IO.File]::WriteAllText($file.FullName, $text, (New-Object System.Text.UTF8Encoding $false))
    $changed++
  }
}

Write-Output "rust files updated: $changed"
