use std::fs;
use std::path::PathBuf;

use crate::config::{
    add_group, add_task, delete_group, delete_task, load_config_from_path, move_task,
    normalize_config, reorder_groups, reorder_tasks, rotate_backups, save_config_to_path,
    update_group, update_task,
};
use crate::models::{Config, ScriptType, TaskGroup, TaskItem};

fn sample_task(index: usize) -> TaskItem {
    TaskItem {
        id: format!("task-{index}"),
        name: format!("Task {index}"),
        script_type: ScriptType::Bat,
        group_id: None,
        favorite: false,
        path: Some(format!("C:\\Scripts\\task-{index}.bat")),
        command: None,
        url: None,
        args: String::new(),
        working_directory: None,
        run_as_admin: false,
        keep_window_open: true,
        order: index,
        aliases: vec![],
    }
}

#[test]
fn default_config_is_v2_and_empty() {
    let config = Config::default();

    assert_eq!(config.version, 2);
    assert!(config.tasks.is_empty());
    assert!(config.groups.is_empty());
    assert_eq!(config.settings.global_hotkey, "Alt+Space");
    assert_eq!(config.settings.window_mode, "compact");
}

#[test]
fn normalize_replaces_unknown_theme_with_system_default() {
    let mut config = Config::default();
    config.settings.theme = "sepia".to_string();

    let normalized = normalize_config(config);

    assert_eq!(normalized.settings.theme, "system");
}

#[test]
fn normalize_fixes_task_orders_and_orphan_group_ids() {
    let mut config = Config::default();
    let mut task = sample_task(1);
    task.group_id = Some("non-existent-group".to_string());
    config.tasks.push(task);

    let normalized = normalize_config(config);
    assert_eq!(normalized.tasks[0].order, 0);
    assert_eq!(normalized.tasks[0].group_id, None);
}

#[test]
fn migration_from_v1_to_v2_works_and_creates_backup() {
    let temp_path = temp_config_path("v1-migration");
    let v1_json = r#"{
        "version": 1,
        "settings": {
            "alwaysOnTop": true,
            "theme": "dark",
            "closeToTray": true,
            "keepWindowOpen": true,
            "pythonSilent": false
        },
        "pages": [
            {
                "items": [
                    {
                        "id": "item-1",
                        "name": "Script 1",
                        "type": "bat",
                        "path": "C:\\Scripts\\test1.bat",
                        "args": "--flag",
                        "runMode": "window"
                    }
                ]
            }
        ]
    }"#;

    fs::write(&temp_path, v1_json).expect("v1 config fixture should write");

    let loaded = load_config_from_path(&temp_path).expect("v1 config should migrate");

    assert_eq!(loaded.version, 2);
    assert_eq!(loaded.settings.theme, "dark");
    assert!(loaded.settings.always_on_top);
    assert_eq!(loaded.tasks.len(), 1);
    assert_eq!(loaded.tasks[0].name, "Script 1");
    assert_eq!(loaded.tasks[0].script_type, ScriptType::Bat);
    assert_eq!(loaded.tasks[0].args, "--flag");

    let backup_path = temp_path.with_extension("v1.backup.json");
    assert!(backup_path.exists(), "v1 backup file should be created");

    let _ = fs::remove_file(&temp_path);
    let _ = fs::remove_file(&backup_path);
}

#[test]
fn load_rejects_duplicate_item_ids() {
    let temp_path = temp_config_path("duplicate-ids");
    let duplicate = sample_task(1);
    let config = Config {
        version: 2,
        tasks: vec![duplicate.clone(), duplicate],
        ..Config::default()
    };
    fs::write(
        &temp_path,
        serde_json::to_string_pretty(&config).expect("config should serialize"),
    )
    .expect("fixture should write");

    assert_eq!(
        load_config_from_path(&temp_path).expect_err("duplicates should fail"),
        "配置中存在重复的启动项 ID"
    );

    let _ = fs::remove_file(temp_path);
}

#[test]
fn load_rejects_unknown_future_versions_without_rewriting_the_file() {
    let temp_path = temp_config_path("future-version");
    let original = r#"{"version":3,"futureField":{"must":"survive"}}"#;
    fs::write(&temp_path, original).expect("fixture should write");

    let error = load_config_from_path(&temp_path).expect_err("future version must be rejected");
    assert!(error.contains("配置版本 3"));
    assert_eq!(fs::read_to_string(&temp_path).unwrap(), original);

    let _ = fs::remove_file(temp_path);
}

#[test]
fn invalid_v1_migration_does_not_rewrite_the_original() {
    let temp_path = temp_config_path("invalid-v1-migration");
    let original = r#"{
        "version": 1,
        "pages": [{"items": [
            {"id":"duplicate","name":"One","type":"bat","path":"C:\\\\one.bat","args":"","runMode":null},
            {"id":"duplicate","name":"Two","type":"bat","path":"C:\\\\two.bat","args":"","runMode":null}
        ]}]
    }"#;
    fs::write(&temp_path, original).expect("fixture should write");

    assert!(load_config_from_path(&temp_path).is_err());
    assert_eq!(fs::read_to_string(&temp_path).unwrap(), original);
    assert!(!temp_path.with_extension("v1.backup.json").exists());

    let _ = fs::remove_file(temp_path);
}

#[test]
fn load_rejects_items_whose_payload_does_not_match_their_type() {
    let temp_path = temp_config_path("bad-payload");
    let mut item = sample_task(1);
    item.script_type = ScriptType::Url;
    item.path = None;
    item.url = Some("file:///C:/Windows/System32/calc.exe".to_string());
    let config = Config {
        version: 2,
        tasks: vec![item],
        ..Config::default()
    };
    fs::write(
        &temp_path,
        serde_json::to_string_pretty(&config).expect("config should serialize"),
    )
    .expect("fixture should write");

    assert_eq!(
        load_config_from_path(&temp_path).expect_err("bad payload should fail"),
        "URL 必须以 http:// 或 https:// 开头"
    );

    let _ = fs::remove_file(temp_path);
}

#[test]
fn load_rejects_items_with_overlong_names() {
    let temp_path = temp_config_path("long-name");
    let mut item = sample_task(1);
    item.name = "a".repeat(257);
    let config = Config {
        version: 2,
        tasks: vec![item],
        ..Config::default()
    };
    fs::write(
        &temp_path,
        serde_json::to_string_pretty(&config).expect("config should serialize"),
    )
    .expect("fixture should write");

    assert_eq!(
        load_config_from_path(&temp_path).expect_err("long names should fail"),
        "显示名称长度不能超过 256 个字符"
    );

    let _ = fs::remove_file(temp_path);
}

#[test]
fn load_accepts_utf8_bom_prefixed_configs() {
    let temp_path = temp_config_path("bom-prefixed");
    let config = add_task(Config::default(), sample_task(1));
    let json = serde_json::to_string_pretty(&config).expect("config should serialize");
    fs::write(&temp_path, format!("\u{feff}{json}")).expect("fixture should write");

    let loaded = load_config_from_path(&temp_path).expect("bom-prefixed config should load");

    assert_eq!(loaded, config);

    let _ = fs::remove_file(temp_path);
}

#[test]
fn task_crud_operations() {
    let mut config = Config::default();
    config = add_task(config, sample_task(1));
    assert_eq!(config.tasks.len(), 1);

    let mut updated = sample_task(1);
    updated.name = "Updated Task".to_string();
    config = update_task(config, updated).expect("task should update");
    assert_eq!(config.tasks[0].name, "Updated Task");

    config = delete_task(config, "task-1");
    assert!(config.tasks.is_empty());
}

#[test]
fn group_crud_and_delete_migration() {
    let mut config = Config::default();
    let group = TaskGroup {
        id: "dev".to_string(),
        name: "Development".to_string(),
        order: 0,
        icon: Some("code".to_string()),
    };
    config = add_group(config, group);
    assert_eq!(config.groups.len(), 1);

    let mut task = sample_task(1);
    task.group_id = Some("dev".to_string());
    config = add_task(config, task);
    assert_eq!(config.tasks[0].group_id, Some("dev".to_string()));

    let mut updated_group = config.groups[0].clone();
    updated_group.name = "Dev Tools".to_string();
    config = update_group(config, updated_group).expect("group should update");
    assert_eq!(config.groups[0].name, "Dev Tools");

    // Deleting group safely migrates task's group_id to None
    config = delete_group(config, "dev");
    assert!(config.groups.is_empty());
    assert_eq!(config.tasks[0].group_id, None);
}

#[test]
fn reorder_tasks_and_groups() {
    let mut config = Config::default();
    config = add_task(config, sample_task(1));
    config = add_task(config, sample_task(2));

    config = reorder_tasks(config, &["task-2".to_string(), "task-1".to_string()])
        .expect("tasks should reorder");
    assert_eq!(config.tasks[0].id, "task-2");
    assert_eq!(config.tasks[1].id, "task-1");

    config = add_group(
        config,
        TaskGroup {
            id: "g1".to_string(),
            name: "G1".to_string(),
            order: 0,
            icon: None,
        },
    );
    config = add_group(
        config,
        TaskGroup {
            id: "g2".to_string(),
            name: "G2".to_string(),
            order: 1,
            icon: None,
        },
    );

    config = reorder_groups(config, &["g2".to_string(), "g1".to_string()])
        .expect("groups should reorder");
    assert_eq!(config.groups[0].id, "g2");
    assert_eq!(config.groups[1].id, "g1");
}

#[test]
fn moving_task_changes_group_and_local_order() {
    let mut config = Config::default();
    config = add_group(
        config,
        TaskGroup {
            id: "dev".to_string(),
            name: "Dev".to_string(),
            order: 0,
            icon: None,
        },
    );
    config = add_group(
        config,
        TaskGroup {
            id: "sys".to_string(),
            name: "System".to_string(),
            order: 1,
            icon: None,
        },
    );
    let mut first = sample_task(1);
    first.group_id = Some("dev".to_string());
    let mut second = sample_task(2);
    second.group_id = Some("sys".to_string());
    let mut third = sample_task(3);
    third.group_id = Some("sys".to_string());
    config.tasks = vec![first, second, third];

    config = move_task(config, "task-1", Some("sys".to_string()), 1)
        .expect("task should move into the target group");
    assert_eq!(
        config
            .tasks
            .iter()
            .map(|task| task.id.as_str())
            .collect::<Vec<_>>(),
        vec!["task-2", "task-1", "task-3"]
    );
    assert_eq!(config.tasks[1].group_id.as_deref(), Some("sys"));
    assert_eq!(config.tasks[1].order, 1);
}

#[test]
fn save_and_load_config_round_trip() {
    let temp_path = temp_config_path("round-trip");
    let config = add_task(Config::default(), sample_task(1));

    save_config_to_path(&temp_path, &config).expect("config should save");
    let loaded = load_config_from_path(&temp_path).expect("config should load");

    assert_eq!(loaded, config);

    let _ = fs::remove_file(temp_path);
}

#[test]
fn backup_rotation_works() {
    let dir = std::env::temp_dir().join(format!("scriptlauncher-backup-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&dir).expect("test directory should be created");
    let path = dir.join("config.json");

    for count in 0..=3 {
        let mut config = Config::default();
        config.settings.global_hotkey = format!("Alt+{count}");
        save_config_to_path(&path, &config).expect("config should save");
        rotate_backups(&path).expect("backup rotation should succeed");
    }

    for (slot, expected) in [(1, "Alt+3"), (2, "Alt+2"), (3, "Alt+1")] {
        let backup = dir.join(format!("config.backup.{slot}.json"));
        let config = load_config_from_path(&backup).expect("backup should be readable");
        assert_eq!(config.settings.global_hotkey, expected);
    }

    let _ = fs::remove_dir_all(dir);
}

fn temp_config_path(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "scriptlauncher-{label}-{}.json",
        uuid::Uuid::new_v4()
    ))
}
