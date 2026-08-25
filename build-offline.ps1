# =============================================================================
#  build-offline.ps1  -  Full offline .exe build for PoS Number One
# =============================================================================

$ErrorActionPreference = "Stop"
$Root    = $PSScriptRoot
$Client  = Join-Path $Root "client"
$Server  = Join-Path $Root "server"
$Desktop = Join-Path $Root "desktop"
$Sidecar = Join-Path $Desktop "sidecar"

$env:GENERATE_SOURCEMAP = "false"
$env:NODE_ENV = "production"
$env:CARGO_INCREMENTAL = "1"

function Step($msg) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
}

# -- STEP 1 : Client dependencies ---------------------------------------------
Step "1/7  Installing client npm dependencies"
Set-Location $Client

# Remove everything to start fresh
if (Test-Path "node_modules") {
    Write-Host "Removing node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
    # On a OneDrive-synced folder, OneDrive can hold a lock on a file mid-sync
    # and silently block the delete above (-ErrorAction SilentlyContinue eats
    # the error). npm would then "install" on top of a half-deleted tree and
    # only add a handful of packages instead of doing a real clean install --
    # which is exactly what breaks "ng" / @angular/cli further down. Fail
    # loudly here instead of limping into a corrupted install.
    if (Test-Path "node_modules") {
        throw "Could not fully remove client/node_modules (likely OneDrive holding a file lock). Close/pause OneDrive (or move this project outside the OneDrive folder) and re-run."
    }
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force "package-lock.json" -ErrorAction SilentlyContinue
    if (Test-Path "package-lock.json") {
        throw "Could not remove client/package-lock.json (likely OneDrive holding a file lock). Close/pause OneDrive and re-run."
    }
}

Write-Host "Installing all client packages (3-5 minutes, ignore peer warnings)..." -ForegroundColor Cyan
# NOTE: no "2>&1 | Out-Default" here on purpose -- under $ErrorActionPreference
# = "Stop", merging a native command's stderr into the pipeline makes
# PowerShell treat every line npm writes to stderr (even harmless "npm warn"
# lines) as a terminating error and abort the whole script immediately.
# The $LASTEXITCODE check right below is what actually detects failure.
npm install --legacy-peer-deps --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
    throw "Client npm install failed - see errors above"
}

# Verify @angular/cli was installed
$ngPath = "node_modules\.bin\ng.cmd"
if (-not (Test-Path $ngPath)) {
    Write-Host "ERROR: Angular CLI not found. Trying manual install..." -ForegroundColor Red
    npm install @angular/cli@19.2.15 --save-dev --legacy-peer-deps --no-audit
    if (-not (Test-Path $ngPath)) {
        throw "@angular/cli failed to install - check network/npm registry"
    }
}

$pkgCount = (Get-ChildItem node_modules -Directory).Count
Write-Host "Client dependencies installed ($pkgCount packages)" -ForegroundColor Green

# -- STEP 2 : Build Angular (offline config) ----------------------------------
Step "2/7  Building Angular offline"
Set-Location $Client
# Wipe dist first: on OneDrive-synced folders, letting the Angular CLI rmdir
# stale files mid-build races with OneDrive/AV file locks and throws EPERM.
# Building into an already-empty folder avoids that rmdir entirely.
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
}
npm run ng -- build --configuration offline --source-map false
if ($LASTEXITCODE -ne 0) {
    throw "Angular build failed"
}
Write-Host "Angular build complete" -ForegroundColor Green

# -- STEP 3 : Server dependencies ---------------------------------------------
Step "3/7  Installing server npm dependencies"
Set-Location $Server

if (Test-Path "node_modules") {
    Write-Host "Removing node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
    if (Test-Path "node_modules") {
        throw "Could not fully remove server/node_modules (likely OneDrive holding a file lock). Close/pause OneDrive (or move this project outside the OneDrive folder) and re-run."
    }
}
if (Test-Path "package-lock.json") {
    Write-Host "Removing package-lock.json..." -ForegroundColor Yellow
    Remove-Item -Force "package-lock.json" -ErrorAction SilentlyContinue
    if (Test-Path "package-lock.json") {
        throw "Could not remove server/package-lock.json (likely OneDrive holding a file lock). Close/pause OneDrive and re-run."
    }
}

npm install --legacy-peer-deps --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
    throw "Server npm install failed"
}

# Verify prisma was installed
if (-not (Test-Path "node_modules\prisma")) {
    throw "prisma not installed - check for npm errors above"
}

Write-Host "Server dependencies installed ($((Get-ChildItem node_modules -Directory).Count) packages)" -ForegroundColor Green

# -- STEP 4 : Generate Prisma SQLite client -----------------------------------
Step "4/7  Generating Prisma SQLite client"
Set-Location $Server
npm run db:generate:sqlite
if ($LASTEXITCODE -ne 0) {
    throw "Prisma generate failed"
}
Write-Host "Prisma client generated" -ForegroundColor Green

# -- STEP 5 : Bundle server -> pos-server.exe ---------------------------------
Step "5/7  Bundling Express server with pkg"

New-Item -ItemType Directory -Force -Path $Sidecar | Out-Null

$pkgCheck = Get-Command pkg -ErrorAction SilentlyContinue
if ($pkgCheck) {
    pkg src/index.offline.js --config pkg.config.json --target node18-win-x64 --output "$Sidecar\pos-server.exe" --compress GZip
} else {
    Write-Host "pkg not found globally, using npx..." -ForegroundColor Yellow
    npx pkg src/index.offline.js --config pkg.config.json --target node18-win-x64 --output "$Sidecar\pos-server.exe" --compress GZip
}

if ($LASTEXITCODE -ne 0) {
    throw "pkg bundling failed"
}
Write-Host "Server bundled -> $Sidecar\pos-server.exe" -ForegroundColor Green

# -- STEP 6 : Copy sidecar (.exe + .env.offline) into desktop/resources ------
# IMPORTANT: tauri.conf.json only bundles files from desktop/resources/*
# (see "bundle.resources"). The pkg output above lands in desktop/sidecar/,
# which Tauri never packages on its own -- without this copy, the installer
# would silently ship whatever pos-server.exe happened to already be sitting
# in desktop/resources (a stale build), not the one just compiled.
Step "6/7  Copying sidecar into desktop/resources (what Tauri actually bundles)"
Copy-Item -Force "$Server\.env.offline" "$Sidecar\.env.offline"
$Resources = Join-Path $Desktop "resources"
New-Item -ItemType Directory -Force -Path $Resources | Out-Null
Copy-Item -Force "$Sidecar\pos-server.exe" "$Resources\pos-server.exe"
Copy-Item -Force "$Sidecar\.env.offline" "$Resources\.env.offline"

# sharp's native binaries can't be embedded in the pkg snapshot (pkg prints a
# "must be distributed with executable" warning for these two folders) --
# they have to sit on disk next to pos-server.exe as loose files.
$SharpSrc = Join-Path $Server "node_modules\sharp"
if (Test-Path $SharpSrc) {
    Write-Host "Copying sharp native binaries next to pos-server.exe..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path "$Resources\sharpuild\Release" | Out-Null
    New-Item -ItemType Directory -Force -Path "$Resources\sharpendor\lib" | Out-Null
    Copy-Item -Recurse -Force "$SharpSrcuild\Release\*" "$Resources\sharpuild\Release" -ErrorAction SilentlyContinue
    Copy-Item -Recurse -Force "$SharpSrcendor\lib\*" "$Resources\sharpendor\lib" -ErrorAction SilentlyContinue
}
Write-Host "Sidecar copied to desktop/resources" -ForegroundColor Green

# -- STEP 7a : WebView2 offline installer -------------------------------------
Step "7a/7  Checking WebView2 offline installer"
$wv2Path = Join-Path $Desktop "src-tauri\WebView2RuntimeInstaller.exe"
if (-not (Test-Path $wv2Path)) {
    Write-Host "Downloading WebView2 offline installer (~120 MB)..." -ForegroundColor Yellow
    $wv2Url = "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
    Invoke-WebRequest -Uri $wv2Url -OutFile $wv2Path -UseBasicParsing
    Write-Host "WebView2 installer downloaded" -ForegroundColor Green
} else {
    Write-Host "WebView2 installer already present - skipping" -ForegroundColor Green
}

# -- STEP 7b : Build Tauri .exe installer -------------------------------------
Step "7b/7  Building Tauri desktop installer"
Set-Location $Desktop

$tauriCmd = Get-Command "cargo-tauri" -ErrorAction SilentlyContinue
if ($tauriCmd) {
    cargo tauri build
} else {
    npx tauri build
}

if ($LASTEXITCODE -ne 0) {
    throw "Tauri build failed"
}

# -- Done ---------------------------------------------------------------------
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETE" -ForegroundColor Green
Write-Host "  Installer: desktop\src-tauri\target\release\bundle\nsis\" -ForegroundColor Green
Write-Host "  WebView2 bundled - no internet needed on target PC" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
