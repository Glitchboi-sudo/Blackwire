# Blackwire MCP server (`blackwire-mcp`)

Exposes Blackwire as an [MCP](https://modelcontextprotocol.io) **server** so an AI
client (Claude Desktop, Claude Code, …) can drive it: search proxy history,
inspect a request, replay/modify requests through the proxy (Repeater), manage
scope, and decode data.

It is a small standalone process (no PySide6/Qt): it speaks **stdio** and proxies
every call to the Blackwire REST API at `http://127.0.0.1:5000`. The AI client
launches it; Blackwire does **not** start it.

## Security gate (read this)

Intercepted traffic can contain live credentials, cookies and tokens, and
`send_request` fires real requests through the proxy. So every tool (except
`blackwire_status`) is gated: it checks `GET /api/mcp/status` and refuses when the
gate is **disabled**. The gate is **off by default** and is toggled from the
native app (status bar → **MCP → Enable**, or `Ctrl+Shift+M`). Recent tool calls
are visible in the app under **MCP → Show activity**.

## Tools

| Tool | What it does |
|---|---|
| `blackwire_status` | Gate state + proxy status + active project (always available) |
| `list_recent_requests` | Recent captured requests (lightweight rows) |
| `search_requests` | HTTPQL search over history (e.g. `req.method.eq:POST`) |
| `get_request` | Full detail of one request (headers/body/response) |
| `send_request` | Send a raw request through the proxy (Repeater) — powerful write |
| `get_scope` / `add_scope_rule` | Read / add scope rules |
| `decode` | Chained decode/encode/hash ops (Decoder/Cipher) |
| `list_projects` / `current_project` | Project info |

## Run it

The native app generates a ready-to-paste config: **MCP → Copy client config**.
It looks like this:

```json
{
  "mcpServers": {
    "blackwire": {
      "command": "/path/to/Blackwire/venv/bin/python",
      "args": ["-m", "mcp_server.server"],
      "env": {
        "PYTHONPATH": "/path/to/Blackwire",
        "BLACKWIRE_BASE_URL": "http://127.0.0.1:5000"
      }
    }
  }
}
```

Once the package is installed (`pip install -e .` / `make install`), the console
script `blackwire-mcp` is equivalent to `python -m mcp_server.server`.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `BLACKWIRE_BASE_URL` | `http://127.0.0.1:5000` | Backend REST base URL |
| `BLACKWIRE_MCP_TIMEOUT` | `15` | HTTP timeout (seconds) |
| `BLACKWIRE_HTTPQL_PATH` | *(auto)* | Override path to the HTTPQL parser used by `search_requests` |

## How it fits the architecture

```
AI client ──stdio──▶ blackwire-mcp ──HTTP──▶ Blackwire REST API (:5000) ──▶ mitmproxy
                         │                         │
                         └── checks /api/mcp/status (the gate the GUI controls)
```

The backend only adds a thin gate router (`backend/routes/mcp.py`): status,
enable/disable, and an activity log. All tool logic lives here, over the existing
REST contracts.
