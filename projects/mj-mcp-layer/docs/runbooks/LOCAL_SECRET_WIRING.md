# Local Secret Wiring

This is the safe local handoff path for MJ Layer secrets across IntelliJ terminals, Codex shell runs, Antigravity shell launches, GitHub Actions, and Cloudflare Worker runtime secrets.

## Rule

Do not put raw tokens in the repository, `.idea`, app trust-token stores, Markdown docs, screenshots, or chat. Store values in local env or the remote secret store only.

## Local Env File

Copy the template:

```bash
mkdir -p /Users/home/.stratos_secrets
cp /Users/home/.stratos_secrets/ellis-aegis.env.example /Users/home/.stratos_secrets/ellis-aegis.env
chmod 600 /Users/home/.stratos_secrets/ellis-aegis.env
```

Fill `/Users/home/.stratos_secrets/ellis-aegis.env` with real values.

`/Users/home/.stratos_shell_env` sources this file only when it exists and is `chmod 600`. Since `.stratos_shell_env` is already sourced by the workstation shell setup, IntelliJ terminal sessions and Codex shell commands can pick up the same values after a new shell is opened.

## Check What Is Available

From the local checkout:

```bash
cd /Volumes/Stratos_Tools/projects/Connections-cursor-review/projects/mj-mcp-layer
npm run secrets:check
```

This prints only `present` or `missing`; it never prints values.

## Sync Stores

After the env file is filled:

```bash
cd /Volumes/Stratos_Tools/projects/Connections-cursor-review/projects/mj-mcp-layer
npm run secrets:sync
```

The sync writes:

- GitHub Actions secrets and variables for `Sentinel-Stratos-Strategies/Connections`
- Cloudflare Worker secret `OPERATOR_TOKEN` for `projects/mj-mcp-layer/mcp-layer`

The script cannot reverse-read secret values from GitHub or application trust stores. If a value exists only inside GitHub, it must be re-exported locally or pasted into the secure local env file before it can be copied somewhere else.

## Required Values

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`
- `CF_ZONE_ID_ELLIS`
- `CF_ZONE_ID_HITCH`
- `CF_ZONE_ID_KEVIS`
- `OPERATOR_TOKEN`

Optional lane-local values:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `NOTION_TOKEN`
- `LINEAR_API_KEY`
- `GITHUB_TOKEN`

Prefer connector OAuth for Notion, Linear, GitHub, Google, and Codex-facing tools when available. Use env tokens only for automation jobs that cannot use a connector.
