use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

const MIN_WIDTH: u32 = 340;
const MIN_HEIGHT: u32 = 440;
const MAX_WIDTH: u32 = 4096;
const MAX_HEIGHT: u32 = 4096;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}

impl WindowSize {
    fn sanitized(self) -> Self {
        Self {
            width: self.width.clamp(MIN_WIDTH, MAX_WIDTH),
            height: self.height.clamp(MIN_HEIGHT, MAX_HEIGHT),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct WindowState {
    #[serde(default)]
    pub compact: Option<WindowSize>,
    #[serde(default)]
    pub expanded: Option<WindowSize>,
}

fn read_state(path: &Path) -> Result<WindowState, String> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(WindowState::default())
        }
        Err(error) => return Err(error.to_string()),
    };
    serde_json::from_str(&content).map_err(|error| format!("解析窗口尺寸失败: {error}"))
}

fn write_state(path: &Path, state: &WindowState) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let content = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, content).map_err(|error| error.to_string())?;
    fs::rename(&tmp_path, path).map_err(|error| error.to_string())
}

pub fn size_for_mode(path: &Path, mode: &str) -> Result<Option<WindowSize>, String> {
    let state = read_state(path)?;
    let size = match mode {
        "expanded" => state.expanded,
        "compact" => state.compact,
        _ => None,
    };
    Ok(size.map(WindowSize::sanitized))
}

pub fn remember_size(path: &Path, mode: &str, size: WindowSize) -> Result<(), String> {
    let mut state = read_state(path).unwrap_or_default();
    let size = Some(size.sanitized());
    match mode {
        "expanded" => state.expanded = size,
        "compact" => state.compact = size,
        _ => return Err(format!("未知窗口模式：{mode}")),
    }
    write_state(path, &state)
}

#[cfg(test)]
mod tests {
    use super::{remember_size, size_for_mode, WindowSize};
    use std::fs;

    fn test_path() -> (std::path::PathBuf, std::path::PathBuf) {
        let dir =
            std::env::temp_dir().join(format!("scriptlauncher-window-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("test directory should be created");
        let path = dir.join("window-state.json");
        (dir, path)
    }

    #[test]
    fn missing_state_has_no_saved_size() {
        let (dir, path) = test_path();
        assert_eq!(size_for_mode(&path, "compact").unwrap(), None);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn sizes_are_saved_per_window_mode_and_sanitized() {
        let (dir, path) = test_path();
        remember_size(
            &path,
            "compact",
            WindowSize {
                width: 1,
                height: 99999,
            },
        )
        .unwrap();
        remember_size(
            &path,
            "expanded",
            WindowSize {
                width: 800,
                height: 700,
            },
        )
        .unwrap();

        assert_eq!(
            size_for_mode(&path, "compact").unwrap(),
            Some(WindowSize {
                width: 340,
                height: 4096,
            })
        );
        assert_eq!(
            size_for_mode(&path, "expanded").unwrap(),
            Some(WindowSize {
                width: 800,
                height: 700,
            })
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn unknown_mode_is_rejected_when_remembering_size() {
        let (dir, path) = test_path();
        assert!(remember_size(
            &path,
            "other",
            WindowSize {
                width: 500,
                height: 500,
            }
        )
        .is_err());
        let _ = fs::remove_dir_all(dir);
    }
}
