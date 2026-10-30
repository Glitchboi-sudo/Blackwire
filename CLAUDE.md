# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project Overview
BlackWire is a self-hosted, portable HTTP/HTTPS proxy interceptor for security testing, traffic analysis, and web-application debugging — a lightweight, extensible alternative to Burp Suite and OWASP ZAP. Stack: **FastAPI + Python** backend, **mitmproxy** (interception engine), **SQLite, one database per project**, and a **native PySide6/Qt desktop app** as the only UI. In-code comments are bilingual (ES/EN).

> **The web UI is EOL (removed).** As of v2.0.0 the React/web frontend has been deleted and is no longer maintained. The **only** interface is the native desktop app (PySide6/Qt) in [`desktop/`](desktop/); it runs on the host, consumes the backend over REST + WebSocket, and manages the backend as a Docker container ([`desktop/blackwire_desktop/docker_runtime.py`](desktop/blackwire_desktop/docker_runtime.py)). It is packaged with PyInstaller ([`packaging/blackwire-desktop.spec`](packaging/blackwire-desktop.spec)) and produced, with the backend Docker image, by `.github/workflows/desktop.yml` on a `v*` tag. An MCP server ([`mcp_server/`](mcp_server/), launchable as `blackwire-desktop --mcp`) exposes Blackwire to AI agents. **All new UI work goes in `desktop/`, never a web frontend.**

# Current State
Built and verified: proxy interception, **Repeater**, **HTTPQL** filtering, **Site Map**, **Sensitive Discovery** (50+ patterns + Shannon entropy), **JWT analyzer**, **Cipher** (chainable encode/hash/crypto ops), **WebSocket viewer**, **Collections** with JSONPath variables, **Session rules**, **Compare** (LCS diff), Git integration, Burp-compatible import/export, 15 themes, and the **extension system**.

The codebase has been **fully de-monolithized**: the backend is an app factory (`backend/main.py`) plus one FastAPI router per domain under `backend/routes/`, shared state/services in `backend/services/`, and helpers in `backend/utils/`. The UI is the native desktop app under `desktop/blackwire_desktop/` (shell in `main.py`, one widget per tool under `widgets/`, REST client in `api.py`). **Not yet built:** multi-user authentication; automated tests.

# Environment Setup (read this first)
Requires **Python 3.9+**. The desktop app additionally needs **PySide6/Qt** (and, to run the MCP server, the deps in `mcp_server/requirements.txt`).
```bash
git clone https://github.com/Glitchboi-sudo/Blackwire.git
cd Blackwire
make install                 # venv + backend deps + mitmproxy cert
make start                   # start the backend (FastAPI + mitmproxy) in the background
python desktop/run.py        # launch the native desktop app (needs PySide6 on the host)
```
Two constraints that will otherwise waste your time:
- **There is no web UI.** It was removed in v2.0.0 (EOL). The only interface is the native desktop app in `desktop/`; do not reintroduce a browser frontend.
- **The mitmproxy CA lives at `~/.mitmproxy/`.** If HTTPS interception breaks, delete that directory and run `make cert`.

# Commands
Backend development commands live in the `Makefile` (run `make help` for the full list):
- **Setup:** `make install` — venv + dependencies + mitmproxy certificate
- **Start (background):** `make start` · **Foreground:** `make serve`
- **Stop:** `make stop` · **Restart:** `make restart` (required after any backend or extension change)
- **Verify environment:** `make verify`
- **Clean (venv, caches, build):** `make clean`

Desktop app: `python desktop/run.py` (GUI) · `python desktop/run.py --selftest` (headless smoke test) · `blackwire-desktop --mcp` (MCP server, stdio).

# Architecture
```
Client traffic → mitmproxy (backend/mitm_addon.py, :8080)
                     ↕ hooks: on_request / on_response
FastAPI (backend/main.py, :5000) ↔ SQLite (projects/{name}/blackwire.db)
                     ↕ REST + WebSocket
Native desktop app (desktop/, PySide6/Qt — runs on the host)
```
- **Backend** is a thin app factory (`main.py`) that registers one router per feature domain from `backend/routes/` (history/search, repeater, intercept, scope, proxy, collections, intruder, session, chepy, websocket, git, projects, export/import, webhook, extensions, internal). Shared mutable state and the proxy lifecycle live in `backend/services/` (`state.py`, `proxy_control.py`); data access in `backend/db.py`; pure helpers in `backend/utils/`. `mitm_addon.py` runs inside the mitmproxy process and talks to the API through the `.proxy_config.json` and `.action_*.json` files (its lifecycle is independent).
- **Desktop app** (`desktop/blackwire_desktop/`) is a PySide6/Qt client of the backend REST+WS. `main.py` is the shell; each tool is a widget under `widgets/`; `api.py` is the only HTTP boundary; `docker_runtime.py` manages the backend container in packaged builds; `backend_server.py` runs uvicorn directly in dev. The MCP server lives separately in `mcp_server/`.
- **Extensions** (`backend/extensions/`) get full access to `mitmproxy.http.HTTPFlow`. Preferred type: **Schema-Driven** (pure Python, UI auto-generated from `EXTENSION_META["ui_schema"]`, rendered by the desktop app). The legacy `.ui.jsx` "Dynamic JSX" / "Custom React" extension UIs were removed with the web frontend (v2.0.0). Minimal shape:
  ```python
  EXTENSION_META = {"name": "...", "title": "...", "description": "...", "ui_schema": {...}, "default_config": {...}}
  class MyExtension:
      name = "..."
      def on_request(self, flow, cfg, full_config): ...
  def register(): return MyExtension()
  ```
- **Expansion strategy** — prefer in order: (1) proxy/HTTP logic → an extension; (2) new endpoints → a `backend/routes/{feature}.py` registered in `backend/main.py`; (3) new UI → a widget under `desktop/blackwire_desktop/widgets/`, wired into `main.py`; (4) shared helper → `backend/utils/` or a module in `desktop/blackwire_desktop/`; (5) only if there is no alternative, edit `backend/main.py` / `desktop/.../main.py` with the minimum diff.

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
├── desktop/          # Native PySide6/Qt app (blackwire_desktop/ + run.py) — the only UI
├── mcp_server/       # MCP server (blackwire-mcp): exposes Blackwire to AI agents (stdio)
├── packaging/        # Dockerfile (backend image), PyInstaller spec, compose, entrypoint
├── assets/           # Banner, icon, and .desktop entry
├── projects/         # One SQLite database per project (generated)
├── Makefile          # Backend development commands (make help)
├── pyproject.toml    # Project metadata and tooling config
└── requirements.txt  # Backend Python dependencies
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
- **Reintroducing a web frontend** — the web UI is EOL/removed (v2.0.0). All UI work goes in the native desktop app under `desktop/`.
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
- Reference this `CLAUDE.md` for overall project architecture and conventions.
- Write it as a wiki: indexes plus a deep dive per feature, including rationale and the current state of the project.
