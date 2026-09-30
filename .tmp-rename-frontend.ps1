$ErrorActionPreference = "Stop"

$repo = "C:\Users\antan\Documents\github\blimy"
Set-Location $repo

$files = Get-ChildItem -Path "." -Include "*.ts", "*.tsx", "*.css", "*.json", "*.html", "*.cjs", "*.mjs" -File

$changed = 0
foreach ($file in $files) {
  $text = Get-Content -LiteralPath $file.FullName -Raw
  $original = $text

  $text = $text -creplace 'athas', 'blimy'
  $text = $text -creplace 'Athas', 'Blimy'
  $text = $text -creplace 'ATHAS', 'BLIMY'

  if ($text -cne $original) {
    [System.IO.File]::WriteAllText($file.FullName, $text, (New-Object System.Text.UTF8Encoding $false))
    $changed++
  }
}

Write-Output "Root files updated: $changed"
