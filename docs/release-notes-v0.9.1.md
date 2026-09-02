# RunTelos 0.9.1

RunTelos 是一个免安装的 Windows 本地任务启动器，可集中管理 BAT、CMD、PowerShell、Python、EXE、WSL 命令和 URL。

## 本次修复

- 修复管理员启动在 UAC 取消或 `Start-Process` 失败时仍报告成功的问题。
- 修复带空格、引号和反斜杠的 Windows 参数在普通与管理员启动路径中的解析。
- 配置写入改为串行提交；快捷键不再逐字符保存。
- 未知未来配置版本只读拒绝，v1 迁移会先验证并成功备份再写入。
- 自动备份错误不再静默，恢复界面可以选择最近三份备份。
- 为主要对话框补充焦点约束、Escape、焦点恢复和 ARIA 语义。
- 补齐全局快捷键的 Tauri 最小权限，修复 Release 构建中的快捷键注册失败。
- 修复标题栏图标在打包后使用错误资源路径的问题。
- 新增可复现的便携版命名、PE 子系统、产品版本和 SHA-256 校验。

## 下载

下载 `RunTelos-0.9.1-portable.exe` 和 `SHA256SUMS.txt`。本版本面向 Windows 10/11 x64，便携版未进行代码签名。

## Verification

- 48 frontend tests and 48 Rust tests passed.
- TypeScript/Vite production build, rustfmt, and Clippy with `-D warnings` passed.
- npm audit reported zero vulnerabilities.
- RustSec audit passed with the two documented `quick-xml` exceptions described in `docs/security-advisories.md`.
- The uploaded executable is checked as a Windows GUI PE with product name `RunTelos` and version `0.9.1`.
