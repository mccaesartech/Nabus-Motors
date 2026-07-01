# Compress hero videos for faster first paint (requires ffmpeg on PATH).
# Run from repo root: .\scripts\optimize-videos.ps1

$ErrorActionPreference = "Stop"

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Error "ffmpeg not found. Install from https://ffmpeg.org/download.html then re-run."
  exit 1
}

function Compress-HeroVideo {
  param(
    [string]$InputPath,
    [string]$OutputPath,
    [int]$MaxWidth = 1280,
    [int]$Crf = 28
  )

  if (-not (Test-Path $InputPath)) {
    Write-Warning "Skip missing: $InputPath"
    return
  }

  $dir = Split-Path $OutputPath -Parent
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }

  ffmpeg -y -i $InputPath `
    -vf "scale='min($MaxWidth,iw)':-2" `
    -c:v libx264 -crf $Crf -pix_fmt yuv420p -an `
    -movflags +faststart `
    $OutputPath

  Write-Host "Wrote $OutputPath"
}

Compress-HeroVideo -InputPath "public\videos\corporate-hero.mp4" -OutputPath "public\videos\corporate-hero-mobile.mp4" -MaxWidth 854 -Crf 30
Compress-HeroVideo -InputPath "public\videos\hero-background.mp4" -OutputPath "public\videos\hero-background-mobile.mp4" -MaxWidth 720 -Crf 30

Write-Host "Done. Commit optimized files or upload to your CDN/hosting."
