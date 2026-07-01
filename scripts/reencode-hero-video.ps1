# Re-encode Pinterest hero clip to upright 720x1280 portrait (requires ffmpeg on PATH).
# Run from repo root: .\scripts\reencode-hero-video.ps1

$Input = "public\videos\hero-background.mp4"
$Output = "public\videos\hero-background-portrait.mp4"

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Error "ffmpeg not found. Install from https://ffmpeg.org/download.html then re-run."
  exit 1
}

$localIn = Join-Path $env:TEMP "hero-background-src.mp4"
$localOut = Join-Path $env:TEMP "hero-background-portrait.mp4"
Copy-Item $Input $localIn -Force

ffmpeg -y -err_detect ignore_err -i $localIn `
  -vf "transpose=1,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" `
  -c:v libx264 -crf 23 -pix_fmt yuv420p -an `
  -movflags +faststart `
  $localOut

Copy-Item $localOut $Output -Force
Write-Host "Wrote $Output - replace hero-background.mp4 when satisfied with the result."
