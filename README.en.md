# RunTelos

[中文](./README.md) · [Latest release](https://github.com/rowanjove/RunTelos/releases/latest) · [Changelog](./CHANGELOG.md)

RunTelos is a local task launcher for Windows. It keeps scripts, programs, WSL commands, and frequently used URLs in one small window, making recurring build commands, maintenance scripts, and local tools easier to find and run.

There is no installer. Download the single executable and run it; your tasks and launch history remain on your computer.

![RunTelos main window in expanded mode](./docs/screenshots/runtelos-0.9.1-main.png)

> The screenshot was captured with an isolated profile and demonstration tasks. It contains no real user paths, commands, or history.

<details>
<summary>View the Settings window</summary>

![RunTelos Settings window](./docs/screenshots/runtelos-0.9.1-settings.png)

</details>

## Download

Current version: `0.9.1`

- [Download RunTelos-0.9.1-portable.exe](https://github.com/rowanjove/RunTelos/releases/download/v0.9.1/RunTelos-0.9.1-portable.exe)
- [Check the SHA-256 digest](./SHA256SUMS.txt)
- Requirements: Windows 10/11 x64 with Microsoft Edge WebView2 Runtime

The executable is open source but not code-signed. Windows SmartScreen may show a warning on first launch. Download it from this repository's Release page and verify the SHA-256 digest when needed.

## Supported task types

| Type | Typical use | How it runs |
| --- | --- | --- |
| BAT / CMD | Build, deployment, and maintenance scripts | Started through `cmd.exe` |
| PowerShell | `.ps1` automation | Started through PowerShell |
| Python | `.py` tools and background scripts | Normal or silent mode |
| EXE | Local applications and command-line tools | Started directly |
| WSL | Linux toolchains and shell commands | Windows Terminal first, then a WSL fallback |
| URL | Documentation, dashboards, and local services | Opened in the default browser |

Each task may have a name, aliases, group, arguments, working directory, favorite state, and administrator mode. Script tasks can also keep their terminal window open after execution.

## Everyday use

1. Run the portable executable and select `+`, or press `Ctrl+N`.
2. Choose a script or program. WSL commands and URLs can be entered directly.
3. Select a task card to run it. The context menu provides edit, reveal, error details, and delete actions.
4. Use favorites, groups, and drag-and-drop ordering to organize the list.
5. Press `Alt+Space` or `Ctrl+F` inside the window to search. The system-wide shortcut is configurable in Settings.

Compact mode works well at the edge of the desktop. Expanded mode adds the group sidebar. RunTelos remembers a separate window size for each mode.

## History and recovery

- The newest 200 launch records are stored locally, including the task name, time, and success or failure state.
- RunTelos rotates three automatic backups before configuration changes.
- If the configuration cannot be loaded, the recovery screen can import a file, restore a selected backup, or open the data directory.
- Imports are checked for supported versions, task types, field lengths, duplicate IDs, and mismatched payloads.

The data directory keeps the legacy `ScriptLauncher` name so existing installations remain compatible:

```text
%APPDATA%\ScriptLauncher\config.json
%APPDATA%\ScriptLauncher\history.json
%APPDATA%\ScriptLauncher\window-state.json
```

## Privacy and security model

RunTelos has no account system, cloud sync, telemetry, or advertising. It does not upload tasks, paths, commands, history, or environment variables. Apart from dependency installation and URLs explicitly opened by the user, the application does not require network access.

Tasks receive the same permissions as a manual launch. Windows displays a UAC prompt when administrator mode is requested. Review paths, arguments, commands, and URLs before importing a configuration from someone else or running an unfamiliar script.

See [SECURITY.md](./SECURITY.md) for vulnerability reporting. The narrowly scoped Rust dependency audit exceptions are documented in [docs/security-advisories.md](./docs/security-advisories.md).

## Build from source

You need Node.js 20+, stable Rust, the Windows prerequisites for Tauri 2, and `cargo-audit` for the complete security check.

```powershell
npm ci
cargo install cargo-audit --locked
npm run check
npm run build:portable
npm run verify:release
```

For development:

```powershell
npm run tauri dev
```

`npm run build:portable` performs the Tauri release build, creates the correctly named portable executable, and refreshes `SHA256SUMS.txt`. A bare `cargo build --release` output is not a distribution artifact.

## Repository layout

```text
src/                    React UI, interactions, and frontend tests
src-tauri/src/          Rust configuration, launch, tray, and window logic
src-tauri/capabilities/ Tauri least-privilege declarations
scripts/                Project and release artifact verification
docs/                   Screenshots and dependency security notes
```

The complete check runs 48 frontend tests, 48 Rust tests, the TypeScript build, rustfmt, Clippy with `-D warnings`, npm audit, and RustSec audit.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or pull request. User-visible changes are recorded in [CHANGELOG.md](./CHANGELOG.md).

## License

RunTelos is available under the [MIT License](./LICENSE). You may use, modify, and redistribute the source while retaining the license and copyright notice.
