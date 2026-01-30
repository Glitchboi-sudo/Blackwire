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



BACKEND_URL = "http://127.0.0.1:5000"
CONFIG_PATH = Path(__file__).parent / ".proxy_config.json"
EXTENSIONS_DIR = Path(__file__).parent / "extensions"

FILTERED_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
    '.css', '.woff', '.woff2', '.ttf', '.eot',
    '.mp3', '.mp4', '.avi', '.mov', '.webm'
}

MAX_BODY_SIZE = 1024 * 1024  # 1MB


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
        
        # Convert glob to regex
        regex = pattern.replace(".", r"\.").replace("*", ".*")
        
        try:
            if re.match(regex, host) or re.match(regex, full_url):
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


def send_to_backend(endpoint: str, data: dict):
    """Send data to backend"""
    try:
        with httpx.Client(timeout=5) as client:
            r = client.post(f"{BACKEND_URL}{endpoint}", json=data)
            if VERBOSE:
                ctx.log.info(f"[blackwire][backend] POST {endpoint} -> {r.status_code}")
    except Exception as e:
        if VERBOSE:
            ctx.log.warn(f"[blackwire][backend] POST {endpoint} failed: {e}")
        ctx.log.warn(f"Backend error: {e}")


def wait_for_action(request_id: str, timeout: int = 300) -> dict:
    """Wait for user action on intercepted request"""
    action_file = Path(__file__).parent / f".action_{request_id}.json"
    
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

    def request(self, flow: http.HTTPFlow):
        """Handle incoming request - check for interception"""
        # Reload config to get latest settings
        self.reload_config()
        
        if should_filter(flow.request.pretty_url):
            return
        
        url = flow.request.pretty_url
        vlog(f"Request: {flow.request.method} {url}")
        
        # Check scope
        in_scope = match_scope(url, self.config.get("scope_rules", []))
        vlog(f"In-scope={in_scope} intercept_enabled={self.config.get('intercept_enabled')}")

        # Extension hook before interception and capture
        self._apply_extensions("on_request", flow)
        
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
        if should_filter(flow.request.pretty_url):
            return
        
        self.reload_config()

        # Extension hook before capture
        self._apply_extensions("on_response", flow)
        
        url = flow.request.pretty_url
        in_scope = match_scope(url, self.config.get("scope_rules", []))
        vlog(f"Response: {flow.request.method} {url} status={flow.response.status_code if flow.response else 'n/a'} in_scope={in_scope}")
        
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


addons = [BlackwireAddon()]
