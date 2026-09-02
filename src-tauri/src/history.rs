use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::LaunchRecord;

pub const MAX_HISTORY_RECORDS: usize = 200;

pub fn load_history_from_path(path: &Path) -> Result<Vec<LaunchRecord>, String> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(error) => return Err(error.to_string()),
    };

    serde_json::from_str(&content).map_err(|error| format!("解析启动历史失败: {error}"))
}

pub fn append_launch_record(path: &Path, record: LaunchRecord) -> Result<(), String> {
    let mut records = load_history_from_path(path)?;
    records.push(record);
    if records.len() > MAX_HISTORY_RECORDS {
        let remove_count = records.len() - MAX_HISTORY_RECORDS;
        records.drain(0..remove_count);
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let content = serde_json::to_string_pretty(&records).map_err(|error| error.to_string())?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, content).map_err(|error| error.to_string())?;
    fs::rename(&tmp_path, path).map_err(|error| error.to_string())
}

pub fn unix_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::{append_launch_record, load_history_from_path, MAX_HISTORY_RECORDS};
    use crate::models::LaunchRecord;
    use std::fs;

    fn record(index: usize) -> LaunchRecord {
        LaunchRecord {
            id: format!("record-{index}"),
            task_id: "task-1".to_string(),
            task_name: "Sample".to_string(),
            started_at: index.to_string(),
            status: "launched".to_string(),
            error: None,
        }
    }

    #[test]
    fn history_is_empty_when_file_does_not_exist() {
        let path = std::env::temp_dir().join(format!(
            "scriptlauncher-history-{}.json",
            uuid::Uuid::new_v4()
        ));
        assert!(load_history_from_path(&path)
            .expect("missing history should be empty")
            .is_empty());
    }

    #[test]
    fn history_is_truncated_to_the_newest_records() {
        let dir =
            std::env::temp_dir().join(format!("scriptlauncher-history-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("test directory should be created");
        let path = dir.join("history.json");
        for index in 0..(MAX_HISTORY_RECORDS + 3) {
            append_launch_record(&path, record(index)).expect("history record should save");
        }

        let records = load_history_from_path(&path).expect("history should load");
        assert_eq!(records.len(), MAX_HISTORY_RECORDS);
        assert_eq!(
            records.first().map(|item| item.started_at.as_str()),
            Some("3")
        );
        assert_eq!(
            records.last().map(|item| item.started_at.as_str()),
            Some("202")
        );
        let _ = fs::remove_dir_all(dir);
    }
}
