"""
mitmproxy addon for Blackwire
Captures HTTP/WebSocket traffic, supports interception and scope filtering
"""

import json
import time
import hashlib
import re
import importlib.util
from pathlib import Path
from urllib.parse import urlparse
import httpx
from mitmproxy import http, ctx
import os

VERBOSE = os.getenv('BLACKWIRE_VERBOSE', '0') in ('1','true','TRUE','yes','YES')

def vlog(msg: str):
    if VERBOSE:
        ctx.log.info(f'[blackwire][verbose] {msg}')


# ---------------------------------------------------------------------------
# Console log forwarding (sends to Blackwire's /api/console/addon_log)
# Uses urllib (stdlib, no extra deps) with fire-and-forget threads so it
# never blocks the mitmproxy event loop.  Silent on failure — never recurse.
# ---------------------------------------------------------------------------
import urllib.request as _urlreq
import json as _json
import threading as _threading

_CONSOLE_URL = "http://127.0.0.1:5000/api/console/addon_log"
_MITM_LEVEL_MAP = {
    "debug": "DEBUG", "info": "INFO",
    "warn": "WARNING", "warning": "WARNING",
    "error": "ERROR", "alert": "ERROR",
}
# Minimum level to forward to avoid debug spam
_CONSOLE_MIN_LEVELS = {"INFO", "WARNING", "ERROR"}

# Thread-local flag to detect re-entrancy from the log hook itself
_in_log_send = _threading.local()


def _send_console_log(level: str, msg: str, name: str = "mitmproxy") -> None:
    """POST a log entry to the backend console endpoint.  Never raises.
    Uses a thread-local guard to prevent any re-entrancy."""
    if getattr(_in_log_send, 'active', False):
        return
    _in_log_send.active = True
    try:
        payload = _json.dumps({"level": level, "msg": msg, "name": name}).encode()
        req = _urlreq.Request(
            _CONSOLE_URL, data=payload,
            headers={"Content-Type": "application/json"}, method="POST"
        )
        with _urlreq.urlopen(req, timeout=0.5):
            pass
    except Exception:
        pass  # Always silent — must never create more log entries
    finally:
        _in_log_send.active = False



BACKEND_URL = "http://127.0.0.1:5000"
CONFIG_PATH = Path(__file__).parent.parent / ".proxy_config.json"
EXTENSIONS_DIR = Path(__file__).parent / "extensions"
_BACKEND_DIR = Path(__file__).parent.resolve()
_SAFE_ID_RE = re.compile(r'^[a-zA-Z0-9_-]{1,64}$')

FILTERED_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
    '.css', '.woff', '.woff2', '.ttf', '.eot',
    '.mp3', '.mp4', '.avi', '.mov', '.webm'
}

MAX_BODY_SIZE = 10 * 1024 * 1024  # 10MB (increased for large JS files)


def load_config() -> dict:
    """Load current proxy configuration"""
    try:
        if CONFIG_PATH.exists():
            cfg = json.loads(CONFIG_PATH.read_text())
            vlog(f"Loaded config: intercept_enabled={cfg.get('intercept_enabled')} rules={len(cfg.get('scope_rules', []))} project={cfg.get('project')}")
            return cfg
    except:
        ctx.log.warn('Failed to read config file; using defaults')
        pass
    return {
        "intercept_enabled": False,
        "scope_rules": [],
        "project": None,
        "extensions": {}
    }


def should_filter(url: str) -> bool:
    """Check if URL should be filtered based on extension"""
    parsed = urlparse(url)
    path = parsed.path.lower()
    filtered = any(path.endswith(ext) for ext in FILTERED_EXTENSIONS)
    if filtered:
        vlog(f'Filtered by extension: {url}')
    return filtered


def match_scope(url: str, rules: list) -> bool:
    """Check if URL matches scope rules"""
    if not rules:
        return True

    parsed = urlparse(url)
    host = parsed.netloc
    path = parsed.path
    full_url = f"{host}{path}"

    in_scope = False
    has_include = False

    for rule in rules:
        if not rule.get("enabled", True):
            continue

        pattern = rule.get("pattern", "")
        rule_type = rule.get("rule_type", "include")

        if rule_type == "include":
            has_include = True

        # Convert glob to regex: escape all regex metacharacters except *, then replace * with .*
        regex = ".*".join(re.escape(part) for part in pattern.split("*"))

        try:
            # Use case-insensitive matching for hostnames (RFC 3986)
            if re.match(regex, host, re.IGNORECASE) or re.match(regex, full_url, re.IGNORECASE):
                vlog(f"Scope rule matched ({rule_type}): pattern={pattern} url={full_url}")
                if rule_type == "include":
                    in_scope = True
                elif rule_type == "exclude":
                    return False
        except:
            continue

    # If no include rules, everything is in scope
    if not has_include:
        return True

    return in_scope


def truncate_body(body: bytes, max_size: int = MAX_BODY_SIZE) -> str:
    """Truncate and decode body"""
    if not body:
        return None

    truncated = len(body) > max_size
    if truncated:
        body = body[:max_size]

    try:
        text = body.decode('utf-8')
    except UnicodeDecodeError:
        try:
            text = body.decode('latin-1')
        except:
            text = f"[Binary: {len(body)} bytes]"

    if truncated:
        text += f"\n[...TRUNCATED at {max_size} bytes...]"

    return text


def send_to_backend(endpoint: str, data: dict, retries: int = 2):
    """Send data to backend with retry support for high-volume traffic"""
    for attempt in range(retries + 1):
        try:
            with httpx.Client(timeout=15) as client:
                r = client.post(f"{BACKEND_URL}{endpoint}", json=data)
                if VERBOSE:
                    ctx.log.info(f"[blackwire][backend] POST {endpoint} -> {r.status_code}")
                return
        except Exception as e:
            if attempt < retries:
                time.sleep(0.1 * (attempt + 1))
                continue
            if VERBOSE:
                ctx.log.warn(f"[blackwire][backend] POST {endpoint} failed after {retries + 1} attempts: {e}")
            ctx.log.warn(f"Backend error: {e}")


def wait_for_action(request_id: str, timeout: int = 300) -> dict:
    """Wait for user action on intercepted request"""
    if not _SAFE_ID_RE.fullmatch(request_id):
        ctx.log.warn(f"[blackwire][intercept] unsafe request_id rejected: {request_id!r}")
        return {"action": "forward"}
    action_file = _BACKEND_DIR / f".action_{request_id}.json"
    # Defence-in-depth: verify the resolved path stays inside _BACKEND_DIR
    if action_file.resolve().parent != _BACKEND_DIR:
        ctx.log.warn(f"[blackwire][intercept] path traversal blocked for {request_id!r}")
        return {"action": "forward"}

    start = time.time()
    last_log = 0
    while time.time() - start < timeout:
        if VERBOSE and (time.time() - start - last_log) >= 5:
            last_log = time.time() - start
            ctx.log.info(f"[blackwire][intercept] waiting action for {request_id} ({int(last_log)}s/{timeout}s)")
        if action_file.exists():
            try:
                action = json.loads(action_file.read_text())
                action_file.unlink()  # Clean up
                return action
            except:
                pass
        time.sleep(0.1)

    # Timeout - forward by default
    ctx.log.warn(f"[blackwire][intercept] timeout waiting for action; forwarding {request_id}")
    return {"action": "forward"}


class ExtensionBase:
    name = "base"

    def on_load(self, extension_config: dict, full_config: dict):
        return

    def on_request(self, flow: http.HTTPFlow, extension_config: dict, full_config: dict):
        return

    def on_response(self, flow: http.HTTPFlow, extension_config: dict, full_config: dict):
        return

    def on_websocket_message(self, flow: http.HTTPFlow, extension_config: dict, full_config: dict):
        return


def load_extensions() -> list:
    extensions = []
    if not EXTENSIONS_DIR.exists():
        return extensions

    for path in sorted(EXTENSIONS_DIR.glob("*.py")):
        if path.name.startswith("_") or path.name == "__init__.py":
            continue
        module_name = f"blackwire_ext_{path.stem}"
        try:
            spec = importlib.util.spec_from_file_location(module_name, path)
            if not spec or not spec.loader:
                ctx.log.warn(f"[blackwire][ext] cannot load {path.name}: no spec")
                continue
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            new_exts = []
            if hasattr(module, "register"):
                result = module.register()
                if isinstance(result, list):
                    new_exts = result
                elif result:
                    new_exts = [result]
            elif hasattr(module, "Extension"):
                new_exts = [module.Extension()]
            for ext in new_exts:
                if ext:
                    extensions.append(ext)
                    vlog(f"Loaded extension: {getattr(ext, 'name', path.stem)}")
        except Exception as e:
            ctx.log.warn(f"[blackwire][ext] failed to load {path.name}: {e}")
    return extensions


class BlackwireAddon:
    def __init__(self):
        self.config = load_config()
        self.extensions = load_extensions()
        self._init_extensions()

    def _init_extensions(self):
        ext_cfg = self.config.get("extensions", {})
        for ext in self.extensions:
            try:
                ext.on_load(ext_cfg.get(getattr(ext, "name", ""), {}), self.config)
            except Exception as e:
                ctx.log.warn(f"[blackwire][ext] on_load failed ({getattr(ext, 'name', 'unknown')}): {e}")

    def reload_config(self):
        """Reload configuration from file"""
        vlog('Reloading config from disk')
        self.config = load_config()

    def _apply_extensions(self, hook: str, flow: http.HTTPFlow):
        ext_cfg = self.config.get("extensions", {})
        for ext in self.extensions:
            ext_name = getattr(ext, "name", "")
            cfg = ext_cfg.get(ext_name, {})
            if cfg.get("enabled", True) is False:
                continue
            fn = getattr(ext, hook, None)
            if not fn:
                continue
            try:
                fn(flow, cfg, self.config)
            except Exception as e:
                ctx.log.warn(f"[blackwire][ext] {hook} failed ({ext_name}): {e}")

    def log(self, entry) -> None:
        """Capture mitmproxy's own log messages and forward to Blackwire console.
        Runs synchronously on mitmproxy's event loop — must return fast."""
        try:
            raw_level = str(getattr(entry, 'level', 'info')).lower()
            level = _MITM_LEVEL_MAP.get(raw_level, "INFO")
            if level not in _CONSOLE_MIN_LEVELS:
                return
            msg = str(getattr(entry, 'msg', entry))
            # Fire-and-forget so we never block the event loop
            _threading.Thread(
                target=_send_console_log,
                args=(level, msg, "mitmproxy"),
                daemon=True
            ).start()
        except Exception:
            pass

    def request(self, flow: http.HTTPFlow):
        """Handle incoming request - check for interception"""
        try:
            self._handle_request(flow)
        except Exception as e:
            ctx.log.warn(f"[blackwire] error in request hook for {flow.request.pretty_url}: {e}")

    def _handle_request(self, flow: http.HTTPFlow):
        # Reload config to get latest settings
        self.reload_config()

        if should_filter(flow.request.pretty_url):
            return

        url = flow.request.pretty_url
        vlog(f"Request: {flow.request.method} {url}")

        # Log every request to the frontend console
        scope_tag = "" if match_scope(url, self.config.get("scope_rules", [])) else " [out-of-scope]"
        _threading.Thread(
            target=_send_console_log,
            args=("INFO", f">> {flow.request.method} {url}{scope_tag}", "proxy"),
            daemon=True
        ).start()

        # Check scope
        in_scope = match_scope(url, self.config.get("scope_rules", []))
        vlog(f"In-scope={in_scope} intercept_enabled={self.config.get('intercept_enabled')}")

        # Extension hook before interception and capture
        try:
            self._apply_extensions("on_request", flow)
        except Exception as e:
            ctx.log.warn(f"[blackwire] extension error in request hook: {e}")

        # Check if interception is enabled and request is in scope
        if self.config.get("intercept_enabled") and in_scope:
            # Generate request ID
            request_id = hashlib.md5(f"{url}{time.time()}".encode()).hexdigest()[:12]
            flow.metadata["blackwire_request_id"] = request_id

            # Send to backend for interception
            intercept_data = {
                "request_id": request_id,
                "method": flow.request.method,
                "url": url,
                "headers": dict(flow.request.headers),
                "body": truncate_body(flow.request.content)
            }

            import threading
            threading.Thread(
                target=send_to_backend,
                args=("/api/internal/intercept", intercept_data)
            ).start()

            # Wait for user action
            ctx.log.info(f"Intercepted: {flow.request.method} {url}")
            action = wait_for_action(request_id)

            if action.get("action") == "drop":
                ctx.log.info(f"Dropped: {url}")
                ctx.log.warn(f"[blackwire][intercept] user dropped {request_id} {url}")
                flow.kill()
                return

            if action.get("action") == "forward":
                modified = action.get("modified")
                if modified:
                    # Apply modifications
                    if "method" in modified:
                        flow.request.method = modified["method"]
                    if "url" in modified:
                        flow.request.url = modified["url"]
                    if "headers" in modified:
                        flow.request.headers.clear()
                        for k, v in modified["headers"].items():
                            flow.request.headers[k] = v
                    if "body" in modified and modified["body"]:
                        flow.request.content = modified["body"].encode()

                if modified:
                    vlog(f"Applied modifications for {request_id}: keys={list(modified.keys())}")
                ctx.log.info(f"Forwarded: {url}")

    def response(self, flow: http.HTTPFlow):
        """Capture response and send to backend"""
        try:
            if should_filter(flow.request.pretty_url):
                return

            self.reload_config()

            # Extension hook before capture (wrapped to prevent 502s)
            try:
                self._apply_extensions("on_response", flow)
            except Exception as e:
                ctx.log.warn(f"[blackwire] extension error in response hook: {e}")

            url = flow.request.pretty_url
            in_scope = match_scope(url, self.config.get("scope_rules", []))
            vlog(f"Response: {flow.request.method} {url} status={flow.response.status_code if flow.response else 'n/a'} in_scope={in_scope}")

            # Log every response to the frontend console
            if flow.response:
                status = flow.response.status_code
                level = "WARNING" if status >= 400 else "INFO"
                _threading.Thread(
                    target=_send_console_log,
                    args=(level, f"<< {status} {flow.request.method} {url}", "proxy"),
                    daemon=True
                ).start()

            # Check if response interception is enabled
            if self.config.get("intercept_enabled") and self.config.get("intercept_responses", False) and in_scope and flow.response:
                response_id = hashlib.md5(f"{url}_resp{time.time()}".encode()).hexdigest()[:12]

                intercept_data = {
                    "request_id": response_id,
                    "method": flow.request.method,
                    "url": url,
                    "req_headers": dict(flow.request.headers),
                    "req_body": truncate_body(flow.request.content),
                    "status_code": flow.response.status_code,
                    "headers": dict(flow.response.headers),
                    "body": truncate_body(flow.response.content),
                }

                import threading
                threading.Thread(
                    target=send_to_backend,
                    args=("/api/internal/intercept_response", intercept_data)
                ).start()

                ctx.log.info(f"Response intercepted: {flow.request.method} {url} {flow.response.status_code}")
                action = wait_for_action(response_id)

                if action.get("action") == "drop":
                    ctx.log.warn(f"[blackwire][intercept] response dropped {response_id} {url}")
                    flow.kill()
                    return

                if action.get("action") == "forward":
                    modified = action.get("modified")
                    if modified:
                        if "status_code" in modified:
                            flow.response.status_code = int(modified["status_code"])
                        if "headers" in modified:
                            flow.response.headers.clear()
                            for k, v in modified["headers"].items():
                                flow.response.headers[k] = v
                        if "body" in modified and modified["body"] is not None:
                            flow.response.content = modified["body"].encode()
                        vlog(f"Applied response modifications for {response_id}: keys={list(modified.keys())}")
                    ctx.log.info(f"Response forwarded: {url}")

            data = {
                "method": flow.request.method,
                "url": url,
                "headers": dict(flow.request.headers),
                "body": truncate_body(flow.request.content),
                "request_type": "http",
                "in_scope": in_scope
            }

            if flow.response:
                data["response_status"] = flow.response.status_code
                data["response_headers"] = dict(flow.response.headers)
                data["response_body"] = truncate_body(flow.response.content)

            import threading
            threading.Thread(
                target=send_to_backend,
                args=("/api/internal/request", data)
            ).start()
        except Exception as e:
            ctx.log.warn(f"[blackwire] error in response hook for {flow.request.pretty_url}: {e}")

    def websocket_message(self, flow: http.HTTPFlow):
        """Capture WebSocket messages"""
        assert flow.websocket is not None

        self.reload_config()

        # Extension hook for websocket messages
        self._apply_extensions("on_websocket_message", flow)

        message = flow.websocket.messages[-1]

        data = {
            "method": "WS",
            "url": flow.request.pretty_url,
            "headers": dict(flow.request.headers),
            "body": message.content.decode('utf-8', errors='replace') if isinstance(message.content, bytes) else str(message.content),
            "request_type": "websocket",
            "response_body": f"[WebSocket {'↑' if message.from_client else '↓'}]"
        }

        import threading
        threading.Thread(
            target=send_to_backend,
            args=("/api/internal/request", data)
        ).start()

    def error(self, flow: http.HTTPFlow):
        """Handle errors in the proxy flow to prevent 502s"""
        try:
            url = flow.request.pretty_url if flow.request else "unknown"
            error_msg = flow.error.msg if hasattr(flow, 'error') and flow.error else "Unknown error"

            ctx.log.error(f"[blackwire] Flow error for {url}: {error_msg}")

            # Send error to console
            _threading.Thread(
                target=_send_console_log,
                args=("ERROR", f"⚠️  Proxy error: {error_msg} ({url})", "proxy"),
                daemon=True
            ).start()

            # Try to send error details to backend
            if flow.request:
                data = {
                    "method": flow.request.method,
                    "url": url,
                    "headers": dict(flow.request.headers),
                    "body": "",
                    "request_type": "http",
                    "in_scope": False,
                    "response_status": 502,
                    "response_headers": {"X-Blackwire-Error": error_msg},
                    "response_body": f"[Proxy Error: {error_msg}]"
                }

                _threading.Thread(
                    target=send_to_backend,
                    args=("/api/internal/request", data)
                ).start()
        except Exception as e:
            ctx.log.error(f"[blackwire] Error in error handler: {e}")


addons = [BlackwireAddon()]