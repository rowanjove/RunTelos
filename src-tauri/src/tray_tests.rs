use crate::models::{Config, LaunchRecord, ScriptType, Settings, TaskItem};
use crate::tray::{
    action_for_menu_id, recent_tasks, run_task_menu_id, TrayAction, NEW_TASK_MENU_ID, QUIT_MENU_ID,
    SETTINGS_MENU_ID, SHOW_MENU_ID,
};

#[test]
fn tray_menu_ids_map_to_expected_actions() {
    assert_eq!(action_for_menu_id(SHOW_MENU_ID), Some(TrayAction::Show));
    assert_eq!(
        action_for_menu_id(NEW_TASK_MENU_ID),
        Some(TrayAction::NewTask)
    );
    assert_eq!(
        action_for_menu_id(SETTINGS_MENU_ID),
        Some(TrayAction::Settings)
    );
    assert_eq!(action_for_menu_id(QUIT_MENU_ID), Some(TrayAction::Quit));
}

#[test]
fn unknown_tray_menu_ids_are_ignored() {
    assert_eq!(action_for_menu_id("unknown"), None);
}

#[test]
fn run_task_menu_ids_round_trip() {
    let id = run_task_menu_id("task-1");
    assert_eq!(
        action_for_menu_id(&id),
        Some(TrayAction::RunTask("task-1".into()))
    );
}

#[test]
fn recent_tasks_are_unique_and_limited_to_five() {
    let config = Config {
        version: 2,
        settings: Settings::default(),
        groups: vec![],
        tasks: (0..6)
            .map(|index| TaskItem {
                id: format!("task-{index}"),
                name: format!("Task {index}"),
                script_type: ScriptType::Url,
                group_id: None,
                favorite: false,
                path: None,
                command: None,
                url: Some("https://example.com".into()),
                args: String::new(),
                working_directory: None,
                run_as_admin: false,
                keep_window_open: true,
                order: index,
                aliases: vec![],
            })
            .collect(),
    };
    let records = (0..6)
        .flat_map(|index| {
            [
                LaunchRecord {
                    id: format!("record-{index}"),
                    task_id: format!("task-{index}"),
                    task_name: format!("Task {index}"),
                    started_at: index.to_string(),
                    status: "launched".into(),
                    error: None,
                },
                LaunchRecord {
                    id: format!("record-{index}-duplicate"),
                    task_id: format!("task-{index}"),
                    task_name: format!("Task {index}"),
                    started_at: format!("{index}-duplicate"),
                    status: "failed".into(),
                    error: Some("failed".into()),
                },
            ]
        })
        .collect::<Vec<_>>();

    let recent = recent_tasks(&config, &records);
    assert_eq!(recent.len(), 5);
    assert_eq!(recent.first().map(|item| item.0.as_str()), Some("task-5"));
}
