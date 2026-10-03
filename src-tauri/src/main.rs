// Windows'ta sürüm derlemesinde fazladan konsol penceresi açılmasın.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  writethefout_lib::run();
}
