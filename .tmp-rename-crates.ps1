# Rebrand the Rust workspace from blimy-* crates to blimy-*.
#
# Crate names and their Rust identifiers appear in three places that must move
# together: the crate's own Cargo.toml `name`, the workspace members list, and
# every `use` site. Missing one leaves a dangling dependency.

$ErrorActionPreference = "Stop"

$repo = "C:\Users\antan\Documents\github\blimy"
Set-Location $repo

# Crate name -> Rust identifier. Hyphenated names become underscored in `use`.
$crates = @(
  @{ name = "blimy"; id = "blimy" },
  @{ name = "blimy-ai"; id = "blimy_ai" },
  @{ name = "blimy-database"; id = "blimy_database" },
  @{ name = "blimy-debugger"; id = "blimy_debugger" },
  @{ name = "blimy-exec-path"; id = "blimy_exec_path" },
  @{ name = "blimy-extensions"; id = "blimy_extensions" },
  @{ name = "blimy-fff-search"; id = "blimy_fff_search" },
  @{ name = "blimy-github"; id = "blimy_github" },
  @{ name = "blimy-lsp"; id = "blimy_lsp" },
  @{ name = "blimy-project"; id = "blimy_project" },
  @{ name = "blimy-remote"; id = "blimy_remote" },
  @{ name = "blimy-runtime"; id = "blimy_runtime" },
  @{ name = "blimy-terminal"; id = "blimy_terminal" },
  @{ name = "blimy-tooling"; id = "blimy_tooling" },
  @{ name = "blimy-version-control"; id = "blimy_version_control" },
  @{ name = "blimy-wsl"; id = "blimy_wsl" }
)

# Longest name first so `blimy-version-control` is replaced before `blimy`.
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
    $newName = $oldName -replace "^blimy", "blimy"
    $text = $text.Replace($oldName, $newName)
  }
  foreach ($crate in $ordered) {
    $text = $text.Replace($crate.id, ($crate.id -replace "^blimy", "blimy"))
  }

  if ($text -ne $original) {
    [System.IO.File]::WriteAllText($file.FullName, $text, (New-Object System.Text.UTF8Encoding $false))
    $changed++
  }
}

Write-Output "rust files updated: $changed"
