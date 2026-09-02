use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ScriptType {
    #[serde(alias = "cmd")]
    Bat,
    #[serde(alias = "powershell")]
    Ps1,
    #[serde(alias = "python")]
    Py,
    Exe,
    Wsl,
    Url,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TaskGroup {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub order: usize,
    #[serde(default)]
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TaskItem {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub script_type: ScriptType,
    #[serde(default)]
    pub group_id: Option<String>,
    #[serde(default)]
    pub favorite: bool,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub args: String,
    #[serde(default)]
    pub working_directory: Option<String>,
    #[serde(default)]
    pub run_as_admin: bool,
    #[serde(default = "default_true")]
    pub keep_window_open: bool,
    #[serde(default)]
    pub order: usize,
    #[serde(default)]
    pub aliases: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub always_on_top: bool,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default)]
    pub close_to_tray: bool,
    #[serde(default = "default_true")]
    pub keep_window_open: bool,
    #[serde(default)]
    pub python_silent: bool,
    #[serde(default = "default_true")]
    pub hide_after_run: bool,
    #[serde(default = "default_global_hotkey")]
    pub global_hotkey: String,
    #[serde(default = "default_window_mode")]
    pub window_mode: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            always_on_top: false,
            theme: default_theme(),
            close_to_tray: false,
            keep_window_open: true,
            python_silent: false,
            hide_after_run: true,
            global_hotkey: default_global_hotkey(),
            window_mode: default_window_mode(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Config {
    pub version: u8,
    pub settings: Settings,
    #[serde(default)]
    pub groups: Vec<TaskGroup>,
    #[serde(default)]
    pub tasks: Vec<TaskItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchRecord {
    pub id: String,
    pub task_id: String,
    pub task_name: String,
    pub started_at: String,
    pub status: String,
    #[serde(default)]
    pub error: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: 2,
            settings: Settings::default(),
            groups: vec![],
            tasks: vec![],
        }
    }
}

// Structures for v1 backward compatibility and migration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ScriptItemV1 {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub script_type: ScriptType,
    pub path: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    pub args: String,
    #[serde(rename = "runMode")]
    pub run_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PageV1 {
    pub items: Vec<ScriptItemV1>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawConfig {
    pub version: Option<u8>,
    pub settings: Option<Settings>,
    pub groups: Option<Vec<TaskGroup>>,
    pub tasks: Option<Vec<TaskItem>>,
    pub pages: Option<Vec<PageV1>>,
}

pub fn default_true() -> bool {
    true
}

fn default_theme() -> String {
    "system".to_string()
}

fn default_global_hotkey() -> String {
    "Alt+Space".to_string()
}

fn default_window_mode() -> String {
    "compact".to_string()
}
