use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::config::{
    add_group, add_task, delete_group, delete_task, load_config_from_path,
    move_task as move_task_config, normalize_config, reorder_groups, reorder_tasks, rotate_backups,
    save_config_to_path, update_group, update_task,
};
use crate::history::{append_launch_record, load_history_from_path, unix_timestamp};
use crate::launcher::{
    build_launch_plan_with_settings, detect_script_type, LaunchCommand, LaunchPlan,
};
use crate::models::{Config, LaunchRecord, ScriptType, Settings, TaskGroup, TaskItem};
use crate::validation::{
    validate_config, validate_group, validate_length, validate_name, validate_task, validate_url,
    validate_wsl_command, MAX_COMMAND_LEN, MAX_PATH_LEN, MAX_URL_LEN,
};

pub struct AppState {
    pub config_path: PathBuf,
    pub history_path: PathBuf,
    pub window_state_path: PathBuf,
    pub write_lock: Mutex<()>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskRequest {
    pub name: String,
    pub script_type: String,
    pub group_id: Option<String>,
    pub favorite: Option<bool>,
    pub path: Option<String>,
    pub command: Option<String>,
    pub url: Option<String>,
    pub args: Option<String>,
    pub working_directory: Option<String>,
    pub run_as_admin: Option<bool>,
    pub keep_window_open: Option<bool>,
    pub aliases: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskRequest {
    pub id: String,
    pub name: String,
    pub script_type: String,
    pub group_id: Option<String>,
    pub favorite: Option<bool>,
    pub path: Option<String>,
    pub command: Option<String>,
    pub url: Option<String>,
    pub args: String,
    pub working_directory: Option<String>,
    pub run_as_admin: Option<bool>,
    pub keep_window_open: Option<bool>,
    pub aliases: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsInfo {
    pub app_version: String,
    pub config_path: String,
    pub config_version: u8,
    pub task_count: usize,
    pub group_count: usize,
    pub os_name: String,
}

/// Return a stable, privacy-safe path for diagnostics and support bundles.
///
/// The actual config path lives under the user's profile and must not be
/// copied into bug reports. Keep the well-known AppData location while
/// omitting the account name and any machine-specific parent directories.
pub(crate) fn sanitize_diagnostic_path(path: &Path) -> String {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("config.json");
    format!("%APPDATA%\\ScriptLauncher\\{file_name}")
}

impl AppState {
    pub fn new(config_path: PathBuf) -> Self {
        let history_path = config_path.with_file_name("history.json");
        let window_state_path = config_path.with_file_name("window-state.json");
        Self {
            config_path,
            history_path,
            window_state_path,
            write_lock: Mutex::new(()),
        }
    }
}

pub(crate) fn persist_app_config(state: &AppState, config: &Config) -> Result<(), String> {
    // Keep the recovery promise consistent for every user-visible mutation,
    // not only for the explicit save_config command.
    rotate_backups(&state.config_path)?;
    save_config_to_path(&state.config_path, config)
}

#[tauri::command]
pub fn load_config(state: State<'_, AppState>) -> Result<Config, String> {
    load_config_from_path(&state.config_path)
}

#[tauri::command]
pub fn save_config(config: Config, state: State<'_, AppState>) -> Result<Config, String> {
    validate_config(&config)?;
    let normalized = normalize_config(config);
    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    rotate_backups(&state.config_path)?;
    save_config_to_path(&state.config_path, &normalized)?;
    Ok(normalized)
}

#[tauri::command]
pub fn create_task(
    request: CreateTaskRequest,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    validate_name(&request.name)?;
    let script_type = parse_script_type(&request.script_type)?;

    let task = TaskItem {
        id: Uuid::new_v4().to_string(),
        name: normalized_name(&request.name)?,
        script_type,
        group_id: request.group_id.filter(|g| !g.trim().is_empty()),
        favorite: request.favorite.unwrap_or(false),
        path: request.path.filter(|p| !p.trim().is_empty()),
        command: request.command.filter(|c| !c.trim().is_empty()),
        url: request.url.filter(|u| !u.trim().is_empty()),
        args: request.args.unwrap_or_default(),
        working_directory: request.working_directory.filter(|w| !w.trim().is_empty()),
        run_as_admin: request.run_as_admin.unwrap_or(false),
        keep_window_open: request.keep_window_open.unwrap_or(true),
        order: 0,
        aliases: request.aliases.unwrap_or_default(),
    };

    validate_task(&task)?;

    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let config = add_task(load_config_from_path(&state.config_path)?, task);
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn update_task_item(
    request: UpdateTaskRequest,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    validate_name(&request.name)?;
    let script_type = parse_script_type(&request.script_type)?;

    let replacement = TaskItem {
        id: request.id,
        name: normalized_name(&request.name)?,
        script_type,
        group_id: request.group_id.filter(|g| !g.trim().is_empty()),
        favorite: request.favorite.unwrap_or(false),
        path: request.path.filter(|p| !p.trim().is_empty()),
        command: request.command.filter(|c| !c.trim().is_empty()),
        url: request.url.filter(|u| !u.trim().is_empty()),
        args: request.args,
        working_directory: request.working_directory.filter(|w| !w.trim().is_empty()),
        run_as_admin: request.run_as_admin.unwrap_or(false),
        keep_window_open: request.keep_window_open.unwrap_or(true),
        order: 0,
        aliases: request.aliases.unwrap_or_default(),
    };

    validate_task(&replacement)?;

    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let config = load_config_from_path(&state.config_path)?;
    let config = update_task(config, replacement).ok_or_else(|| "启动项不存在".to_string())?;
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn delete_task_item(id: String, state: State<'_, AppState>) -> Result<Config, String> {
    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let config = delete_task(load_config_from_path(&state.config_path)?, &id);
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn toggle_task_favorite(id: String, state: State<'_, AppState>) -> Result<Config, String> {
    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let mut config = load_config_from_path(&state.config_path)?;
    let mut found = false;
    for task in &mut config.tasks {
        if task.id == id {
            task.favorite = !task.favorite;
            found = true;
            break;
        }
    }
    if !found {
        return Err("启动项不存在".to_string());
    }
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn reorder_task_items(
    ordered_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let config = reorder_tasks(load_config_from_path(&state.config_path)?, &ordered_ids)?;
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn move_task(
    id: String,
    group_id: Option<String>,
    order: usize,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let config = move_task_config(
        load_config_from_path(&state.config_path)?,
        &id,
        group_id,
        order,
    )?;
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn create_group_item(
    name: String,
    icon: Option<String>,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    validate_name(&name)?;
    let group = TaskGroup {
        id: Uuid::new_v4().to_string(),
        name: normalized_name(&name)?,
        order: 0,
        icon,
    };
    validate_group(&group)?;

    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let config = add_group(load_config_from_path(&state.config_path)?, group);
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn update_group_item(
    id: String,
    name: String,
    icon: Option<String>,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    validate_name(&name)?;
    let group = TaskGroup {
        id,
        name: normalized_name(&name)?,
        order: 0,
        icon,
    };
    validate_group(&group)?;

    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let config = load_config_from_path(&state.config_path)?;
    let config = update_group(config, group).ok_or_else(|| "分组不存在".to_string())?;
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn delete_group_item(id: String, state: State<'_, AppState>) -> Result<Config, String> {
    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let config = delete_group(load_config_from_path(&state.config_path)?, &id);
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn reorder_group_items(
    ordered_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let config = reorder_groups(load_config_from_path(&state.config_path)?, &ordered_ids)?;
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn update_settings(settings: Settings, state: State<'_, AppState>) -> Result<Config, String> {
    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let mut config = load_config_from_path(&state.config_path)?;
    config.settings = settings;
    let normalized = normalize_config(config);
    validate_config(&normalized)?;
    persist_app_config(&state, &normalized)?;
    Ok(normalized)
}

#[tauri::command]
pub fn export_config(path: String, state: State<'_, AppState>) -> Result<(), String> {
    validate_length(&path, "导出路径", MAX_PATH_LEN)?;
    let config = load_config_from_path(&state.config_path)?;
    save_config_to_path(Path::new(&path), &config)
}

#[tauri::command]
pub fn import_config(path: String, state: State<'_, AppState>) -> Result<Config, String> {
    validate_length(&path, "导入路径", MAX_PATH_LEN)?;
    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let config = load_config_from_path(Path::new(&path))?;
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn get_launch_history(
    task_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<LaunchRecord>, String> {
    let mut records = load_history_from_path(&state.history_path)?;
    if let Some(task_id) = task_id {
        records.retain(|record| record.task_id == task_id);
    }
    records.reverse();
    Ok(records)
}

#[tauri::command]
pub fn refresh_tray_menu(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let config = load_config_from_path(&state.config_path)?;
    let history = load_history_from_path(&state.history_path)?;
    let menu = crate::build_tray_menu(&app, &config, &history)
        .map_err(|error| format!("刷新托盘菜单失败：{error}"))?;
    let tray = app
        .tray_by_id(crate::tray::TRAY_ID)
        .ok_or_else(|| "托盘图标尚未初始化".to_string())?;
    tray.set_menu(Some(menu))
        .map_err(|error| format!("更新托盘菜单失败：{error}"))
}

#[tauri::command]
pub fn open_config_folder(state: State<'_, AppState>) -> Result<(), String> {
    let folder = state
        .config_path
        .parent()
        .ok_or_else(|| "配置目录不存在".to_string())?;
    Command::new("explorer")
        .arg(folder)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn restore_config_backup(slot: u8, state: State<'_, AppState>) -> Result<Config, String> {
    if !(1..=3).contains(&slot) {
        return Err("备份编号必须是 1 到 3".to_string());
    }
    let folder = state
        .config_path
        .parent()
        .ok_or_else(|| "配置目录不存在".to_string())?;
    let backup_path = folder.join(format!("config.backup.{slot}.json"));
    if !backup_path.exists() {
        return Err(format!("自动备份不存在：{}", backup_path.display()));
    }
    let config = load_config_from_path(&backup_path)
        .map_err(|error| format!("无法读取自动备份：{error}"))?;
    validate_config(&config)?;

    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn run_task(
    id: String,
    force_admin: Option<bool>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let config = load_config_from_path(&state.config_path)?;
    let item = config
        .tasks
        .iter()
        .find(|item| item.id == id)
        .ok_or_else(|| "启动项不存在".to_string())?;
    let task_name = item.name.clone();
    let result = launch_item(item, &config.settings, force_admin.unwrap_or(false));
    let record = LaunchRecord {
        id: Uuid::new_v4().to_string(),
        task_id: id,
        task_name,
        started_at: unix_timestamp(),
        status: if result.is_ok() { "launched" } else { "failed" }.to_string(),
        error: result.as_ref().err().cloned(),
    };
    match state.write_lock.lock() {
        Ok(_lock) => {
            if let Err(error) = append_launch_record(&state.history_path, record) {
                eprintln!("写入启动历史失败: {error}");
            }
        }
        Err(error) => eprintln!("获取启动历史写锁失败: {error}"),
    }
    result
}

#[tauri::command]
pub fn run_script(id: String, state: State<'_, AppState>) -> Result<(), String> {
    run_task(id, None, state)
}

#[tauri::command]
pub fn reveal_task_in_explorer(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let config = load_config_from_path(&state.config_path)?;
    let item = config
        .tasks
        .iter()
        .find(|item| item.id == id)
        .ok_or_else(|| "启动项不存在".to_string())?;
    let path = revealable_path(item)?;

    Command::new("explorer")
        .args(["/select,", path])
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn reveal_script_in_explorer(id: String, state: State<'_, AppState>) -> Result<(), String> {
    reveal_task_in_explorer(id, state)
}

#[tauri::command]
pub fn get_diagnostics(state: State<'_, AppState>) -> Result<DiagnosticsInfo, String> {
    let config = load_config_from_path(&state.config_path).unwrap_or_default();
    Ok(DiagnosticsInfo {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        config_path: sanitize_diagnostic_path(&state.config_path),
        config_version: config.version,
        task_count: config.tasks.len(),
        group_count: config.groups.len(),
        os_name: std::env::consts::OS.to_string(),
    })
}

// Backward compatibility helper commands for v1 callers
#[tauri::command]
pub fn add_script(
    path: String,
    name: String,
    _current_page: usize,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    validate_name(&name)?;
    validate_length(&path, "文件路径", MAX_PATH_LEN)?;

    let script_type = detect_script_type(&path).ok_or_else(|| "暂不支持该文件类型".to_string())?;
    let item = TaskItem {
        id: Uuid::new_v4().to_string(),
        name: normalized_name(&name)?,
        script_type,
        group_id: None,
        favorite: false,
        path: Some(path),
        command: None,
        url: None,
        args: String::new(),
        working_directory: None,
        run_as_admin: false,
        keep_window_open: true,
        order: 0,
        aliases: vec![],
    };

    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let config = add_task(load_config_from_path(&state.config_path)?, item);
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn add_manual_script(
    name: String,
    script_type: String,
    value: String,
    _current_page: usize,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    validate_name(&name)?;

    let (script_type, command, url) = match script_type.as_str() {
        "wsl" => {
            let value = value.trim().to_string();
            if value.is_empty() {
                return Err("WSL 命令不能为空".to_string());
            }
            validate_length(&value, "WSL 命令", MAX_COMMAND_LEN)?;
            validate_wsl_command(&value)?;
            (ScriptType::Wsl, Some(value), None)
        }
        "url" => {
            let value = value.trim().to_string();
            validate_length(&value, "URL", MAX_URL_LEN)?;
            validate_url(&value)?;
            (ScriptType::Url, None, Some(value))
        }
        _ => return Err("暂不支持该手动类型".to_string()),
    };

    let item = TaskItem {
        id: Uuid::new_v4().to_string(),
        name: normalized_name(&name)?,
        script_type,
        group_id: None,
        favorite: false,
        path: None,
        command,
        url,
        args: String::new(),
        working_directory: None,
        run_as_admin: false,
        keep_window_open: true,
        order: 0,
        aliases: vec![],
    };

    let _lock = state.write_lock.lock().map_err(|e| e.to_string())?;
    let config = add_task(load_config_from_path(&state.config_path)?, item);
    persist_app_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn delete_script(id: String, state: State<'_, AppState>) -> Result<Config, String> {
    delete_task_item(id, state)
}

#[tauri::command]
pub fn reorder_scripts(
    ordered_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    reorder_task_items(ordered_ids, state)
}

pub fn launch_item(item: &TaskItem, settings: &Settings, force_admin: bool) -> Result<(), String> {
    validate_task(item)?;

    if matches!(
        item.script_type,
        ScriptType::Bat | ScriptType::Ps1 | ScriptType::Py | ScriptType::Exe
    ) {
        let path = item
            .path
            .as_deref()
            .ok_or_else(|| "启动项缺少路径".to_string())?;

        if !Path::new(path).exists() {
            return Err("目标文件不存在".to_string());
        }
    }

    match build_launch_plan_with_settings(item, settings, force_admin)? {
        LaunchPlan::Command(launch_command) => spawn_command(&launch_command),
        LaunchPlan::CommandCandidates(candidates) => {
            let mut last_error = None;
            for candidate in candidates {
                match spawn_command(&candidate) {
                    Ok(_) => return Ok(()),
                    Err(error) => {
                        last_error = Some(error);
                    }
                }
            }

            Err(last_error.unwrap_or_else(|| "没有可用的启动命令".to_string()))
        }
        LaunchPlan::OpenUrl(url) => open::that_detached(url).map_err(|error| error.to_string()),
    }
}

pub fn encode_base64(data: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        result.push(CHARSET[(b0 >> 2) as usize] as char);
        result.push(CHARSET[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);

        if chunk.len() > 1 {
            result.push(CHARSET[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            result.push('=');
        }

        if chunk.len() > 2 {
            result.push(CHARSET[(b2 & 0x3f) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

pub fn build_elevated_powershell_args(launch_command: &LaunchCommand) -> Vec<String> {
    let ps_cmd = build_elevated_powershell_script(launch_command);

    let utf16_bytes: Vec<u8> = ps_cmd
        .encode_utf16()
        .flat_map(|u| u.to_le_bytes())
        .collect();
    let encoded = encode_base64(&utf16_bytes);

    vec![
        "-NoProfile".to_string(),
        "-NonInteractive".to_string(),
        "-ExecutionPolicy".to_string(),
        "Bypass".to_string(),
        "-EncodedCommand".to_string(),
        encoded,
    ]
}

pub fn build_elevated_powershell_script(launch_command: &LaunchCommand) -> String {
    let program_escaped = launch_command.program.replace('\'', "''");
    let args_formatted = if launch_command.args.is_empty() {
        String::new()
    } else {
        let command_line = launch_command
            .args
            .iter()
            .map(|arg| quote_windows_argument(arg))
            .collect::<Vec<_>>()
            .join(" ")
            .replace('\'', "''");
        format!("-ArgumentList '{command_line}'")
    };

    let cwd_formatted = if let Some(ref cwd) = launch_command.working_dir {
        format!("-WorkingDirectory '{}'", cwd.replace('\'', "''"))
    } else {
        String::new()
    };

    format!(
        "$ErrorActionPreference = 'Stop'; try {{ Start-Process -FilePath '{program_escaped}' {args_formatted} -Verb RunAs {cwd_formatted} -PassThru | Out-Null; exit 0 }} catch {{ Write-Error $_; exit 1 }}"
    )
}

pub fn quote_windows_argument(argument: &str) -> String {
    if !argument.is_empty()
        && !argument
            .chars()
            .any(|character| character.is_whitespace() || character == '"')
    {
        return argument.to_string();
    }

    let mut quoted = String::from("\"");
    let mut backslashes = 0usize;
    for character in argument.chars() {
        match character {
            '\\' => backslashes += 1,
            '"' => {
                quoted.push_str(&"\\".repeat(backslashes * 2 + 1));
                quoted.push('"');
                backslashes = 0;
            }
            _ => {
                quoted.push_str(&"\\".repeat(backslashes));
                backslashes = 0;
                quoted.push(character);
            }
        }
    }
    quoted.push_str(&"\\".repeat(backslashes * 2));
    quoted.push('"');
    quoted
}

fn spawn_command(launch_command: &LaunchCommand) -> Result<(), String> {
    if launch_command.elevation {
        let ps_args = build_elevated_powershell_args(launch_command);
        let mut cmd = Command::new("powershell");
        cmd.args(ps_args);
        let status = cmd
            .status()
            .map_err(|error| format!("无法启动管理员授权流程: {error}"))?;
        if status.success() {
            Ok(())
        } else {
            Err(format!(
                "管理员启动未完成（用户可能取消了授权，退出码：{}）",
                status
                    .code()
                    .map_or_else(|| "未知".to_string(), |code| code.to_string())
            ))
        }
    } else {
        let mut cmd = Command::new(&launch_command.program);
        cmd.args(&launch_command.args);
        if let Some(ref cwd) = launch_command.working_dir {
            cmd.current_dir(cwd);
        }
        cmd.spawn().map(|_| ()).map_err(|e| e.to_string())
    }
}

pub fn revealable_path(item: &TaskItem) -> Result<&str, String> {
    match item.script_type {
        ScriptType::Bat | ScriptType::Ps1 | ScriptType::Py | ScriptType::Exe => item
            .path
            .as_deref()
            .ok_or_else(|| "该启动项没有可定位的文件".to_string()),
        ScriptType::Wsl | ScriptType::Url => Err("该启动项没有可定位的文件".to_string()),
    }
}

pub fn normalized_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        Err("显示名称不能为空".to_string())
    } else {
        Ok(name.to_string())
    }
}

fn parse_script_type(script_type: &str) -> Result<ScriptType, String> {
    match script_type {
        "bat" | "cmd" => Ok(ScriptType::Bat),
        "ps1" | "powershell" => Ok(ScriptType::Ps1),
        "py" | "python" => Ok(ScriptType::Py),
        "exe" => Ok(ScriptType::Exe),
        "wsl" => Ok(ScriptType::Wsl),
        "url" => Ok(ScriptType::Url),
        _ => Err("暂不支持该启动类型".to_string()),
    }
}
