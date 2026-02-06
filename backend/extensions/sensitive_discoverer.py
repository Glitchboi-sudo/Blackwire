"""
Sensitive extension (UI-only).
Scans captured HTTP traffic for sensitive data patterns (API keys, secrets, tokens, PII).
All scanning is done client-side in JavaScript.
"""

EXTENSION_META = {
    "name": "sensitive",
    "title": "Sensitive ",
    "description": "Scan HTTP traffic for sensitive data: API keys, secrets, tokens, credentials, PII.",
    "tabs": [
        {"id": "main", "label": "🔍 Sensitive "}
    ],
}


class SensitiveDiscovererExtension:
    name = "sensitive"

    def on_load(self, cfg: dict, full_config: dict):
        return


def register():
    return SensitiveDiscovererExtension()
