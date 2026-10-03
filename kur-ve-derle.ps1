# writetheFout.: araçları kurar ve Windows kurulum dosyasını (setup.exe) üretir.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$log = Join-Path $root 'kurulum-log.txt'
Start-Transcript -Path $log -Force | Out-Null

function Adim($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Yellow }
function Yenile {
  $m = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $u = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$m;$u;$env:USERPROFILE\.cargo\bin"
}
function Var($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

if (-not (Var 'winget')) {
  Write-Host "winget bulunamadı. Microsoft Store'dan 'Uygulama Yükleyici'yi güncelleyip tekrar dene." -ForegroundColor Red
  Stop-Transcript | Out-Null; Read-Host 'Kapatmak için Enter'; exit 1
}

Yenile
Adim '1/5 Node.js'
if (Var 'node') { Write-Host "Zaten kurulu: $(node -v)" }
else { winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent; Yenile }

Adim '2/5 Rust'
if (Var 'cargo') { Write-Host "Zaten kurulu: $(cargo -V)" }
else { winget install -e --id Rustlang.Rustup --accept-package-agreements --accept-source-agreements --silent; Yenile }
if (Var 'rustup') { rustup default stable }

Adim '3/5 Visual Studio C++ Build Tools (en uzun adım, 10-20 dk)'
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vc = $null
if (Test-Path $vswhere) { $vc = & $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath }
if ($vc) { Write-Host "Zaten kurulu: $vc" }
else {
  winget install -e --id Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements --accept-source-agreements `
    --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
}
Yenile

foreach ($c in 'node', 'npm', 'cargo') {
  if (-not (Var $c)) {
    Write-Host "$c hâlâ bulunamadı. Bilgisayarı yeniden başlatıp bu dosyayı tekrar çalıştır." -ForegroundColor Red
    Stop-Transcript | Out-Null; Read-Host 'Kapatmak için Enter'; exit 1
  }
}

Adim '4/5 Proje bağımlılıkları (npm install)'
npm install
if ($LASTEXITCODE -ne 0) { Write-Host 'npm install başarısız.' -ForegroundColor Red; Stop-Transcript | Out-Null; Read-Host 'Enter'; exit 1 }

Adim '5/5 Uygulama derleniyor (ilk seferde 5-10 dk)'
npx tauri build --bundles nsis
if ($LASTEXITCODE -ne 0) { Write-Host 'Derleme başarısız. kurulum-log.txt dosyasına bak.' -ForegroundColor Red; Stop-Transcript | Out-Null; Read-Host 'Enter'; exit 1 }

$exe = Get-ChildItem -Path (Join-Path $root 'src-tauri\target\release\bundle\nsis') -Filter '*setup.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($exe) {
  Copy-Item $exe.FullName (Join-Path $root 'writetheFout-Kurulum.exe') -Force
  Write-Host ""
  Write-Host "HAZIR: $root\writetheFout-Kurulum.exe" -ForegroundColor Green
  Write-Host "writetheFout-Kurulum.exe dosyasına çift tıklayarak uygulamayı kurabilirsin."
  Stop-Transcript | Out-Null
  explorer.exe /select,"$root\writetheFout-Kurulum.exe"
} else {
  Write-Host 'setup.exe bulunamadı.' -ForegroundColor Red
  Stop-Transcript | Out-Null
}
Read-Host 'Kapatmak için Enter'
