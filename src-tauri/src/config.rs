use std::collections::HashMap;
use std::fs;
use std::path::Path;

use crate::models::{Config, RawConfig, TaskGroup, TaskItem};
use crate::validation::validate_config;

pub fn normalize_config(mut config: Config) -> Config {
    if !matches!(config.settings.theme.as_str(), "system" | "dark" | "light") {
        config.settings.theme = "system".to_string();
    }

    if !matches!(config.settings.window_mode.as_str(), "compact" | "expanded") {
        config.settings.window_mode = "compact".to_string();
    }

    if config.settings.global_hotkey.trim().is_empty() {
        config.settings.global_hotkey = "Alt+Space".to_string();
    }

    // Normalize group orders
    for (index, group) in config.groups.iter_mut().enumerate() {
        group.order = index;
    }

    let existing_group_ids: std::collections::HashSet<_> =
        config.groups.iter().map(|g| g.id.as_str()).collect();

    // Normalize task orders and clean orphan group_id
    for (index, task) in config.tasks.iter_mut().enumerate() {
        task.order = index;
        if let Some(ref gid) = task.group_id {
            if !existing_group_ids.contains(gid.as_str()) {
                task.group_id = None;
            }
        }
    }

    config.version = 2;
    config
}

pub fn add_task(mut config: Config, mut item: TaskItem) -> Config {
    item.order = config.tasks.len();
    config.tasks.push(item);
    normalize_config(config)
}

pub fn delete_task(mut config: Config, id: &str) -> Config {
    config.tasks.retain(|item| item.id != id);
    normalize_config(config)
}

pub fn update_task(mut config: Config, replacement: TaskItem) -> Option<Config> {
    let mut updated = false;
    for item in &mut config.tasks {
        if item.id == replacement.id {
            *item = replacement.clone();
            updated = true;
            break;
        }
    }
    updated.then(|| normalize_config(config))
}

pub fn reorder_tasks(mut config: Config, ordered_ids: &[String]) -> Result<Config, String> {
    if config.tasks.len() != ordered_ids.len() {
        return Err("排序项数量不匹配".to_string());
    }

    let mut remaining: HashMap<String, TaskItem> = config
        .tasks
        .drain(..)
        .map(|item| (item.id.clone(), item))
        .collect();

    let mut ordered = Vec::with_capacity(ordered_ids.len());
    for (index, id) in ordered_ids.iter().enumerate() {
        let mut item = remaining
            .remove(id)
            .ok_or_else(|| "排序项不存在".to_string())?;
        item.order = index;
        ordered.push(item);
    }

    config.tasks = ordered;
    Ok(normalize_config(config))
}

pub fn move_task(
    mut config: Config,
    task_id: &str,
    target_group_id: Option<String>,
    target_order: usize,
) -> Result<Config, String> {
    if let Some(group_id) = target_group_id.as_deref() {
        if !config.groups.iter().any(|group| group.id == group_id) {
            return Err("分组不存在".to_string());
        }
    }

    let source_index = config
        .tasks
        .iter()
        .position(|task| task.id == task_id)
        .ok_or_else(|| "启动项不存在".to_string())?;
    let mut task = config.tasks.remove(source_index);
    task.group_id = target_group_id;

    let mut same_group_index = 0;
    let mut insertion_index = config.tasks.len();
    for (index, existing) in config.tasks.iter().enumerate() {
        if existing.group_id == task.group_id {
            if same_group_index >= target_order {
                insertion_index = index;
                break;
            }
            same_group_index += 1;
        }
    }

    config.tasks.insert(insertion_index, task);
    Ok(normalize_config(config))
}

pub fn add_group(mut config: Config, mut group: TaskGroup) -> Config {
    group.order = config.groups.len();
    config.groups.push(group);
    normalize_config(config)
}

pub fn update_group(mut config: Config, replacement: TaskGroup) -> Option<Config> {
    let mut updated = false;
    for group in &mut config.groups {
        if group.id == replacement.id {
            *group = replacement.clone();
            updated = true;
            break;
        }
    }
    updated.then(|| normalize_config(config))
}

pub fn delete_group(mut config: Config, group_id: &str) -> Config {
    config.groups.retain(|g| g.id != group_id);
    for task in &mut config.tasks {
        if task.group_id.as_deref() == Some(group_id) {
            task.group_id = None;
        }
    }
    normalize_config(config)
}

pub fn reorder_groups(mut config: Config, ordered_ids: &[String]) -> Result<Config, String> {
    if config.groups.len() != ordered_ids.len() {
        return Err("分组排序项数量不匹配".to_string());
    }

    let mut remaining: HashMap<String, TaskGroup> = config
        .groups
        .drain(..)
        .map(|group| (group.id.clone(), group))
        .collect();

    let mut ordered = Vec::with_capacity(ordered_ids.len());
    for (index, id) in ordered_ids.iter().enumerate() {
        let mut group = remaining
            .remove(id)
            .ok_or_else(|| "分组不存在".to_string())?;
        group.order = index;
        ordered.push(group);
    }

    config.groups = ordered;
    Ok(normalize_config(config))
}

pub fn migrate_raw_config(
    raw: RawConfig,
    original_content: &str,
    path: &Path,
) -> Result<Config, String> {
    let version = raw.version.unwrap_or(1);
    if !matches!(version, 1 | 2) {
        return Err(format!("暂不支持配置版本 {version}；当前仅支持版本 1 和 2"));
    }
    let settings = raw.settings.unwrap_or_default();

    if version == 1 || raw.pages.is_some() {
        let mut tasks = Vec::new();
        if let Some(pages) = raw.pages {
            let mut order = 0;
            for page in pages {
                for item in page.items {
                    tasks.push(TaskItem {
                        id: item.id,
                        name: item.name,
                        script_type: item.script_type,
                        group_id: None,
                        favorite: false,
                        path: item.path,
                        command: item.command,
                        url: item.url,
                        args: item.args,
                        working_directory: None,
                        run_as_admin: false,
                        keep_window_open: true,
                        order,
                        aliases: vec![],
                    });
                    order += 1;
                }
            }
        } else if let Some(raw_tasks) = raw.tasks {
            tasks = raw_tasks;
        }

        let config = Config {
            version: 2,
            settings,
            groups: raw.groups.unwrap_or_default(),
            tasks,
        };

        let normalized = normalize_config(config);
        validate_config(&normalized)?;
        if path.exists() {
            let backup_path = path.with_extension("v1.backup.json");
            fs::write(&backup_path, original_content)
                .map_err(|error| format!("创建 v1 配置备份失败: {error}"))?;
        }
        save_config_to_path(path, &normalized)
            .map_err(|error| format!("保存迁移后的配置失败: {error}"))?;
        Ok(normalized)
    } else {
        let config = Config {
            version: 2,
            settings,
            groups: raw.groups.unwrap_or_default(),
            tasks: raw.tasks.unwrap_or_default(),
        };
        Ok(normalize_config(config))
    }
}

pub fn load_config_from_path(path: &Path) -> Result<Config, String> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(Config::default());
        }
        Err(error) => return Err(error.to_string()),
    };
    let content_trimmed = content.trim_start_matches('\u{feff}');
    let raw = serde_json::from_str::<RawConfig>(content_trimmed)
        .map_err(|error| format!("解析配置失败: {error}"))?;

    let config = migrate_raw_config(raw, content_trimmed, path)?;
    validate_config(&config)?;
    Ok(config)
}

pub fn rotate_backups(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        let backup3 = parent.join("config.backup.3.json");
        let backup2 = parent.join("config.backup.2.json");
        let backup1 = parent.join("config.backup.1.json");

        if backup2.exists() {
            fs::copy(&backup2, &backup3)
                .map_err(|error| format!("轮转第三份配置备份失败: {error}"))?;
        }
        if backup1.exists() {
            fs::copy(&backup1, &backup2)
                .map_err(|error| format!("轮转第二份配置备份失败: {error}"))?;
        }
        if path.exists() {
            fs::copy(path, &backup1).map_err(|error| format!("创建最新配置备份失败: {error}"))?;
        }
    }
    Ok(())
}

pub fn save_config_to_path(path: &Path, config: &Config) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let content = serde_json::to_string_pretty(config).map_err(|error| error.to_string())?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, content).map_err(|error| error.to_string())?;
    fs::rename(&tmp_path, path).map_err(|error| error.to_string())
}
