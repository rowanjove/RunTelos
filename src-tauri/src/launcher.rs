use std::path::Path;

use crate::models::{ScriptType, Settings, TaskItem};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LaunchCommand {
    pub program: String,
    pub args: Vec<String>,
    pub working_dir: Option<String>,
    pub elevation: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LaunchPlan {
    Command(LaunchCommand),
    CommandCandidates(Vec<LaunchCommand>),
    OpenUrl(String),
}

pub fn detect_script_type(path: &str) -> Option<ScriptType> {
    let extension = Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase());

    match extension.as_deref() {
        Some("bat" | "cmd") => Some(ScriptType::Bat),
        Some("ps1") => Some(ScriptType::Ps1),
        Some("py") => Some(ScriptType::Py),
        Some("exe") => Some(ScriptType::Exe),
        _ => None,
    }
}

pub fn resolve_working_dir(item: &TaskItem) -> Option<String> {
    if let Some(ref cwd) = item.working_directory {
        let trimmed = cwd.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    if let Some(ref path) = item.path {
        let path_obj = Path::new(path);
        if let Some(parent) = path_obj.parent() {
            let parent_str = parent.to_string_lossy().trim().to_string();
            if !parent_str.is_empty() {
                return Some(parent_str);
            }
        }
    }

    None
}

#[cfg(test)]
pub fn build_launch_command(item: &TaskItem) -> Result<LaunchCommand, String> {
    build_launch_command_with_settings(item, &crate::models::Config::default().settings, false)
}

pub fn build_launch_plan_with_settings(
    item: &TaskItem,
    settings: &Settings,
    force_admin: bool,
) -> Result<LaunchPlan, String> {
    match item.script_type {
        ScriptType::Url => {
            let url = item
                .url
                .as_ref()
                .ok_or_else(|| "URL 启动项缺少地址".to_string())?;
            Ok(LaunchPlan::OpenUrl(url.clone()))
        }
        ScriptType::Wsl => {
            let fallback = build_launch_command_with_settings(item, settings, force_admin)?;
            Ok(LaunchPlan::CommandCandidates(vec![
                LaunchCommand {
                    program: "wt.exe".to_string(),
                    args: {
                        let mut args = vec!["new-tab".to_string(), "wsl".to_string()];
                        args.extend(fallback.args.clone());
                        args
                    },
                    working_dir: fallback.working_dir.clone(),
                    elevation: fallback.elevation,
                },
                fallback,
            ]))
        }
        _ => {
            build_launch_command_with_settings(item, settings, force_admin).map(LaunchPlan::Command)
        }
    }
}

pub fn build_launch_command_with_settings(
    item: &TaskItem,
    settings: &Settings,
    force_admin: bool,
) -> Result<LaunchCommand, String> {
    let working_dir = resolve_working_dir(item);
    let elevation = force_admin || item.run_as_admin;
    let keep_open = item.keep_window_open && settings.keep_window_open;

    match item.script_type {
        ScriptType::Bat => {
            let path = item
                .path
                .as_ref()
                .ok_or_else(|| "启动项缺少路径".to_string())?;
            let mut args = vec![
                if keep_open { "/k" } else { "/c" }.to_string(),
                path.clone(),
            ];
            args.extend(parse_runtime_args(&item.args)?);
            Ok(LaunchCommand {
                program: "cmd".to_string(),
                args,
                working_dir,
                elevation,
            })
        }
        ScriptType::Ps1 => {
            let path = item
                .path
                .as_ref()
                .ok_or_else(|| "启动项缺少路径".to_string())?;
            let mut args = vec![];
            if keep_open {
                args.push("-NoExit".to_string());
            }
            args.extend([
                "-ExecutionPolicy".to_string(),
                "Bypass".to_string(),
                "-File".to_string(),
                path.clone(),
            ]);
            args.extend(parse_runtime_args(&item.args)?);
            Ok(LaunchCommand {
                program: "powershell".to_string(),
                args,
                working_dir,
                elevation,
            })
        }
        ScriptType::Py => {
            let path = item
                .path
                .as_ref()
                .ok_or_else(|| "启动项缺少路径".to_string())?;
            let mut args = vec![path.clone()];
            args.extend(parse_runtime_args(&item.args)?);
            Ok(LaunchCommand {
                program: if settings.python_silent {
                    "pythonw".to_string()
                } else {
                    "python".to_string()
                },
                args,
                working_dir,
                elevation,
            })
        }
        ScriptType::Exe => {
            let path = item
                .path
                .as_ref()
                .ok_or_else(|| "启动项缺少路径".to_string())?;
            Ok(LaunchCommand {
                program: path.clone(),
                args: parse_runtime_args(&item.args)?,
                working_dir,
                elevation,
            })
        }
        ScriptType::Wsl => {
            let command = item
                .command
                .as_ref()
                .ok_or_else(|| "WSL 启动项缺少命令".to_string())?;
            Ok(LaunchCommand {
                program: "wsl".to_string(),
                args: vec![
                    "-e".to_string(),
                    "bash".to_string(),
                    "-c".to_string(),
                    command.clone(),
                ],
                working_dir,
                elevation,
            })
        }
        ScriptType::Url => Err("URL 启动项应通过系统默认浏览器打开".to_string()),
    }
}

pub fn parse_runtime_args(input: &str) -> Result<Vec<String>, String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut escaped = false;

    for character in input.chars() {
        if escaped {
            if character != '"' && character != '\\' {
                current.push('\\');
            }
            current.push(character);
            escaped = false;
            continue;
        }

        match character {
            '\\' if in_quotes => escaped = true,
            '"' => in_quotes = !in_quotes,
            c if c.is_whitespace() && !in_quotes => {
                if !current.is_empty() {
                    args.push(std::mem::take(&mut current));
                }
            }
            c => current.push(c),
        }
    }

    if escaped {
        current.push('\\');
    }

    if in_quotes {
        return Err("启动参数中的引号未闭合".to_string());
    }

    if !current.is_empty() {
        args.push(current);
    }

    Ok(args)
}
