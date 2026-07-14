use crate::document::Document;
use crate::persistence::{Settings, Theme};
use eframe::egui;
use egui_commonmark::{CommonMarkCache, CommonMarkViewer};
use std::path::PathBuf;
use std::time::Duration;

pub struct LiteMarkApp {
    document: Document,
    settings: Settings,
    markdown_cache: CommonMarkCache,
    show_recent: bool,
    show_settings: bool,
    preview_only: bool,
    editor_only: bool,
    status: Option<String>,
}

impl LiteMarkApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        let settings = Settings::load(cc.storage);
        apply_theme(&cc.egui_ctx, settings.theme);
        Self {
            document: Document::default(),
            settings,
            markdown_cache: CommonMarkCache::default(),
            show_recent: false,
            show_settings: false,
            preview_only: false,
            editor_only: false,
            status: None,
        }
    }

    fn open_dialog(&mut self) {
        if let Some(path) = rfd::FileDialog::new()
            .add_filter("Markdown", &["md", "markdown", "txt"])
            .pick_file()
        {
            self.open_path(path);
        }
    }

    fn open_path(&mut self, path: PathBuf) {
        match Document::open(path.clone()) {
            Ok(document) => {
                self.document = document;
                self.settings.remember(path);
                self.status = None;
            }
            Err(error) => self.status = Some(format!("Open failed: {error}")),
        }
    }

    fn save(&mut self) {
        if self.document.path().is_none() {
            self.save_as();
            return;
        }
        match self.document.save() {
            Ok(()) => {
                if let Some(path) = self.document.path() {
                    self.settings.remember(path.to_path_buf());
                }
                self.status = Some("Saved".into());
            }
            Err(error) => self.status = Some(format!("Save failed: {error}")),
        }
    }

    fn save_as(&mut self) {
        let mut dialog = rfd::FileDialog::new()
            .add_filter("Markdown", &["md", "markdown", "txt"])
            .set_file_name("note.md");
        if let Some(path) = self.document.path().and_then(|path| path.parent()) {
            dialog = dialog.set_directory(path);
        }
        let Some(path) = dialog.save_file() else {
            return;
        };
        match self.document.save_as(path.clone()) {
            Ok(()) => {
                self.settings.remember(path);
                self.status = Some("Saved".into());
            }
            Err(error) => self.status = Some(format!("Save failed: {error}")),
        }
    }

    fn shortcuts(&mut self, ctx: &egui::Context) {
        if ctx.input_mut(|input| {
            input.consume_shortcut(&egui::KeyboardShortcut::new(
                egui::Modifiers::COMMAND,
                egui::Key::O,
            ))
        }) {
            self.open_dialog();
        }
        if ctx.input_mut(|input| {
            input.consume_shortcut(&egui::KeyboardShortcut::new(
                egui::Modifiers::COMMAND,
                egui::Key::S,
            ))
        }) {
            self.save();
        }
    }

    fn toolbar(&mut self, ui: &mut egui::Ui) {
        egui::Panel::top("toolbar").show(ui, |ui| {
            ui.horizontal(|ui| {
                if ui.button("Open").clicked() {
                    self.open_dialog();
                }
                if ui.button("Save").clicked() {
                    self.save();
                }
                if ui.button("Save as").clicked() {
                    self.save_as();
                }
                ui.separator();
                if ui.selectable_label(self.editor_only, "Editor").clicked() {
                    self.editor_only = !self.editor_only;
                    self.preview_only = false;
                }
                if ui.selectable_label(self.preview_only, "Preview").clicked() {
                    self.preview_only = !self.preview_only;
                    self.editor_only = false;
                }
                if ui.button("Recent").clicked() {
                    self.show_recent = !self.show_recent;
                }
                if ui.button("Settings").clicked() {
                    self.show_settings = !self.show_settings;
                }
                ui.separator();
                ui.label(
                    self.document
                        .path()
                        .and_then(|path| path.file_name())
                        .and_then(|name| name.to_str())
                        .unwrap_or("Untitled"),
                );
                if let Some(status) = &self.status {
                    ui.weak(status);
                }
            });
        });
    }

    fn recent_panel(&mut self, ui: &mut egui::Ui) {
        if !self.show_recent {
            return;
        }
        egui::Panel::left("recent_files")
            .default_size(260.0)
            .show(ui, |ui| {
                ui.heading("Recent files");
                ui.separator();
                let paths = self.settings.recent_files.clone();
                for path in paths {
                    let label = path
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("Unknown");
                    if ui
                        .selectable_label(false, label)
                        .on_hover_text(path.display().to_string())
                        .clicked()
                    {
                        self.open_path(path);
                    }
                }
            });
    }

    fn settings_window(&mut self, ctx: &egui::Context) {
        if !self.show_settings {
            return;
        }
        let mut open = self.show_settings;
        egui::Window::new("Settings")
            .open(&mut open)
            .resizable(false)
            .show(ctx, |ui| {
                ui.label("Theme");
                ui.horizontal(|ui| {
                    for (theme, label) in [
                        (Theme::Light, "Light"),
                        (Theme::System, "System"),
                        (Theme::Dark, "Dark"),
                    ] {
                        if ui
                            .selectable_value(&mut self.settings.theme, theme, label)
                            .changed()
                        {
                            apply_theme(ctx, theme);
                        }
                    }
                });
            });
        self.show_settings = open;
    }

    fn editor(&mut self, ui: &mut egui::Ui) {
        let response = ui.add_sized(
            ui.available_size(),
            egui::TextEdit::multiline(self.document.text_mut())
                .code_editor()
                .desired_width(f32::INFINITY)
                .lock_focus(true),
        );
        if response.changed() {
            self.document.mark_changed();
        }
    }

    fn preview(&mut self, ui: &mut egui::Ui) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            CommonMarkViewer::new().show(
                ui,
                &mut self.markdown_cache,
                self.document.preview_text(),
            );
        });
    }
}

impl eframe::App for LiteMarkApp {
    fn save(&mut self, storage: &mut dyn eframe::Storage) {
        if let Ok(value) = serde_json::to_string(&self.settings) {
            storage.set_string(eframe::APP_KEY, value);
        }
    }

    fn logic(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.shortcuts(ctx);
        if self.document.refresh_preview_if_due() {
            ctx.request_repaint();
        } else if self.document.is_dirty() {
            ctx.request_repaint_after(Duration::from_millis(40));
        }
        ctx.send_viewport_cmd(egui::ViewportCommand::Title(self.document.title()));
    }

    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();
        self.toolbar(ui);
        self.recent_panel(ui);
        self.settings_window(&ctx);

        egui::CentralPanel::default().show(ui, |ui| {
            if self.preview_only {
                self.preview(ui);
            } else if self.editor_only {
                self.editor(ui);
            } else {
                let width = ui.available_width();
                let editor_width = width * self.settings.editor_width;
                ui.columns(2, |columns| {
                    columns[0].set_width(editor_width);
                    self.editor(&mut columns[0]);
                    self.preview(&mut columns[1]);
                });
            }
        });
    }
}

fn apply_theme(ctx: &egui::Context, theme: Theme) {
    match theme {
        Theme::Light => ctx.set_visuals(egui::Visuals::light()),
        Theme::Dark => ctx.set_visuals(egui::Visuals::dark()),
        Theme::System => ctx.set_theme(egui::ThemePreference::System),
    }
}
