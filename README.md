# BlackWire

![Preview del proyecto](assets/Blackwire_banner.png)

<h3 align="center">Security from México to all</h3>

![Estado](https://img.shields.io/badge/status-En_desarrollo-green)
![License](https://img.shields.io/badge/license-GNU_AGPLv3-blue)

---

# Project Overview
BlackWire is a self-hosted, portable HTTP/HTTPS proxy interceptor for security testing, traffic analysis, and web-application debugging — a lightweight, extensible alternative to Burp Suite and OWASP ZAP. Stack: **FastAPI + Python**, **mitmproxy** (interception engine), **React with no bundler** (JSX transpiled on the fly via Sucrase), and **SQLite, one database per project**. The frontend is served as static files from FastAPI; there is no Webpack/Vite build pipeline for the main app. UI strings are mostly English; in-code comments are bilingual (ES/EN).

A companion repo, **[Blackwire-compile](https://github.com/Glitchboi-sudo/Blackwire)**, packages the desktop build (Tauri + Docker) producing native installers.

# Current State
Built and verified: proxy interception, **Repeater**, **HTTPQL** filtering, **Site Map**, **Sensitive Discovery** (50+ patterns + Shannon entropy), **JWT analyzer**, **Cipher** (chainable encode/hash/crypto ops), **WebSocket viewer**, **Collections** with JSONPath variables, **Session rules**, **Compare** (LCS diff), Git integration, Burp-compatible import/export, 15 themes, and the **extension system** (schema-driven, dynamic JSX, and custom React plugins).

The codebase has been **fully de-monolithized**: the backend is an app factory (`backend/main.py`) plus one FastAPI router per domain under `backend/routes/`, shared state/services in `backend/services/`, and helpers in `backend/utils/`. The frontend coordinator (`frontend/App.jsx`) delegates each tab to a component under `frontend/src/components/`. **Not yet built:** multi-user authentication, a CI/CD pipeline, and automated desktop builds — see the wiki roadmap.

# Environment Setup (read this first)
Requires **Python 3.9+** and **Node** (used only for Sucrase JSX transpilation).
```bash
git clone https://github.com/Glitchboi-sudo/Blackwire.git
cd Blackwire
make install     # creates the venv, installs deps, generates the mitmproxy cert
make run         # compiles the frontend, starts the backend, opens the browser
```
Two constraints that will otherwise waste your time:
- **Never edit `frontend/App.compiled.js` by hand.** It is the Sucrase output of `App.jsx` and is regenerated on every compile. Edit `App.jsx`, then `make compile`.
- **The mitmproxy CA lives at `~/.mitmproxy/`.** If HTTPS interception breaks, delete that directory and run `make cert`.

# Commands
Development commands live in the `Makefile` (run `make help` for the full list):
- **Setup:** `make install` — venv + dependencies + mitmproxy certificate
- **Run + browser:** `make run`
- **Start (background):** `make start` · **Foreground:** `make serve`
- **Stop:** `make stop` · **Restart:** `make restart` (required after backend/extension changes)
- **Compile frontend:** `make compile`
- **Verify environment:** `make verify`
- **Clean (venv, caches, build):** `make clean`

# Architecture
```
Client traffic → mitmproxy (backend/mitm_addon.py, :8080)
                     ↕ hooks: on_request / on_response
FastAPI (backend/main.py, :5000) ↔ SQLite (projects/{name}/blackwire.db)
                     ↕ REST + WebSocket
React frontend (served transpiled as static files)
```
- **Backend** is a thin app factory (`main.py`) that registers one router per feature domain from `backend/routes/` (history/search, repeater, intercept, scope, proxy, collections, intruder, session, chepy, websocket, git, projects, export/import, webhook, extensions, internal). Shared mutable state and the proxy lifecycle live in `backend/services/` (`state.py`, `proxy_control.py`); data access in `backend/db.py`; pure helpers in `backend/utils/`. `mitm_addon.py` runs inside the mitmproxy process and talks to the API over `.proxy_config.json` and `.action_*.json` files.
- **Frontend** loads as native ES modules. `App.jsx` holds shared state and renders the shell; each tab is a component under `frontend/src/components/tabs/`, extension UIs under `frontend/src/components/extensions/`, with domain logic in `src/hooks/`, API calls in `src/services/`, and helpers in `src/utils/`. `.jsx` modules are transpiled on request by `backend/utils/jsx.py`.
- **Extensions** (`backend/extensions/`) get full access to `mitmproxy.http.HTTPFlow`. Three types, preferred in order: **Schema-Driven** (pure Python, UI auto-generated from metadata), **Dynamic JSX** (a `.ui.jsx` alongside the `.py`, no frontend recompile), and **Custom React** (legacy).

# Out of Scope
- Network-facing / multi-user authentication (the tool is designed for local, controlled use)
- Native mobile app
- Cloud sync

# Core Development Rules
1. Code Quality
   - Type hints required for all code
   - Public APIs must have docstrings
   - Functions must be focused and small
   - Follow existing patterns exactly
   - Line length: 88 chars maximum

2. Testing Requirements
   - Coverage: test edge cases and errors
   - New features require tests
   - Bug fixes require regression tests

3. Code Style
    - PEP 8 naming (snake_case for functions/variables)
    - Class names in PascalCase
    - Constants in UPPER_SNAKE_CASE
    - Document with docstrings
    - Use f-strings for formatting

# Coding Best Practices

- **Early Returns**: Use to avoid nested conditions
- **Descriptive Names**: Use clear variable/function names (prefix handlers with "handle")
- **Constants Over Functions**: Use constants where possible
- **DRY Code**: Don't repeat yourself
- **Functional Style**: Prefer functional, immutable approaches when not verbose
- **Minimal Changes**: Only modify code related to the task at hand
- **Function Ordering**: Define composing functions before their components
- **TODO Comments**: Mark issues in existing code with "TODO:" prefix
- **Simplicity**: Prioritize simplicity and readability over clever solutions
- **Build Iteratively** Start with minimal functionality and verify it works before adding complexity
- **Run Tests**: Test your code frequently with realistic inputs and validate outputs
- **Build Test Environments**: Create testing environments for components that are difficult to validate directly
- **Functional Code**: Use functional and stateless approaches where they improve clarity
- **Clean logic**: Keep core logic clean and push implementation details to the edges
- **File Organsiation**: Balance file organization with simplicity - use an appropriate number of files for the project scale

# Project Structure
```
Blackwire/
├── backend/          # FastAPI app factory + routes/ services/ utils/ db.py + extensions/
├── frontend/         # React shell (App.jsx) + src/{components,context,hooks,services,utils}
├── assets/           # Banner, icon, and .desktop entry
├── projects/         # One SQLite database per project (generated)
├── Makefile          # Development commands (make help)
├── pyproject.toml    # Project metadata and tooling config
└── requirements.txt  # Python dependencies
```

# Workflow Guidelines
When working on a feature, follow these steps sequentially:
1. **Analyze:** First, read the relevant files and verify that you understand the existing codebase.
2. **Plan:** Present a brief, plan before making any code modifications.
3. **Execute & Test:** Implement the changes and verify the app doesn't fail catastrofically.
4. **Refactor:** Ensure the code adheres to PEP 8 and the 88-char line limit (Black/Ruff conventions; formatters not yet wired into the repo).

# Git & Commits
- Use Conventional Commits (e.g., `feat: add JWT analyzer`, `fix: webhook token refresh`, `ext: rate limiter`).
- Do not commit directly to `main`. Always create a new branch (`feat/name`, `fix/name`).

# Known Pitfalls / Avoid
- **Editing `frontend/App.compiled.js`** — it is generated; changes are overwritten on the next `make compile`. Edit `App.jsx`.
- **Hardcoding ports or absolute paths** — the project is 100% portable; use relative paths only.
- **Putting proxy/HTTP logic in `main.py`** — it belongs in `backend/mitm_addon.py` or an extension.
- **Not restarting after backend/extension changes** — there is no hot-reload; extensions are discovered at startup. Run `make restart`.
- **Logging intercepted request/response bodies** — they may contain credentials, tokens, and cookies. Never log them to stdout or server logs; use an explicit debug flag if needed.
- **Sanitizing intercepted payloads** — don't. The tool's value is showing exactly what traverses the wire, including malformed or malicious content.
- **Creating a router under `backend/routes/` without registering it in `main.py`** — FastAPI won't pick it up automatically.
- **Adding an extension dependency without updating `requirements.txt`** — the extension fails silently in other environments.
- **Adding network-facing auth without design discussion** — BlackWire is built for local, controlled use.

# Subdirectory Rules: /wiki (GitHub Wiki)
- All new documentation must be written in Markdown with `.md` extensions.
- Use H1 titles for main pages and H2 for sections.
- Ensure the tone is technical, yet accessible to security practitioners who aren't necessarily developers.
- Each feature should have its own page with: purpose, usage, configuration options, and known limitations.
- Reference this `README.md` (and the root `CLAUDE.md`) for overall project architecture and conventions.
- Write it as a wiki: indexes plus a deep dive per feature, including rationale and the current state of the project.

---

## Credits

Created by **[Erik Alcántara](https://www.linkedin.com/in/erik-alc%C3%A1ntara-covarrubias-29a97628a/)**, with support from **[Lychi3](https://www.linkedin.com/in/carlos-polanco-maga%C3%B1a-ab1256318/)**.

Inspired by [Burp Suite](https://portswigger.net/burp), [OWASP ZAP](https://www.zaproxy.org/), [mitmproxy](https://mitmproxy.org/), and [Caido](https://caido.io/).
Built with [mitmproxy](https://mitmproxy.org/), [FastAPI](https://fastapi.tiangolo.com/), [React](https://react.dev/), [Sucrase](https://github.com/alangpierce/sucrase), and [SQLite](https://www.sqlite.org/).

<div align="center">

Made with ❤️ in México

</div>
