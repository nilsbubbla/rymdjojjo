param(
    [Parameter(Mandatory = $false)]
    [string]$Source = (Join-Path $PSScriptRoot '..\public\assets\app-icon-johannes-v2.png')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$resRoot = Join-Path $projectRoot 'android\app\src\main\res'
$densities = [ordered]@{
    'mdpi' = 48
    'hdpi' = 72
    'xhdpi' = 96
    'xxhdpi' = 144
    'xxxhdpi' = 192
}

function Write-ScaledPng {
    param(
        [System.Drawing.Image]$Image,
        [int]$Size,
        [string]$Destination
    )

    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($Image, 0, 0, $Size, $Size)
        $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
try {
    foreach ($entry in $densities.GetEnumerator()) {
        $folder = Join-Path $resRoot ("mipmap-{0}" -f $entry.Key)
        $baseSize = [int]$entry.Value
        Write-ScaledPng -Image $sourceImage -Size $baseSize -Destination (Join-Path $folder 'rymdjojjo_icon.png')
        Write-ScaledPng -Image $sourceImage -Size $baseSize -Destination (Join-Path $folder 'ic_launcher.png')
        Write-ScaledPng -Image $sourceImage -Size $baseSize -Destination (Join-Path $folder 'ic_launcher_round.png')
        Write-ScaledPng -Image $sourceImage -Size ([int]($baseSize * 2.25)) -Destination (Join-Path $folder 'ic_launcher_foreground.png')
    }
}
finally {
    $sourceImage.Dispose()
}

Write-Host "Android icons generated from $sourcePath"
