use std::collections::HashSet;

use crate::launcher::detect_script_type;
use crate::models::{Config, ScriptType, TaskGroup, TaskItem};

pub const MAX_NAME_LEN: usize = 256;
pub const MAX_PATH_LEN: usize = 32_767;
pub const MAX_COMMAND_LEN: usize = 8_191;
pub const MAX_URL_LEN: usize = 2_083;
pub const MAX_ARGS_LEN: usize = 32_767;
pub const MAX_ALIASES_COUNT: usize = 20;
pub const MAX_ALIAS_LEN: usize = 64;
pub const MAX_HOTKEY_LEN: usize = 128;

pub fn validate_config(config: &Config) -> Result<(), String> {
    if config.version != 2 {
        return Err("暂不支持该配置版本".to_string());
    }
    validate_length(&config.settings.global_hotkey, "全局快捷键", MAX_HOTKEY_LEN)?;
    if config.settings.global_hotkey.trim().is_empty() {
        return Err("全局快捷键不能为空".to_string());
    }

    let mut group_ids = HashSet::new();
    for group in &config.groups {
        validate_group(group)?;
        if !group_ids.insert(group.id.as_str()) {
            return Err("配置中存在重复的分组 ID".to_string());
        }
    }

    let mut ids = HashSet::new();
    for item in &config.tasks {
        if item.id.trim().is_empty() {
            return Err("启动项 ID 不能为空".to_string());
        }
        if !ids.insert(item.id.as_str()) {
            return Err("配置中存在重复的启动项 ID".to_string());
        }

        if let Some(ref gid) = item.group_id {
            if !gid.trim().is_empty() && !group_ids.contains(gid.as_str()) {
                // Group ID not found - allowed in lenient mode or will be cleaned up,
                // but let's not block completely or we can warn.
            }
        }

        validate_task(item)?;
    }

    Ok(())
}

pub fn validate_group(group: &TaskGroup) -> Result<(), String> {
    if group.id.trim().is_empty() {
        return Err("分组 ID 不能为空".to_string());
    }
    validate_name(&group.name)?;
    Ok(())
}

pub fn validate_task(item: &TaskItem) -> Result<(), String> {
    validate_name(&item.name)?;
    if let Some(path) = &item.path {
        validate_length(path, "文件路径", MAX_PATH_LEN)?;
    }
    if let Some(command) = &item.command {
        validate_length(command, "WSL 命令", MAX_COMMAND_LEN)?;
    }
    if let Some(url) = &item.url {
        validate_length(url, "URL", MAX_URL_LEN)?;
    }
    if let Some(cwd) = &item.working_directory {
        validate_length(cwd, "工作目录", MAX_PATH_LEN)?;
    }
    validate_length(&item.args, "启动参数", MAX_ARGS_LEN)?;

    if item.aliases.len() > MAX_ALIASES_COUNT {
        return Err(format!("别名数量不能超过 {MAX_ALIASES_COUNT} 个"));
    }
    for alias in &item.aliases {
        validate_length(alias, "别名", MAX_ALIAS_LEN)?;
    }

    validate_script_payload(
        &item.script_type,
        item.path.as_deref(),
        item.command.as_deref(),
        item.url.as_deref(),
    )
}

pub fn validate_name(name: &str) -> Result<(), String> {
    validate_length(name, "显示名称", MAX_NAME_LEN)?;
    if name.trim().is_empty() {
        Err("显示名称不能为空".to_string())
    } else {
        Ok(())
    }
}

pub fn validate_script_payload(
    script_type: &ScriptType,
    path: Option<&str>,
    command: Option<&str>,
    url: Option<&str>,
) -> Result<(), String> {
    match script_type {
        ScriptType::Bat | ScriptType::Ps1 | ScriptType::Py | ScriptType::Exe => {
            let path = path
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| "文件路径不能为空".to_string())?;
            let detected =
                detect_script_type(path).ok_or_else(|| "暂不支持该文件类型".to_string())?;
            if &detected != script_type {
                return Err("文件扩展名与启动类型不匹配".to_string());
            }
            Ok(())
        }
        ScriptType::Wsl => {
            let command = command
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| "WSL 命令不能为空".to_string())?;
            validate_wsl_command(command)
        }
        ScriptType::Url => {
            let url = url
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| "URL 不能为空".to_string())?;
            validate_url(url)
        }
    }
}

pub fn validate_url(value: &str) -> Result<(), String> {
    if value.starts_with("http://") || value.starts_with("https://") {
        Ok(())
    } else {
        Err("URL 必须以 http:// 或 https:// 开头".to_string())
    }
}

pub fn validate_wsl_command(command: &str) -> Result<(), String> {
    if command.trim().is_empty() {
        Err("WSL 命令不能为空".to_string())
    } else {
        Ok(())
    }
}

pub fn validate_length(value: &str, field_name: &str, max: usize) -> Result<(), String> {
    if value.chars().count() > max {
        Err(format!("{field_name}长度不能超过 {max} 个字符"))
    } else {
        Ok(())
    }
}
