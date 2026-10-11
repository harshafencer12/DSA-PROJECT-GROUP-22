$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $root 'data'
$zip = Join-Path $dataDir 'ml-32m.zip'
$extractDir = Join-Path $dataDir 'ml-32m'
$url = 'https://files.grouplens.org/datasets/movielens/ml-32m.zip'

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

if (-not (Test-Path $zip)) {
    Write-Host 'Downloading MovieLens 32M (~239 MB)...' -ForegroundColor Cyan
    curl.exe -L $url -o $zip
}

if (-not (Test-Path (Join-Path $extractDir 'movies.csv'))) {
    Write-Host 'Extracting dataset...' -ForegroundColor Cyan
    Expand-Archive -Path $zip -DestinationPath $dataDir -Force
}

Write-Host ''
Write-Host 'MovieLens dataset is ready:' -ForegroundColor Green
Write-Host $extractDir
Write-Host 'Expected files: movies.csv, links.csv, ratings.csv, tags.csv'
