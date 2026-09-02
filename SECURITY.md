# Security Policy

## Supported version

Security fixes are applied to the latest published version of RunTelos.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do not open a public issue containing an exploit, private path, token, configuration file, or other sensitive material.

Include the affected version, Windows version, reproduction steps, expected impact, and any relevant logs with personal paths removed. You should receive an initial response within seven days.

## Product boundary

RunTelos executes commands selected by the local user. A configuration file is therefore executable intent, not a passive document. Review imported task paths, arguments, WSL commands, and URLs before running them.

Dependency audit exceptions are listed in [docs/security-advisories.md](./docs/security-advisories.md) with their scope and removal conditions.
