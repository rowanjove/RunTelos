use crate::launcher::{
    build_launch_command, build_launch_command_with_settings, build_launch_plan_with_settings,
    detect_script_type, resolve_working_dir, LaunchPlan,
};
use crate::models::{Config, ScriptType, TaskItem};

fn sample_task(script_type: ScriptType, path: &str) -> TaskItem {
    TaskItem {
        id: "task-1".to_string(),
        name: "Sample".to_string(),
        script_type,
        group_id: None,
        favorite: false,
        path: Some(path.to_string()),
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

#[test]
fn detect_script_type_supports_cmd_as_bat() {
    assert_eq!(detect_script_type("cleanup.cmd"), Some(ScriptType::Bat));
}

#[test]
fn detect_script_type_rejects_unsupported_files() {
    assert_eq!(detect_script_type("notes.txt"), None);
}

#[test]
fn bat_launch_uses_cmd_k_and_resolves_working_dir() {
    let task = sample_task(ScriptType::Bat, "C:\\Scripts\\cleanup.bat");
    let command = build_launch_command(&task).expect("launch command should build");

    assert_eq!(command.program, "cmd");
    assert_eq!(command.args, vec!["/k", "C:\\Scripts\\cleanup.bat"]);
    assert_eq!(command.working_dir, Some("C:\\Scripts".to_string()));
    assert!(!command.elevation);
}

#[test]
fn custom_working_dir_overrides_parent_folder() {
    let mut task = sample_task(ScriptType::Bat, "C:\\Scripts\\cleanup.bat");
    task.working_directory = Some("D:\\CustomCwd".to_string());

    let cwd = resolve_working_dir(&task);
    assert_eq!(cwd, Some("D:\\CustomCwd".to_string()));
}

#[test]
fn exe_launches_directly_with_elevation_flag() {
    let mut task = sample_task(ScriptType::Exe, "C:\\Tools\\tool.exe");
    task.run_as_admin = true;

    let command = build_launch_command(&task).expect("launch command should build");

    assert_eq!(command.program, "C:\\Tools\\tool.exe");
    assert!(command.args.is_empty());
    assert!(command.elevation);
}

#[test]
fn wsl_launch_uses_bash_c() {
    let mut task = sample_task(ScriptType::Wsl, "");
    task.path = None;
    task.command = Some("echo hello".to_string());

    let command = build_launch_command(&task).expect("launch command should build");

    assert_eq!(command.program, "wsl");
    assert_eq!(command.args, vec!["-e", "bash", "-c", "echo hello"]);
}

#[test]
fn wsl_launch_prefers_windows_terminal_with_wsl_fallback() {
    let mut task = sample_task(ScriptType::Wsl, "");
    task.path = None;
    task.command = Some("echo hello".to_string());

    let plan = build_launch_plan_with_settings(&task, &Config::default().settings, false)
        .expect("launch plan should build");

    assert_eq!(
        plan,
        LaunchPlan::CommandCandidates(vec![
            crate::launcher::LaunchCommand {
                program: "wt.exe".to_string(),
                args: vec![
                    "new-tab".to_string(),
                    "wsl".to_string(),
                    "-e".to_string(),
                    "bash".to_string(),
                    "-c".to_string(),
                    "echo hello".to_string(),
                ],
                working_dir: None,
                elevation: false,
            },
            crate::launcher::LaunchCommand {
                program: "wsl".to_string(),
                args: vec![
                    "-e".to_string(),
                    "bash".to_string(),
                    "-c".to_string(),
                    "echo hello".to_string(),
                ],
                working_dir: None,
                elevation: false,
            },
        ])
    );
}

#[test]
fn url_launch_uses_native_opener_plan() {
    let mut task = sample_task(ScriptType::Url, "");
    task.path = None;
    task.url = Some("https://example.com".to_string());

    let plan = build_launch_plan_with_settings(&task, &Config::default().settings, false)
        .expect("launch plan should build");

    assert_eq!(plan, LaunchPlan::OpenUrl("https://example.com".to_string()));
}

#[test]
fn python_silent_mode_uses_pythonw() {
    let mut settings = Config::default().settings;
    settings.python_silent = true;

    let command = build_launch_command_with_settings(
        &sample_task(ScriptType::Py, "C:\\Scripts\\job.py"),
        &settings,
        false,
    )
    .expect("launch command should build");

    assert_eq!(command.program, "pythonw");
}

#[test]
fn keep_window_open_uses_cmd_k_for_bat() {
    let settings = Config::default().settings;

    let command = build_launch_command_with_settings(
        &sample_task(ScriptType::Bat, "C:\\Scripts\\job.bat"),
        &settings,
        false,
    )
    .expect("launch command should build");

    assert_eq!(command.args[0], "/k");
}

#[test]
fn quoted_runtime_args_are_split_and_appended_to_python_launches() {
    let mut task = sample_task(ScriptType::Py, "C:\\Scripts\\job.py");
    task.args = "--name \"hello world\" --count 2".to_string();

    let command = build_launch_command(&task).expect("launch command should build");

    assert_eq!(
        command.args,
        vec![
            "C:\\Scripts\\job.py",
            "--name",
            "hello world",
            "--count",
            "2"
        ]
    );
}

#[test]
fn unterminated_runtime_args_are_rejected() {
    let mut task = sample_task(ScriptType::Exe, "C:\\Tools\\tool.exe");
    task.args = "\"unterminated".to_string();

    let error = build_launch_command(&task).expect_err("args should be invalid");

    assert_eq!(error, "启动参数中的引号未闭合");
}

#[test]
fn quoted_windows_path_argument_preserves_backslashes() {
    let mut task = sample_task(ScriptType::Exe, "C:\\Tools\\tool.exe");
    task.args = "--output \"C:\\Program Files\\RunTelos\\data.txt\"".to_string();

    let command = build_launch_command(&task).expect("launch command should build");
    assert_eq!(
        command.args,
        vec!["--output", "C:\\Program Files\\RunTelos\\data.txt"]
    );
}
