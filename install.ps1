$ErrorActionPreference = "Stop"

$Repo = "snesjhon/lazyhire"
$GHBase = "https://github.com/$Repo/releases"

Write-Host "Installing lazyhire..."

# Fetch latest version tag
$Version = (Invoke-WebRequest -Uri "$GHBase/latest/download/latest.txt" -UseBasicParsing).Content.Trim()

if (-not $Version) {
    Write-Error "Could not fetch latest version."
    exit 1
}

# Fetch manifest
$ManifestJson = (Invoke-WebRequest -Uri "$GHBase/download/$Version/manifest.json" -UseBasicParsing).Content
$Manifest = $ManifestJson | ConvertFrom-Json

$Url = $Manifest.platforms.'windows-x64'.url
$Checksum = $Manifest.platforms.'windows-x64'.sha256

if (-not $Url -or -not $Checksum) {
    Write-Error "Could not parse manifest."
    exit 1
}

# Download binary to a temp file
$Tmp = [System.IO.Path]::GetTempFileName()
Remove-Item $Tmp -Force
$Tmp = $Tmp + ".exe"
Invoke-WebRequest -Uri $Url -OutFile $Tmp -UseBasicParsing

# Verify SHA256 checksum
$ActualHash = (Get-FileHash -Path $Tmp -Algorithm SHA256).Hash.ToLower()
if ($ActualHash -ne $Checksum.ToLower()) {
    Remove-Item $Tmp -Force
    Write-Error "Checksum verification failed."
    exit 1
}

# Run the binary's own install subcommand (handles PATH setup)
& $Tmp install

# Cleanup temp file
if (Test-Path $Tmp) { Remove-Item $Tmp -Force }
