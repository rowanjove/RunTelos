use std::collections::HashSet;

use crate::models::{Config, LaunchRecord};

pub const TRAY_ID: &str = "main-tray";
pub const SHOW_MENU_ID: &str = "show";
pub const NEW_TASK_MENU_ID: &str = "new-task";
pub const SETTINGS_MENU_ID: &str = "settings";
pub const QUICK_RUN_SUBMENU_ID: &str = "quick-run";
pub const QUICK_RUN_EMPTY_MENU_ID: &str = "quick-run-empty";
pub const QUIT_MENU_ID: &str = "quit";
pub const RUN_TASK_PREFIX: &str = "run-task:";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrayAction {
    Show,
    NewTask,
    Settings,
    RunTask(String),
    Quit,
}

pub fn action_for_menu_id(id: &str) -> Option<TrayAction> {
    match id {
        SHOW_MENU_ID => Some(TrayAction::Show),
        NEW_TASK_MENU_ID => Some(TrayAction::NewTask),
        SETTINGS_MENU_ID => Some(TrayAction::Settings),
        QUIT_MENU_ID => Some(TrayAction::Quit),
        value if value.starts_with(RUN_TASK_PREFIX) => {
            let task_id = value.trim_start_matches(RUN_TASK_PREFIX);
            (!task_id.is_empty()).then(|| TrayAction::RunTask(task_id.to_string()))
        }
        _ => None,
    }
}

pub fn run_task_menu_id(task_id: &str) -> String {
    format!("{RUN_TASK_PREFIX}{task_id}")
}

pub fn recent_tasks(config: &Config, records: &[LaunchRecord]) -> Vec<(String, String)> {
    let mut seen = HashSet::new();
    records
        .iter()
        .rev()
        .filter_map(|record| {
            if !seen.insert(record.task_id.clone()) {
                return None;
            }
            config
                .tasks
                .iter()
                .find(|task| task.id == record.task_id)
                .map(|task| (task.id.clone(), task.name.clone()))
        })
        .take(5)
        .collect()
}
