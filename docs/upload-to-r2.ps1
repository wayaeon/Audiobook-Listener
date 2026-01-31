# Upload a local folder to Cloudflare R2 (S3-compatible).
# Usage: .\upload-to-r2.ps1 "C:\Path\To\Audiobooks"
# Set the 4 variables below once (get them from Cloudflare R2 dashboard).

param(
    [Parameter(Mandatory = $true)]
    [string]$LocalPath
)

$R2_ACCOUNT_ID   = "YOUR_ACCOUNT_ID"      # e.g. a1b2c3d4e5f67890
$R2_ACCESS_KEY   = "YOUR_ACCESS_KEY_ID"   # from R2 API token
$R2_SECRET_KEY   = "YOUR_SECRET_ACCESS_KEY"
$R2_BUCKET      = "audibly"              # your bucket name
$R2_PREFIX      = "audiobooks/"          # must match R2_PREFIX in .env.local

if ($R2_ACCOUNT_ID -eq "YOUR_ACCOUNT_ID" -or $R2_ACCESS_KEY -eq "YOUR_ACCESS_KEY_ID") {
    Write-Error "Edit this script and set R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET at the top."
    exit 1
}

if (-not (Test-Path -LiteralPath $LocalPath -PathType Container)) {
    Write-Error "Folder not found: $LocalPath"
    exit 1
}

$endpoint = "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
$dest = "s3://$R2_BUCKET/$R2_PREFIX"

Write-Host "Uploading: $LocalPath -> $dest"
Write-Host "Endpoint: $endpoint"
$env:AWS_ACCESS_KEY_ID = $R2_ACCESS_KEY
$env:AWS_SECRET_ACCESS_KEY = $R2_SECRET_KEY
aws s3 cp $LocalPath $dest --recursive --endpoint-url $endpoint
$env:AWS_ACCESS_KEY_ID = $null
$env:AWS_SECRET_ACCESS_KEY = $null
Write-Host "Done."
