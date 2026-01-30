"""
Match & Replace extension for Blackwire.

Rules format (config.json -> extensions.match_replace.rules):
[
  {
    "enabled": true,
    "when": "request",         # request | response | both
    "target": "url",           # url | headers | body
    "pattern": "example.com",
    "replace": "example.org",
    "regex": false,
    "ignore_case": false,
    "header": "User-Agent"     # optional, only for target=headers
  }
]
"""

import re
from mitmproxy import http

EXTENSION_META = {
    "name": "match_replace",
    "title": "Match & Replace",
    "description": "Modifica URL, headers o body en requests/responses usando reglas simples o regex.",
    "tabs": [
        {"id": "main", "label": "🧩 Match & Replace"}
    ],
}


class MatchReplaceExtension:
    name = "match_replace"

    def on_request(self, flow: http.HTTPFlow, cfg: dict, full_config: dict):
        if not cfg.get("enabled", False):
            return
        self._apply_rules(flow, cfg.get("rules", []), direction="request")

    def on_response(self, flow: http.HTTPFlow, cfg: dict, full_config: dict):
        if not cfg.get("enabled", False):
            return
        if not flow.response:
            return
        self._apply_rules(flow, cfg.get("rules", []), direction="response")

    def _apply_rules(self, flow: http.HTTPFlow, rules: list, direction: str):
        for rule in rules:
            if not rule.get("enabled", True):
                continue
            when = rule.get("when", "request")
            if when not in ("both", direction):
                continue
            target = rule.get("target", "url")
            if target == "url":
                self._replace_url(flow, rule)
            elif target == "headers":
                self._replace_headers(flow, rule, direction)
            elif target == "body":
                self._replace_body(flow, rule, direction)

    def _replace_url(self, flow: http.HTTPFlow, rule: dict):
        old = flow.request.url
        new = self._replace_text(old, rule)
        if new != old:
            flow.request.url = new

    def _replace_headers(self, flow: http.HTTPFlow, rule: dict, direction: str):
        headers = flow.request.headers if direction == "request" else flow.response.headers
        header_name = rule.get("header")
        if header_name:
            old = headers.get(header_name)
            if old is None:
                return
            new = self._replace_text(str(old), rule)
            if new != old:
                headers[header_name] = new
            return

        for key in list(headers.keys()):
            old = headers.get(key)
            if old is None:
                continue
            new = self._replace_text(str(old), rule)
            if new != old:
                headers[key] = new

    def _replace_body(self, flow: http.HTTPFlow, rule: dict, direction: str):
        message = flow.request if direction == "request" else flow.response
        if not message:
            return
        text = self._get_text(message)
        if text is None:
            return
        new = self._replace_text(text, rule)
        if new != text:
            self._set_text(message, new)

    def _replace_text(self, value: str, rule: dict) -> str:
        pattern = rule.get("pattern", "")
        replace = rule.get("replace", "")
        if pattern == "":
            return value
        if rule.get("regex", False):
            flags = re.IGNORECASE if rule.get("ignore_case", False) else 0
            try:
                return re.sub(pattern, replace, value, flags=flags)
            except re.error:
                return value
        return value.replace(pattern, replace)

    def _get_text(self, message) -> str | None:
        try:
            return message.get_text(strict=False)
        except Exception:
            try:
                return message.text
            except Exception:
                return None

    def _set_text(self, message, text: str):
        try:
            message.set_text(text)
        except Exception:
            try:
                message.text = text
            except Exception:
                return


def register():
    return MatchReplaceExtension()
