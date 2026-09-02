use std::path::PathBuf;
use tauri::{
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, LogicalSize, Manager, RunEvent, Runtime, WindowEvent,
};

pub mod commands;
pub mod config;
pub mod history;
pub mod launcher;
pub mod models;
pub mod tray;
pub mod validation;
pub mod window_state;

#[cfg(test)]
mod commands_tests;
#[cfg(test)]
mod config_tests;
#[cfg(test)]
mod launcher_tests;
#[cfg(test)]
mod tray_tests;

pub(crate) fn build_tray_menu<R: Runtime, M: Manager<R>>(
    manager: &M,
    config: &models::Config,
    history: &[models::LaunchRecord],
) -> tauri::Result<Menu<R>> {
    let show_item = MenuItem::with_id(manager, tray::SHOW_MENU_ID, "显示窗口", true, None::<&str>)?;
    let new_task_item = MenuItem::with_id(
        manager,
        tray::NEW_TASK_MENU_ID,
        "新建任务",
        true,
        None::<&str>,
    )?;
    let settings_item =
        MenuItem::with_id(manager, tray::SETTINGS_MENU_ID, "设置", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(manager, tray::QUIT_MENU_ID, "退出", true, None::<&str>)?;

    let recent = tray::recent_tasks(config, history);
    let mut quick_items = Vec::new();
    for (task_id, task_name) in recent {
        quick_items.push(MenuItem::with_id(
            manager,
            tray::run_task_menu_id(&task_id),
            task_name,
            true,
            None::<&str>,
        )?);
    }
    if quick_items.is_empty() {
        quick_items.push(MenuItem::with_id(
            manager,
            tray::QUICK_RUN_EMPTY_MENU_ID,
            "暂无最近任务",
            false,
            None::<&str>,
        )?);
    }
    let quick_refs: Vec<&dyn IsMenuItem<R>> = quick_items
        .iter()
        .map(|item| item as &dyn IsMenuItem<R>)
        .collect();
    let quick_submenu = Submenu::with_id_and_items(
        manager,
        tray::QUICK_RUN_SUBMENU_ID,
        "快速运行",
        true,
        &quick_refs,
    )?;
    let separator = PredefinedMenuItem::separator(manager)?;
    let items: Vec<&dyn IsMenuItem<R>> = vec![
        &show_item,
        &quick_submenu,
        &new_task_item,
        &settings_item,
        &separator,
        &quit_item,
    ];
    Menu::with_items(manager, &items)
}

pub fn run() {
    let config_path = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("ScriptLauncher")
        .join("config.json");

    tauri::Builder::default()
        .manage(commands::AppState::new(config_path))
        .setup(|app| {
            let state = app.state::<commands::AppState>();
            if let Ok(config) = config::load_config_from_path(&state.config_path) {
                if let Ok(Some(size)) = window_state::size_for_mode(
                    &state.window_state_path,
                    &config.settings.window_mode,
                ) {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.set_size(LogicalSize::new(size.width, size.height));
                    }
                }
            }
            if let Some(icon) = app.default_window_icon().cloned() {
                let config = config::load_config_from_path(&state.config_path).unwrap_or_default();
                let history =
                    history::load_history_from_path(&state.history_path).unwrap_or_default();
                let tray_menu = build_tray_menu(app, &config, &history)?;
                let app_handle = app.handle().clone();
                tauri::tray::TrayIconBuilder::with_id(tray::TRAY_ID)
                    .icon(icon)
                    .tooltip("启动快捷运行 · RunTelos")
                    .menu(&tray_menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| {
                        match tray::action_for_menu_id(event.id().as_ref()) {
                            Some(tray::TrayAction::Show) => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            Some(tray::TrayAction::NewTask) => {
                                let _ = app.emit("tray://new-task", ());
                            }
                            Some(tray::TrayAction::Settings) => {
                                let _ = app.emit("tray://settings", ());
                            }
                            Some(tray::TrayAction::RunTask(task_id)) => {
                                let _ = app.emit("tray://run-task", task_id);
                            }
                            Some(tray::TrayAction::Quit) => app.exit(0),
                            None => {}
                        }
                    })
                    .on_tray_icon_event(move |_tray, event| {
                        if matches!(event, tauri::tray::TrayIconEvent::DoubleClick { .. }) {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<commands::AppState>();
                if let (Ok(config), Ok(scale_factor), Ok(size)) = (
                    config::load_config_from_path(&state.config_path),
                    window.scale_factor(),
                    window.inner_size(),
                ) {
                    let logical_size = size.to_logical::<u32>(scale_factor);
                    let _ = window_state::remember_size(
                        &state.window_state_path,
                        &config.settings.window_mode,
                        window_state::WindowSize {
                            width: logical_size.width,
                            height: logical_size.height,
                        },
                    );
                }
                let close_to_tray = config::load_config_from_path(&state.config_path)
                    .map(|c| c.settings.close_to_tray)
                    .unwrap_or(false);
                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::load_config,
            commands::save_config,
            commands::create_task,
            commands::update_task_item,
            commands::delete_task_item,
            commands::toggle_task_favorite,
            commands::reorder_task_items,
            commands::move_task,
            commands::create_group_item,
            commands::update_group_item,
            commands::delete_group_item,
            commands::reorder_group_items,
            commands::run_task,
            commands::reveal_task_in_explorer,
            commands::get_diagnostics,
            commands::add_script,
            commands::add_manual_script,
            commands::delete_script,
            commands::reveal_script_in_explorer,
            commands::reorder_scripts,
            commands::update_settings,
            commands::export_config,
            commands::import_config,
            commands::get_launch_history,
            commands::refresh_tray_menu,
            commands::open_config_folder,
            commands::restore_config_backup,
            commands::run_script,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, RunEvent::ExitRequested { .. }) {
                let state = app.state::<commands::AppState>();
                if let (Some(window), Ok(config)) = (
                    app.get_webview_window("main"),
                    config::load_config_from_path(&state.config_path),
                ) {
                    if let (Ok(scale_factor), Ok(size)) =
                        (window.scale_factor(), window.inner_size())
                    {
                        let logical_size = size.to_logical::<u32>(scale_factor);
                        let _ = window_state::remember_size(
                            &state.window_state_path,
                            &config.settings.window_mode,
                            window_state::WindowSize {
                                width: logical_size.width,
                                height: logical_size.height,
                            },
                        );
                    }
                }
            }
        });
}
