use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
  vec![
    Migration { version: 1, description: "ilk_sema", sql: include_str!("../migrations/001_init.sql"), kind: MigrationKind::Up },
    Migration { version: 2, description: "senaryo_tablolari", sql: include_str!("../migrations/002_screenplay.sql"), kind: MigrationKind::Up },
    Migration { version: 3, description: "dosya_tabanli", sql: include_str!("../migrations/003_files.sql"), kind: MigrationKind::Up },
    Migration { version: 4, description: "hedefler", sql: include_str!("../migrations/004_goals.sql"), kind: MigrationKind::Up },
  ]
}

fn mtime(path: &Path) -> Option<u128> {
  std::fs::metadata(path).ok()?.modified().ok()?.duration_since(UNIX_EPOCH).ok().map(|d| d.as_millis())
}

/* ---------- Dosyalar ---------- */

/// Dışa aktarma: seçilen yola ham bayt yazar (PDF, FDX, CSV…).
#[tauri::command]
fn write_file(path: String, data: Vec<u8>) -> Result<(), String> {
  std::fs::write(&path, data).map_err(|e| format!("Dosya yazılamadı: {e}"))
}

/// İçe aktarma: dosyayı ham bayt olarak okur (zip biçimleri dahil).
#[tauri::command]
fn read_file(path: String) -> Result<Vec<u8>, String> {
  std::fs::read(&path).map_err(|e| format!("Dosya okunamadı: {e}"))
}

#[derive(serde::Serialize)]
struct TextFile {
  text: String,
  mtime: Option<u128>,
}

/// Senaryo dosyasını UTF-8 metin olarak okur ve değiştirilme zamanını döndürür.
#[tauri::command]
fn read_text(path: String) -> Result<TextFile, String> {
  let bytes = std::fs::read(&path).map_err(|e| format!("Dosya açılamadı: {e}"))?;
  Ok(TextFile { text: String::from_utf8_lossy(&bytes).into_owned(), mtime: mtime(Path::new(&path)) })
}

/// Güvenli kayıt: önce geçici dosyaya yazar, diske işler, sonra eskisinin yerine taşır.
/// Kayıt sırasında elektrik kesilse bile ya eski ya yeni dosya bütün kalır.
#[tauri::command]
fn write_text(path: String, text: String) -> Result<Option<u128>, String> {
  use std::io::Write;
  let target = PathBuf::from(&path);
  let tmp = target.with_extension(format!(
    "{}.wtf-tmp",
    target.extension().and_then(|e| e.to_str()).unwrap_or("fountain")
  ));
  {
    let mut f = std::fs::File::create(&tmp).map_err(|e| format!("Dosya yazılamadı: {e}"))?;
    f.write_all(text.as_bytes()).map_err(|e| format!("Dosya yazılamadı: {e}"))?;
    f.sync_all().map_err(|e| format!("Dosya diske yazılamadı: {e}"))?;
  }
  std::fs::rename(&tmp, &target).map_err(|e| {
    let _ = std::fs::remove_file(&tmp);
    format!("Dosya kaydedilemedi: {e}")
  })?;
  Ok(mtime(&target))
}

/// Dosyanın değiştirilme zamanı (başka bir programın değiştirip değiştirmediğini anlamak için).
#[tauri::command]
fn file_mtime(path: String) -> Option<u128> {
  mtime(Path::new(&path))
}

#[tauri::command]
fn file_exists(path: String) -> bool {
  Path::new(&path).is_file()
}

/// Uygulama bir .fountain dosyasıyla açıldıysa (çift tıklama) o dosyanın yolu.
#[tauri::command]
fn startup_file() -> Option<String> {
  std::env::args()
    .skip(1)
    .find(|a| !a.starts_with('-') && Path::new(a).is_file())
}

/* ---------- Yedek kasası ---------- */

const KEEP_BACKUPS: usize = 80;

fn backup_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("yedekler");
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir)
}

fn safe(name: &str) -> String {
  name.chars().filter(|c| c.is_alphanumeric() || matches!(c, '-' | '_' | '.' | ' ')).collect()
}

#[derive(serde::Serialize)]
struct BackupEntry {
  name: String,
  size: u64,
  modified: u128,
}

fn list(dir: &PathBuf) -> Vec<BackupEntry> {
  let mut out: Vec<BackupEntry> = std::fs::read_dir(dir)
    .map(|rd| {
      rd.filter_map(|e| e.ok())
        .filter_map(|e| {
          let meta = e.metadata().ok()?;
          if !meta.is_file() {
            return None;
          }
          let modified = meta.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_millis();
          Some(BackupEntry { name: e.file_name().to_string_lossy().into_owned(), size: meta.len(), modified })
        })
        .collect()
    })
    .unwrap_or_default();
  out.sort_by(|a, b| b.modified.cmp(&a.modified));
  out
}

#[tauri::command]
fn backup_save(app: AppHandle, name: String, content: String) -> Result<(), String> {
  let dir = backup_dir(&app)?;
  std::fs::write(dir.join(safe(&name)), content).map_err(|e| e.to_string())?;
  for old in list(&dir).into_iter().skip(KEEP_BACKUPS) {
    let _ = std::fs::remove_file(dir.join(old.name));
  }
  Ok(())
}

#[tauri::command]
fn backup_list(app: AppHandle) -> Result<Vec<BackupEntry>, String> {
  Ok(list(&backup_dir(&app)?))
}

#[tauri::command]
fn backup_read(app: AppHandle, name: String) -> Result<String, String> {
  std::fs::read_to_string(backup_dir(&app)?.join(safe(&name))).map_err(|e| e.to_string())
}

#[tauri::command]
fn backup_path(app: AppHandle) -> Result<String, String> {
  Ok(backup_dir(&app)?.to_string_lossy().into_owned())
}

/* ---------- Menü çubuğu ---------- */

/// Windows menülerinde sekmeden sonrası sağa yaslı kısayol olarak görünür; tuşları arayüz işler.
fn item<R: Runtime>(app: &AppHandle<R>, id: &str, label: &str, keys: &str) -> tauri::Result<tauri::menu::MenuItem<R>> {
  let text = if keys.is_empty() { label.to_string() } else { format!("{label}\t{keys}") };
  MenuItemBuilder::with_id(id, text).build(app)
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
  let file = SubmenuBuilder::new(app, "Dosya")
    .item(&item(app, "new", "Yeni senaryo", "Ctrl+N")?)
    .item(&item(app, "new-window", "Yeni pencere", "Ctrl+Shift+N")?)
    .item(&item(app, "open", "Aç…", "Ctrl+O")?)
    .item(&item(app, "recent", "Son açılanlar…", "")?)
    .separator()
    .item(&item(app, "save", "Kaydet", "Ctrl+S")?)
    .item(&item(app, "save-as", "Farklı kaydet…", "Ctrl+Shift+S")?)
    .separator()
    .item(&item(app, "import", "İçe aktar (Final Draft, Highland, Fade In, Celtx)…", "")?)
    .item(&item(app, "export", "Dışa aktar (PDF, Fountain, Final Draft)…", "Ctrl+E")?)
    .item(&item(app, "sides", "Oyuncu sayfaları ve replik dökümü…", "")?)
    .item(&item(app, "print", "Baskı önizleme ve yazdır…", "Ctrl+P")?)
    .separator()
    .item(&item(app, "snapshot", "Anlık görüntü al", "Ctrl+5")?)
    .item(&item(app, "backups", "Yedek kasası…", "")?)
    .separator()
    .item(&item(app, "close", "Pencereyi kapat", "Ctrl+W")?)
    .build()?;
  let edit = SubmenuBuilder::new(app, "Düzen")
    .item(&item(app, "undo", "Geri al", "Ctrl+Z")?)
    .item(&item(app, "redo", "Yinele", "Ctrl+Y")?)
    .separator()
    .item(&PredefinedMenuItem::cut(app, Some("Kes"))?)
    .item(&PredefinedMenuItem::copy(app, Some("Kopyala"))?)
    .item(&PredefinedMenuItem::paste(app, Some("Yapıştır"))?)
    .item(&PredefinedMenuItem::select_all(app, Some("Tümünü seç"))?)
    .separator()
    .item(&item(app, "find", "Bul ve değiştir", "Ctrl+F")?)
    .item(&item(app, "palette", "Komut paleti", "Ctrl+K")?)
    .separator()
    .item(&item(app, "spell-toggle", "Yazım denetimi aç / kapat", "F7")?)
    .item(&item(app, "spell-next", "Sonraki yazım hatası", "F8")?)
    .item(&item(app, "dictionary", "Kişisel sözlük…", "")?)
    .build()?;
  let view = SubmenuBuilder::new(app, "Görünüm")
    .item(&item(app, "tab-write", "Yaz", "")?)
    .item(&item(app, "tab-board", "Mantar Pano", "")?)
    .item(&item(app, "tab-outline", "Anahat", "")?)
    .item(&item(app, "tab-characters", "Karakterler", "")?)
    .item(&item(app, "tab-timeline", "Zaman Çizelgesi", "")?)
    .item(&item(app, "tab-stats", "İstatistik", "")?)
    .separator()
    .item(&item(app, "focus", "Odak modu", "F11")?)
    .item(&item(app, "inspector", "Denetçi", "Ctrl+Alt+I")?)
    .separator()
    .item(&item(app, "zoom-in", "Yakınlaştır", "Ctrl++")?)
    .item(&item(app, "zoom-out", "Uzaklaştır", "Ctrl+-")?)
    .item(&item(app, "zoom-reset", "Gerçek boyut", "Ctrl+0")?)
    .separator()
    .item(&item(app, "theme-dark", "Karanlık tema aç / kapat", "Ctrl+Shift+L")?)
    .item(&item(app, "theme-paper", "Tema: Kâğıt", "")?)
    .item(&item(app, "theme-night", "Tema: Gece", "")?)
    .item(&item(app, "theme-typewriter", "Tema: Daktilo", "")?)
    .build()?;
  let script = SubmenuBuilder::new(app, "Senaryo")
    .item(&item(app, "title-page", "Başlık sayfası…", "")?)
    .item(&item(app, "add-scene", "Sona sahne ekle", "")?)
    .item(&item(app, "add-section", "Sona bölüm ekle", "")?)
    .separator()
    .item(&item(app, "dual", "Çift diyalog", "Ctrl+D")?)
    .item(&item(app, "note", "Not ekle", "Ctrl+Shift+M")?)
    .item(&item(app, "omit", "Metni kapat", "Ctrl+/")?)
    .item(&item(app, "tag", "Etiketle", "Ctrl+T")?)
    .separator()
    .item(&item(app, "lock", "Sahne numaralarını kilitle / aç", "")?)
    .separator()
    .item(&item(app, "goals", "Yazma hedefleri…", "")?)
    .item(&item(app, "sprint", "Süreli seans başlat / durdur", "")?)
    .build()?;
  let revision = SubmenuBuilder::new(app, "Revizyon")
    .item(&item(app, "rev-toggle", "Revizyon modu", "Ctrl+Shift+R")?)
    .item(&item(app, "rev-next", "Sonraki revizyon kuşağı", "")?)
    .item(&item(app, "rev-all-current", "Tüm işaretleri seçili kuşağa taşı", "")?)
    .separator()
    .item(&item(app, "rev-commit", "Revizyonları onayla", "")?)
    .build()?;
  let help = SubmenuBuilder::new(app, "Yardım")
    .item(&item(app, "shortcuts", "Klavye kısayolları", "F1")?)
    .item(&item(app, "update-check", "Güncellemeleri denetle…", "")?)
    .separator()
    .item(&item(app, "about", "writetheFout. hakkında", "")?)
    .build()?;
  MenuBuilder::new(app).items(&[&file, &edit, &view, &script, &revision, &help]).build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:writethefout.db", migrations()).build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![
      write_file,
      read_file,
      read_text,
      write_text,
      file_mtime,
      file_exists,
      startup_file,
      backup_save,
      backup_list,
      backup_read,
      backup_path
    ])
    .menu(|app| build_menu(app))
    .on_menu_event(|app, event| {
      // menü komutunu yalnızca odaktaki pencereye ilet
      let id = event.id().0.clone();
      let target = app
        .webview_windows()
        .into_values()
        .find(|w| w.is_focused().unwrap_or(false))
        .or_else(|| app.get_webview_window("main"));
      if let Some(w) = target {
        let _ = app.emit_to(tauri::EventTarget::webview_window(w.label()), "menu", id);
      }
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("writetheFout. başlatılamadı");
}
