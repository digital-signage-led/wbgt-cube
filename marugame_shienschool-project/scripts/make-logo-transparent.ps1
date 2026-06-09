Add-Type -AssemblyName System.Drawing
$logoPath = (Join-Path $PSScriptRoot '..\assets\logo.png' | Resolve-Path).Path
$tmpPath = "$logoPath.tmp.png"
$bmp = [System.Drawing.Bitmap]::FromFile($logoPath)
$threshold = 48
for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -le $threshold -and $c.G -le $threshold -and $c.B -le $threshold) {
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        }
    }
}
$bmp.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Move-Item -Force $tmpPath $logoPath
Write-Host "Transparent logo saved: $logoPath"
