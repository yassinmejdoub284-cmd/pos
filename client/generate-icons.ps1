# PowerShell script to generate PWA icons
Add-Type -AssemblyName System.Drawing

$sourceImage = 'c:\Users\moufa\Desktop\SoluMove EcoSystem\erp-pos\client\public\favicons\android-chrome-512x512.png'
$outputDir = 'c:\Users\moufa\Desktop\SoluMove EcoSystem\erp-pos\client\public\favicons'
$sizes = @(72, 96, 128, 144, 152, 384)

Write-Host "Generating PWA icons..." -ForegroundColor Cyan

try {
    if (-not (Test-Path $sourceImage)) {
        throw "Source image not found at $sourceImage"
    }

    $source = [System.Drawing.Image]::FromFile($sourceImage)
    
    foreach ($size in $sizes) {
        $fileName = "android-chrome-${size}x${size}.png"
        $outputFile = Join-Path $outputDir $fileName
        
        try {
            $bitmap = New-Object System.Drawing.Bitmap $size, $size
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            
            # Set high quality rendering
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

            # Draw the resized image
            $graphics.DrawImage($source, 0, 0, $size, $size)
            
            # Save as PNG
            $bitmap.Save($outputFile, [System.Drawing.Imaging.ImageFormat]::Png)
            
            $graphics.Dispose()
            $bitmap.Dispose()
            
            Write-Host "✓ Generated $fileName" -ForegroundColor Green
        }
        catch {
            Write-Host "✗ Failed to generate $fileName : $_" -ForegroundColor Red
        }
    }
    
    $source.Dispose()
    Write-Host "`nAll icons generated successfully!" -ForegroundColor Green
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
