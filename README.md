# dsh-skillradar

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)


A DeepSeek Harness plugin that scans every skill visible to the current session, scores each against the recent conversation text (English + Chinese token overlap), and returns a ranked recommendation of which skill to load next.

## Overview

DSH sessions expose many skills, and neither the model nor the user always knows which one applies. This plugin answers "what should I load right now?" with a concrete, ranked answer. It suits agents and users who work across many skill domains and want a fast, deterministic relevance signal.

## Compatibility

- DSH version: `0.1.0-rc.6`
- Mainline: verified against `deepseek-harness` mainline snapshots of 2026-08-14
- Last verified: 2026-08-14

## Install / Uninstall

Install (from GitHub):

```bash
dsh plugin add github:hellosky983/dsh-skillradar
```

Or clone and install locally:

```bash
git clone https://github.com/hellosky983/dsh-skillradar.git
cd dsh-skillradar
dsh plugin add .
```

Upgrade: re-run the install command after `git pull`.

Disable temporarily: remove the plugin row from your profile composition, or run:

```bash
dsh plugin remove dsh-skillradar
```

Uninstall: remove the `dsh-skillradar` dependency and its bundle entry from the profile `package.json`, then `pnpm install`.

## Quick start

After install and restart, tell the agent:

> Scan the current session and tell me which skill fits this task.

or invoke the tool directly:

```bash
skill_radar  # with no arguments, scans the current session
```

Example output:

```
Skill Radar — 16 skills visible
  100%  github-upload [github, 仓库, readme, 上传]
   85%  cordis-plugin-development [client, host, cordis, run]
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `session_id` | string | current session | Session to scan instead of the current one |
| `limit` | integer | 15 | Maximum number of skills returned |

No environment variables, no secrets, no external configuration files.

## Permissions & data

- Reads: the current session's recent message text (last 8000 chars) and the skill catalog via `ctx.skills` / `ctx.sessionQuery`.
- Writes: nothing. The tool only returns a scored list.
- Network: none. All scoring is local text analysis.
- Credentials: none.

## Troubleshooting

- **Tool not visible after install**: restart dsh, or check that the bundle row appears in `dsh --dump-config`.
- **"cannot get property tools without inject"**: the plugin requires `inject = ['tools']`; reinstall from the latest commit which declares it.
- **Logs**: dsh profile logs under `~/.dsh/profiles/<name>/`; set `DEBUG=cordis*` for component tracing.
- **Rollback**: revert to the previous plugin version by reinstalling the earlier git commit.

## Development

```bash
git clone https://github.com/hellosky983/dsh-skillradar.git
cd dsh-skillradar
# smoke test with a mock ctx:
node --input-type=module -e "import { apply } from './index.js'; apply({get:()=>undefined, tools:{register:()=>{}}}); console.log('ok')"
```

The client/ directory contains the optional interactive radar panel (dynamic Cordis plugin form) for the web UI.

Contributions: open issues and pull requests on GitHub. Keep changes dependency-free (scoring is self-contained). Report bugs with a minimal reproduction case.

## License & security

MIT — see [LICENSE](LICENSE). No secrets are shipped; report security issues privately via GitHub issue (repo is public) or email to the repository owner.
