# Rust 依赖安全例外

## quick-xml 0.39.4

临时忽略：`RUSTSEC-2026-0194`、`RUSTSEC-2026-0195`。

当前依赖链为 `Tauri -> tauri-utils -> plist -> quick-xml`。截至 2026-09-02，`plist 1.9.0` 尚未发布兼容 `quick-xml >= 0.41.0` 的版本；Tauri 上游仍将该问题标记为 upstream blocked。

本项目的 Windows 运行路径不读取用户提供或网络提供的 XML/plist；配置、历史和窗口状态均为 JSON。因此公告描述的恶意 XML DoS 路径在当前产品边界内不可达。`npm run audit:rust` 只忽略这两个有明确原因的公告，其他漏洞仍会使检查失败。

`anyhow` 已由 1.0.102 升级到修复 `RUSTSEC-2026-0190` 的 1.0.103。扫描器列出的 GTK3/glib/unic 警告来自非 Windows 目标的 Tauri 依赖；`cargo tree --target x86_64-pc-windows-msvc` 确认 Windows 依赖图不包含 `glib 0.18.5`。这些属于跨平台锁文件的信息性提示，不作为 Windows 产物的漏洞豁免。

移除条件：上游 `plist`/Tauri 发布采用 `quick-xml >= 0.41.0` 的版本后，升级锁文件并删除两个 `--ignore` 参数。

参考：

- https://rustsec.org/advisories/RUSTSEC-2026-0194
- https://rustsec.org/advisories/RUSTSEC-2026-0195
- https://github.com/tauri-apps/wry/issues/1759
