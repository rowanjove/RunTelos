use crate::commands::{
    launch_item, normalized_name, persist_app_config, revealable_path, sanitize_diagnostic_path,
    AppState,
};
use crate::config::save_config_to_path;
use crate::models::{Config, ScriptType, TaskItem};
use crate::validation::validate_wsl_command;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn file_items_have_revealable_paths() {
    let item = sample_task(ScriptType::Bat);

    assert_eq!(
        revealable_path(&item).expect("path should exist"),
        "C:\\Scripts\\job.bat"
    );
}

#[test]
fn manual_items_cannot_be_revealed() {
    let mut item = sample_task(ScriptType::Url);
    item.path = None;
    item.url = Some("https://example.com".to_string());

    assert_eq!(
        revealable_path(&item).expect_err("manual items should not reveal"),
        "该启动项没有可定位的文件"
    );
}

#[test]
fn names_are_trimmed_and_empty_names_are_rejected() {
    assert_eq!(
        normalized_name("  Job  ").expect("name should normalize"),
        "Job"
    );
    assert_eq!(
        normalized_name("   ").expect_err("blank names should fail"),
        "显示名称不能为空"
    );
}

#[test]
fn imported_url_items_are_revalidated_before_launch() {
    let mut item = sample_task(ScriptType::Url);
    item.path = None;
    item.url = Some("file:///C:/Windows/System32/calc.exe".to_string());

    assert_eq!(
        launch_item(&item, &Config::default().settings, false)
            .expect_err("invalid url should fail"),
        "URL 必须以 http:// 或 https:// 开头"
    );
}

#[test]
fn wsl_commands_may_use_normal_shell_operators() {
    assert_eq!(validate_wsl_command("cd ~/work && npm run dev"), Ok(()));
}

#[test]
fn base64_encoding_works_correctly() {
    use crate::commands::encode_base64;
    assert_eq!(encode_base64(b""), "");
    assert_eq!(encode_base64(b"f"), "Zg==");
    assert_eq!(encode_base64(b"fo"), "Zm8=");
    assert_eq!(encode_base64(b"foo"), "Zm9v");
    assert_eq!(encode_base64(b"Hello, world!"), "SGVsbG8sIHdvcmxkIQ==");
}

#[test]
fn elevated_powershell_args_use_encoded_command() {
    use crate::commands::{build_elevated_powershell_args, build_elevated_powershell_script};
    use crate::launcher::LaunchCommand;

    let launch_cmd = LaunchCommand {
        program: "cmd.exe".to_string(),
        args: vec!["/k".to_string(), "C:\\test path\\run.bat".to_string()],
        working_dir: Some("C:\\test path".to_string()),
        elevation: true,
    };

    let args = build_elevated_powershell_args(&launch_cmd);
    assert!(args.contains(&"-EncodedCommand".to_string()));
    assert_eq!(args[4], "-EncodedCommand");
    assert!(!args[5].is_empty());

    let script = build_elevated_powershell_script(&launch_cmd);
    assert!(script.contains("-PassThru"));
    assert!(script.contains("-ErrorActionPreference") || script.contains("ErrorActionPreference"));
    assert!(script.contains("\"C:\\test path\\run.bat\""));
    assert!(script.contains("exit 1"));
}

#[test]
fn windows_arguments_preserve_spaces_and_empty_values() {
    use crate::commands::quote_windows_argument;

    assert_eq!(quote_windows_argument("plain"), "plain");
    assert_eq!(
        quote_windows_argument("C:\\Program Files\\RunTelos\\data.txt"),
        "\"C:\\Program Files\\RunTelos\\data.txt\""
    );
    assert_eq!(quote_windows_argument(""), "\"\"");
}

#[test]
fn user_mutations_rotate_the_previous_config_before_saving() {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock should be after epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("scriptlauncher-command-{suffix}"));
    fs::create_dir_all(&dir).expect("test directory should be created");
    let path = dir.join("config.json");
    let initial = Config::default();
    save_config_to_path(&path, &initial).expect("initial config should save");

    let state = AppState::new(path.clone());
    let mut next = initial.clone();
    next.settings.theme = "dark".to_string();
    persist_app_config(&state, &next).expect("mutated config should save");

    let backup = dir.join("config.backup.1.json");
    assert!(backup.exists(), "mutation should create a recovery backup");
    let backed_up: Config =
        serde_json::from_str(&fs::read_to_string(backup).expect("backup should be readable"))
            .expect("backup should contain valid config");
    assert_eq!(backed_up, initial);
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn diagnostic_paths_do_not_expose_the_user_profile() {
    let path = std::path::Path::new(r"C:\Users\Alice\AppData\Roaming\ScriptLauncher\config.json");
    let safe_path = sanitize_diagnostic_path(path);

    assert_eq!(safe_path, r"%APPDATA%\ScriptLauncher\config.json");
    assert!(!safe_path.contains("Alice"));
}

fn sample_task(script_type: ScriptType) -> TaskItem {
    TaskItem {
        id: "task-1".to_string(),
        name: "Sample".to_string(),
        script_type,
        group_id: None,
        favorite: false,
        path: Some("C:\\Scripts\\job.bat".to_string()),
        command: None,
        url: None,
        args: String::new(),
        working_directory: None,
        run_as_admin: false,
        keep_window_open: true,
        order: 0,
        aliases: vec![],
    }
}
