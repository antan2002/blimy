Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('C:\Users\antan\.gemini\antigravity-ide\brain\c2b69439-4fc0-4583-897e-f2848f9b5b05\.user_uploaded\media_1790959282508.png')
$size = [math]::Max($img.Width, $img.Height)
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$x = ($size - $img.Width) / 2
$y = ($size - $img.Height) / 2
$g.DrawImage($img, $x, $y, $img.Width, $img.Height)
$bmp.Save('C:\Users\antan\.gemini\antigravity-ide\brain\c2b69439-4fc0-4583-897e-f2848f9b5b05\.user_uploaded\media_square.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
$img.Dispose()
