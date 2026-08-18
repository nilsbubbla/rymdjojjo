param(
  [Parameter(Mandatory = $true)] [string] $InputPath,
  [Parameter(Mandatory = $true)] [string] $OutputPath
)

Add-Type -AssemblyName System.Drawing
$drawingAssembly = [System.Drawing.Bitmap].Assembly.Location
Add-Type -ReferencedAssemblies $drawingAssembly -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;

public static class ConnectedSpriteBackground
{
    private static bool IsBackdrop(Color c)
    {
        int high = Math.Max(c.R, Math.Max(c.G, c.B));
        int low = Math.Min(c.R, Math.Min(c.G, c.B));
        return low >= 222 && high - low <= 18;
    }

    public static void Remove(string inputPath, string outputPath)
    {
        using (var source = new Bitmap(inputPath))
        using (var bitmap = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(bitmap))
        {
            graphics.DrawImageUnscaled(source, 0, 0);
            int width = bitmap.Width;
            int height = bitmap.Height;
            var seen = new bool[width * height];
            var queue = new Queue<int>();

            Action<int, int> seed = (x, y) =>
            {
                int index = y * width + x;
                if (!seen[index] && IsBackdrop(bitmap.GetPixel(x, y)))
                {
                    seen[index] = true;
                    queue.Enqueue(index);
                }
            };

            for (int x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
            for (int y = 1; y < height - 1; y++) { seed(0, y); seed(width - 1, y); }

            int[] dx = { -1, 1, 0, 0 };
            int[] dy = { 0, 0, -1, 1 };
            while (queue.Count > 0)
            {
                int index = queue.Dequeue();
                int x = index % width;
                int y = index / width;
                for (int d = 0; d < 4; d++)
                {
                    int nx = x + dx[d];
                    int ny = y + dy[d];
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    int next = ny * width + nx;
                    if (seen[next] || !IsBackdrop(bitmap.GetPixel(nx, ny))) continue;
                    seen[next] = true;
                    queue.Enqueue(next);
                }
            }

            for (int y = 0; y < height; y++)
            for (int x = 0; x < width; x++)
            {
                int index = y * width + x;
                if (!seen[index]) continue;
                Color c = bitmap.GetPixel(x, y);
                bitmap.SetPixel(x, y, Color.FromArgb(0, c.R, c.G, c.B));
            }

            bitmap.Save(outputPath, ImageFormat.Png);
        }
    }
}
'@

[ConnectedSpriteBackground]::Remove((Resolve-Path -LiteralPath $InputPath), $OutputPath)
