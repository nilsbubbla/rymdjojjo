param(
  [Parameter(Mandatory = $true)] [string] $InputPath,
  [Parameter(Mandatory = $true)] [string] $OutputPath
)

Add-Type -AssemblyName System.Drawing
$sourcePath = (Resolve-Path -LiteralPath $InputPath).Path
$source = [System.Drawing.Bitmap]::new($sourcePath)
$bitmap = [System.Drawing.Bitmap]::new(
  $source.Width,
  $source.Height,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.DrawImageUnscaled($source, 0, 0)
$graphics.Dispose()
$source.Dispose()

try {
  for ($y = 0; $y -lt $bitmap.Height; $y++) {
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
      $color = $bitmap.GetPixel($x, $y)
      $high = [Math]::Max($color.R, [Math]::Max($color.G, $color.B))
      $low = [Math]::Min($color.R, [Math]::Min($color.G, $color.B))
      if ($low -ge 222 -and ($high - $low) -le 18) {
        $bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $color.R, $color.G, $color.B))
      }
    }
  }
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  $bitmap.Dispose()
}
