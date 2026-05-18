---
name: agent-browser-cli
description: Use agent-browser-cli to control the supervised Chromium browser through the bundled extension for navigation, page inspection, element interaction, screenshots/PDF, cookies, CDP, network, and console debugging. Use this instead of Selenium/Playwright or launching another browser.
---

# Agent Browser CLI

Use `agent-browser-cli` to inspect and control the already running Chromium instance. It talks to the bundled browser extension and preserves the real browser state, including tabs, login sessions, and cookies. Do not start another browser or switch to Selenium/Playwright for browser work.

## Core Rules

- Start every browser task with `agent-browser-cli status`.
- Continue only when `healthy=true` and `summary=ready`.
- If unhealthy, run `agent-browser-cli doctor` and `agent-browser-cli logs --tail 100`, then report the blocker if it is not recoverable.
- If command syntax is unclear, run `agent-browser-cli --help` or `agent-browser-cli <command> --help` before using that command.
- Prefer high-level CLI commands. Use `exec` or JSON/CDP only when the high-level command cannot express the task.
- Do not dump large HTML, screenshots, PDFs, response bodies, or base64 into the conversation. Write artifacts to files and report paths plus concise metadata.
- When a command is ambiguous across browsers, profiles, or tabs, specify `--browser`, `--profile`, and/or `--tab`. Do not guess.
- Use `--wait-js` for page changes and slow loading. Avoid fixed sleeps.
- Re-run `snapshot` after navigation, DOM changes, or significant interaction before reusing element references.

## Standard Workflow

1. Check health:

```bash
agent-browser-cli status
```

2. Select or open the target tab:

```bash
agent-browser-cli tabs
agent-browser-cli open --profile work https://example.com
agent-browser-cli open --window --focus https://example.com
```

When `open` returns `opened_tab_id` or `opened_session_key`, use that value for follow-up commands.

3. Inspect page content:

```bash
agent-browser-cli scan --tabs-only
agent-browser-cli scan --tab <tabId> --text-only
agent-browser-cli scan --profile work --tab <tabId> --text-only
```

4. Locate interactable elements:

```bash
agent-browser-cli snapshot --tab <tabId> --limit 200
agent-browser-cli snapshot --tab <tabId> --offset 200 --limit 200
agent-browser-cli snapshot --tab <tabId> --details
```

5. Act and verify:

```bash
agent-browser-cli click --tab <tabId> '@e1'
agent-browser-cli fill --tab <tabId> '@e2' 'hello'
agent-browser-cli send-keys --tab <tabId> --target '@e2' 'Enter'
agent-browser-cli scan --tab <tabId> --text-only
```

## Command Selection

- Use `scan` for readable page text, lists, headings, and quick content checks.
- Use `snapshot` when you need reliable targets for buttons, links, inputs, or controls. It returns `@e` element references.
- Use direct selectors when the selector is already obvious and stable.
- Use `exec` for custom JavaScript, page-specific extraction, or fallback automation.
- Use JSON/CDP for cookies, low-level browser state, CDP-only actions, or edge cases not covered by the CLI.

Element references are daemon-scoped and session-scoped. `@e` values are valid only for the current daemon, current `session_key`, and the most recent `snapshot`. Use the exact `@e1` format, including `@`.

## Tab And Profile Scope

Most high-level commands support:

```text
--tab <tabId>
--profile <profile_id-or-label>
--browser <browser_id>
```

`tabs` output includes `browser_id`, `profile_id`, `profile_label`, `tab_id`, and `session_key`. If `--tab` alone is ambiguous, add `--profile` or `--browser`.

Use tab grouping only for organization:

```bash
agent-browser-cli open https://example.com --session research
agent-browser-cli open https://example.com --group-title "Task A"
agent-browser-cli open --window --group-title "Task A" https://example.com
```

`--group-title` overrides `--session` as the visible tab group title.

## Waiting And Monitoring

For slow pages, wait for an observable page condition:

```bash
agent-browser-cli click --tab <tabId> '@e1' \
  --wait-js 'return document.body.innerText.includes("Done")' \
  --wait-timeout 10
```

Add `--monitor` only when you need an operation diff. It is not a replacement for `--wait-js`.

## Screenshots And PDFs

Always write screenshots and PDFs to files:

```bash
agent-browser-cli screenshot --tab <tabId> --out /tmp/page.png
agent-browser-cli screenshot --tab <tabId> --full-page --out /tmp/full.png
agent-browser-cli screenshot --tab <tabId> --target '@e1' --out /tmp/element.png
agent-browser-cli screenshot --tab <tabId> --selector 'button[type=submit]' --format jpeg --quality 70 --out /tmp/button.jpg
agent-browser-cli save-pdf --tab <tabId> --out /tmp/page.pdf
agent-browser-cli save-pdf --tab <tabId> --paper a4 --landscape --scale 0.9 --out /tmp/page.pdf
```

Without `--out`, screenshots are written under `/tmp/agent-browser-cli-screenshots/`; PDFs are written under `/tmp/agent-browser-cli-pdfs/`.

## Exec And CDP Fallbacks

For short JavaScript:

```bash
agent-browser-cli exec --tab <tabId> 'return document.title'
```

For complex JavaScript, write a temporary script file:

```bash
agent-browser-cli exec --tab <tabId> --file /tmp/script.js
```

If the script uses `await`, explicitly `return` the final value. Use `--wait-js` for post-action waiting instead of embedding fixed `setTimeout` delays.

JSON/CDP examples:

```bash
agent-browser-cli exec '{"cmd":"tabs"}'
agent-browser-cli exec '{"cmd":"cookies"}'
agent-browser-cli exec '{"cmd":"cdp","tabId":303987837,"method":"Page.captureScreenshot","params":{"format":"png"}}'
```

For CDP mouse clicks, prefer `mouseMoved -> mousePressed -> mouseReleased`. If the first CDP attach shows browser UI noise, send a harmless `mouseMoved` first.

## Network And Console Debugging

Network and console capture require the extension to be connected and listening. After changing or upgrading the extension, ask the user to reload the browser extension before relying on these commands.

```bash
agent-browser-cli network start --tab <tabId>
agent-browser-cli network list --tab <tabId> --filter api
agent-browser-cli network detail <requestId> --tab <tabId>
agent-browser-cli network clear --tab <tabId>
agent-browser-cli network stop --tab <tabId>

agent-browser-cli console start --tab <tabId>
agent-browser-cli console list --tab <tabId>
agent-browser-cli console list --tab <tabId> --level error
agent-browser-cli console clear --tab <tabId>
agent-browser-cli console stop --tab <tabId>
```

`network detail` may truncate large bodies and mark `base64Encoded`. Summarize relevant fields instead of pasting full bodies. `network stop` and `console stop` stop listening and clear their caches.

## Runtime Configuration

Default local endpoints:

```text
API: 127.0.0.1:18767
Extension WebSocket: 127.0.0.1:18765
Config: ~/.agent-browser-cli/config.json
```

Changing the extension port affects the extension-daemon connection. Explain the impact and get user confirmation before running:

```bash
agent-browser-cli set-extension-port <port>
```

## File Uploads

Prefer the browser `DataTransfer` API for file uploads:

```js
const input = document.querySelector('input[type=file]');
const file = new File(['content'], 'demo.txt', { type: 'text/plain' });
const dt = new DataTransfer();
dt.items.add(file);
input.files = dt.files;
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
return input.files.length;
```
