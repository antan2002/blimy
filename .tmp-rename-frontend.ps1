$ErrorActionPreference = "Stop"

$repo = "C:\Users\antan\Documents\github\blimy"
Set-Location $repo

$files = Get-ChildItem -Path "." -Recurse -File | Where-Object { $_.FullName -notmatch '\\(node_modules|target|\.git|\.bun-cache|dist)\\' -and $_.Extension -match '\.(ts|tsx|css|json|html|cjs|mjs|sh|plist|js)$' }

$changed = 0
foreach ($file in $files) {
  $text = Get-Content -LiteralPath $file.FullName -Raw
  $original = $text

  $text = $text -creplace 'blimy', 'blimy'
  $text = $text -creplace 'Blimy', 'Blimy'
  $text = $text -creplace 'BLIMY', 'BLIMY'

  if ($text -cne $original) {
    [System.IO.File]::WriteAllText($file.FullName, $text, (New-Object System.Text.UTF8Encoding $false))
    $changed++
  }
}

Write-Output "Root files updated: $changed"
