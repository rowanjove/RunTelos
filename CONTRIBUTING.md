# Contributing to RunTelos

Bug reports and focused pull requests are welcome.

## Before opening an issue

- Check whether the problem occurs on the latest release.
- Remove usernames, absolute personal paths, task contents, environment variables, and configuration data from screenshots and logs.
- Include the Windows version, RunTelos version, task type, and a minimal reproduction.

Security problems should follow [SECURITY.md](./SECURITY.md), not a public issue.

## Development

Install Node.js 20+, stable Rust, the Tauri 2 Windows prerequisites, and `cargo-audit`. Then run:

```powershell
npm ci
cargo install cargo-audit --locked
npm run check
```

Use `npm run tauri dev` for the real desktop shell. A Vite browser preview cannot validate Tauri IPC, global shortcuts, the tray, UAC, or native file dialogs.

## Pull requests

- Keep changes limited to one clear purpose.
- Add or update tests for changed behavior.
- Update both `README.md` and `README.en.md` when public behavior or setup changes.
- Do not commit generated executables, local configuration, launch history, logs, credentials, or screenshots containing personal data.
- Run `npm run check` and `git diff --check` before submitting.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
