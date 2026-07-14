mod app;
mod document;
mod persistence;

use app::LiteMarkApp;
use eframe::egui;

fn main() -> eframe::Result {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("LiteMark")
            .with_inner_size([1200.0, 800.0])
            .with_min_inner_size([900.0, 600.0]),
        ..Default::default()
    };

    eframe::run_native(
        "LiteMark",
        options,
        Box::new(|cc| Ok(Box::new(LiteMarkApp::new(cc)))),
    )
}
