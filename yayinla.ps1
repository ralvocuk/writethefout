# writetheFout.: yeni sürümü GitHub'a gönderir. GitHub kurulumu derleyip imzalar ve Releases'a koyar;
# kurulu uygulamalar bu sürümü kendiliğinden bulur.
# İlk çalıştırmada: Git ve GitHub CLI kurulur, GitHub'a giriş yapılır, imza anahtarı üretilir,
# "writethefout" deposu açılır ve anahtar depoya gizli değişken olarak eklenir.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
Start-Transcript -Path (Join-Path $root 'yayin-log.txt') -Force | Out-Null

function Adim($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Yellow }
function Hata($t) { Write-Host $t -ForegroundColor Red; Stop-Transcript | Out-Null; Read-Host 'Kapatmak için Enter'; exit 1 }
function Yenile {
  $m = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $u = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$m;$u;$env:USERPROFILE\.cargo\bin;$env:ProgramFiles\Git\cmd;$env:ProgramFiles\GitHub CLI"
}
function Var($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Utf8Yaz($path, $text) { [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding $false)) }

Yenile

# ---------- 1. Araçlar ----------
Adim '1/7 Git ve GitHub CLI'
if (-not (Var 'git')) { winget install -e --id Git.Git --accept-package-agreements --accept-source-agreements --silent; Yenile }
if (-not (Var 'gh')) { winget install -e --id GitHub.cli --accept-package-agreements --accept-source-agreements --silent; Yenile }
if (-not (Var 'git') -or -not (Var 'gh')) { Hata 'Git ya da GitHub CLI kurulamadı. Bilgisayarı yeniden başlatıp tekrar dene.' }
if (-not (Var 'npm')) { Hata 'Node.js yok. Önce KUR-VE-DERLE.bat dosyasını bir kez çalıştır.' }
Write-Host "git $(git --version) · $(gh --version | Select-Object -First 1)"

# ---------- 2. GitHub girişi ----------
Adim '2/7 GitHub hesabı'
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Tarayıcıda GitHub girişi açılacak. Ekrandaki tek kullanımlık kodu tarayıcıya gir.' -ForegroundColor Cyan
  gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { Hata 'GitHub girişi tamamlanmadı.' }
}
gh auth setup-git | Out-Null
$login = (gh api user --jq .login).Trim()
Write-Host "Giriş yapıldı: $login"

# ---------- 3. Proje bağımlılıkları ve imza anahtarı ----------
Adim '3/7 İmza anahtarı'
if (-not (Test-Path (Join-Path $root 'node_modules'))) { npm install; if ($LASTEXITCODE -ne 0) { Hata 'npm install başarısız.' } }
$keyDir = Join-Path $root 'imza'
$key = Join-Path $keyDir 'writethefout.key'
$confPath = Join-Path $root 'src-tauri\tauri.conf.json'
if (-not (Test-Path $key)) {
  New-Item -ItemType Directory -Force -Path $keyDir | Out-Null
  # şifresiz anahtar (GitHub'da gizli değişken olarak saklanır)
  npx tauri signer generate --ci -w $key -f
  if (-not (Test-Path $key)) { Hata 'İmza anahtarı üretilemedi.' }
  Write-Host "Anahtar üretildi: $key" -ForegroundColor Green
  Write-Host 'Bu klasörü (imza) bir yere yedekle. Kaybolursa eski kurulumlar yeni sürümleri kabul etmez.' -ForegroundColor Cyan
}
$pub = (Get-Content "$key.pub" -Raw).Trim()
$confText = [IO.File]::ReadAllText($confPath)
if ($confText -notmatch [regex]::Escape($pub)) {
  $confText = [regex]::Replace($confText, '"pubkey":\s*"[^"]*"', ('"pubkey": "' + $pub + '"'))
  Utf8Yaz $confPath $confText
  Write-Host 'Genel anahtar tauri.conf.json içine yazıldı.'
}

# ---------- 4. Depo ----------
Adim '4/7 GitHub deposu'
if (-not (Test-Path (Join-Path $root '.git'))) { git init | Out-Null }
git branch -M main 2>$null
if (-not (git config user.name)) { git config user.name $login }
if (-not (git config user.email)) { git config user.email "$login@users.noreply.github.com" }
$origin = git remote get-url origin 2>$null
if (-not $origin) {
  $exists = gh repo view "$login/writethefout" --json name 2>$null
  if ($LASTEXITCODE -eq 0) {
    git remote add origin "https://github.com/$login/writethefout.git"
  } else {
    Write-Host 'Herkese açık "writethefout" deposu açılıyor (güncellemelerin indirilebilmesi için açık olmalı).'
    gh repo create writethefout --public --description 'writetheFout. — senaryo yazım uygulaması' --source . --remote origin
    if ($LASTEXITCODE -ne 0) { Hata 'Depo açılamadı.' }
  }
  $origin = git remote get-url origin
}
$repo = ($origin -replace '^https://github.com/', '' -replace '\.git$', '')
Write-Host "Depo: $repo"
# güncelleme adresi: KUR-VE-DERLE ile yapılan yerel derlemeler de bu depodan güncellensin
$endpoint = "https://github.com/$repo/releases/latest/download/latest.json"
$confText = [IO.File]::ReadAllText($confPath)
if ($confText -notmatch [regex]::Escape($endpoint)) {
  $confText = [regex]::Replace($confText, '"endpoints":\s*\[[^\]]*\]', ('"endpoints": [ "' + $endpoint + '" ]'))
  Utf8Yaz $confPath $confText
  Write-Host "Güncelleme adresi yazıldı: $endpoint"
}
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo $repo --body ((Get-Content $key -Raw).Trim())
if ($LASTEXITCODE -ne 0) { Hata 'İmza anahtarı depoya eklenemedi.' }
$wf = Join-Path $root '.github\workflows'
New-Item -ItemType Directory -Force -Path $wf | Out-Null
Copy-Item (Join-Path $root 'ci\release.yml') (Join-Path $wf 'release.yml') -Force

# ---------- 5. Sürüm numarası ----------
Adim '5/7 Sürüm'
$pkgPath = Join-Path $root 'package.json'
$current = ((Get-Content $pkgPath -Raw) | ConvertFrom-Json).version
git fetch --tags origin 2>$null | Out-Null
$published = git tag -l "v$current"
if ($published) {
  $p = $current.Split('.'); $p[2] = [int]$p[2] + 1; $suggest = ($p -join '.')
} else { $suggest = $current }
$answer = Read-Host "Yeni sürüm numarası (Enter: $suggest)"
$version = if ($answer) { $answer.Trim().TrimStart('v') } else { $suggest }
if ($version -notmatch '^\d+\.\d+\.\d+$') { Hata "Geçersiz sürüm: $version (ör. 0.5.1)" }
if (git tag -l "v$version") { Hata "v$version zaten yayınlanmış. Daha büyük bir numara seç." }

$pkg = [IO.File]::ReadAllText($pkgPath)
Utf8Yaz $pkgPath ([regex]::new('"version":\s*"[^"]*"').Replace($pkg, ('"version": "' + $version + '"'), 1))
$confText = [IO.File]::ReadAllText($confPath)
Utf8Yaz $confPath ([regex]::new('"version":\s*"[^"]*"').Replace($confText, ('"version": "' + $version + '"'), 1))
$cargoPath = Join-Path $root 'src-tauri\Cargo.toml'
$cargo = [IO.File]::ReadAllText($cargoPath)
Utf8Yaz $cargoPath ([regex]::new('(?m)^version = "[^"]*"').Replace($cargo, ('version = "' + $version + '"'), 1))

# ---------- 6. Sürüm notları ----------
Adim '6/7 Sürüm notları'
$notes = Join-Path $root 'SURUM-NOTLARI.md'
Utf8Yaz $notes "writetheFout. $version`r`n`r`n- `r`n"
Write-Host 'Not Defteri açılıyor: bu sürümde neler değişti, kısaca yaz, kaydet ve kapat.'
Start-Process notepad.exe -ArgumentList "`"$notes`"" -Wait

# ---------- 7. Gönder ----------
Adim '7/7 GitHub''a gönderiliyor'
git add -A
git commit -m "writetheFout. $version" | Out-Null
git tag -a "v$version" -m "writetheFout. $version"
git push -u origin main
if ($LASTEXITCODE -ne 0) { Hata 'Gönderilemedi (git push).' }
git push origin "v$version"
if ($LASTEXITCODE -ne 0) { Hata 'Sürüm etiketi gönderilemedi.' }

Write-Host ""
Write-Host "GÖNDERİLDİ: v$version" -ForegroundColor Green
Write-Host "GitHub şimdi kurulumu derliyor (15-25 dk). İlerleme: https://github.com/$repo/actions"
Write-Host "Bitince kurulum burada olur: https://github.com/$repo/releases/latest"
Write-Host 'Kurulu writetheFout. açıldığında yeni sürümü kendisi bulur (Yardım > Güncellemeleri denetle).'
Stop-Transcript | Out-Null
Start-Process "https://github.com/$repo/actions"
Read-Host 'Kapatmak için Enter'
