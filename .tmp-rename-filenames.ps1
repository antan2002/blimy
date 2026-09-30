$ErrorActionPreference = "Stop"

$repo = "C:\Users\antan\Documents\github\blimy"
Set-Location $repo

$files = Get-ChildItem -Path "src", "extensions", "public" -Recurse -Filter "*athas*"
$changed = 0

foreach ($file in $files) {
    $newName = $file.Name -creplace 'athas', 'blimy' -creplace 'Athas', 'Blimy' -creplace 'ATHAS', 'BLIMY'
    if ($newName -cne $file.Name) {
        Rename-Item -Path $file.FullName -NewName $newName -PassThru
        $changed++
    }
}

Write-Output "Filenames updated: $changed"
