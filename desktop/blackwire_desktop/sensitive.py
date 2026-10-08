"""Sensitive Discovery: patrones + entropía + escaneo (Fase 5).

No hay endpoint de backend: el escaneo es en cliente (como la web). Este módulo
porta los patrones de `frontend/src/utils/parsing.js:9-86`, la entropía de Shannon
de `encoding.js`, y el algoritmo de escaneo de `App.jsx:runSensitiveScan`.
"""

from __future__ import annotations

import math
import re
from typing import Any

# Secciones escaneables de un request/response.
SECTIONS = ("reqUrl", "reqHeaders", "reqBody", "respHeaders", "respBody")

_GENERAL = [
    {"name": "Generic Token", "regex": r"(?:token)[^&|;?,]{0,32}?['\"][a-zA-Z0-9_\-+=/\\]{10,}['\"]", "category": "Credentials", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Generic Password", "regex": r"(?:password|passwd|pwd)[^&|;?,]{0,32}?['\"][^'\"]{6,}['\"]", "category": "Credentials", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": ".env Config", "regex": r"\.env", "category": "Configuration", "sections": ["respBody"], "enabled": True},
    {"name": "Private IPv4", "regex": r"(?:10\.(?:[0-9]{1,3}\.){2}[0-9]{1,3}|172\.(?:1[6-9]|2[0-9]|3[01])\.(?:[0-9]{1,3}\.)[0-9]{1,3}|192\.168\.[0-9]{1,3}\.[0-9]{1,3})", "category": "Network", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Email Address", "regex": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]{3,128}\.[a-zA-Z]{2,32}", "category": "Contact", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Basic Auth Header", "regex": r"Basic\s+[A-Za-z0-9+/=]{10,}", "category": "Credentials", "sections": ["reqHeaders", "respHeaders"], "enabled": True},
    {"name": "Bearer Token Header", "regex": r"Bearer\s+[A-Za-z0-9._~+/=-]{10,}", "category": "Credentials", "sections": ["reqHeaders", "respHeaders"], "enabled": True},
    {"name": "JDBC Connection String", "regex": r"jdbc:[a-z:]+://[^\s\"']+", "category": "Configuration", "sections": ["respBody"], "enabled": True},
    {"name": "SSH Private Key", "regex": r"-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----", "category": "Data Security", "sections": ["respBody"], "enabled": True},
]

_TOKENS = [
    {"name": "AWS Access Key ID", "regex": r"(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}", "category": "AWS", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "AWS Secret Key", "regex": r"(?:aws)[^;]{0,32}?['\"][0-9a-zA-Z/+=]{40}['\"]", "category": "AWS", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Amazon MWS Token", "regex": r"amzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "category": "Amazon", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Google API Key", "regex": r"AIza[0-9A-Za-z\-_]{35}", "category": "Google", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Google OAuth Token", "regex": r"ya29\.[0-9A-Za-z\-_]{32,48}", "category": "Google", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Google OAuth Client ID", "regex": r"\.apps\.googleusercontent\.com", "category": "Google", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Google OAuth Client Secret", "regex": r"GOCSPX-[0-9a-zA-Z\-_]{28}", "category": "Google", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "MailGun API Key", "regex": r"key-[0-9a-f]{32}", "category": "Email", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "SendGrid API Key", "regex": r"SG\.[0-9A-Za-z\-_]{22}\.[0-9A-Za-z\-_]{43}", "category": "Email", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "NuGet API Key", "regex": r"oy2[a-z0-9]{43}", "category": "Package", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Slack Token", "regex": r"x(?:ox[psboare]|app)(?:-[a-zA-Z0-9]{1,64}){1,5}", "category": "Communication", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Twilio SID", "regex": r"SK[0-9a-zA-Z]{32}", "category": "Communication", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Square Token", "regex": r"sq0(?:atp|csp|idp)-[0-9A-Za-z\-_]{22,43}", "category": "Payment", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Stripe Secret Key", "regex": r"[sr]k_(?:live|test)_[0-9a-zA-Z]{24}", "category": "Payment", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Stripe Webhook Secret", "regex": r"whsec_[0-9a-zA-Z]{32}", "category": "Payment", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "GitHub Token", "regex": r"gh[pousr]_[A-Za-z0-9]{36}", "category": "Source Control", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "GitHub Fine-grained PAT", "regex": r"github_pat_[0-9a-zA-Z]{22}_[0-9a-zA-Z]{59}", "category": "Source Control", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "OpenAI API Key", "regex": r"sk-[a-zA-Z0-9]{40,128}", "category": "AI/ML", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Heroku API Key", "regex": r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "category": "Cloud", "sections": ["respHeaders", "respBody"], "enabled": False},
    {"name": "Facebook Access Token", "regex": r"EAACEdEose0cBA[0-9A-Za-z]+", "category": "Communication", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Twitter Secret", "regex": r"(?:twitter)[^;]{0,32}?['\"][0-9a-zA-Z]{35,44}['\"]", "category": "Communication", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Twitch API Token", "regex": r"(?:twitch)[^;]{0,32}?['\"][0-9a-z]{30}['\"]", "category": "Communication", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "Mailchimp API Key", "regex": r"[0-9a-f]{32}-us[0-9]{1,2}", "category": "Email", "sections": ["respHeaders", "respBody"], "enabled": True},
    {"name": "JWT Token", "regex": r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}", "category": "Credentials", "sections": ["reqHeaders", "respHeaders", "respBody"], "enabled": True},
]

_URLS = [
    {"name": "Slack Webhook", "regex": r"hooks\.slack\.com/services/T[a-zA-Z0-9_]{8,}/B[a-zA-Z0-9_]{8,}/[a-zA-Z0-9_]{24}", "category": "Webhooks", "sections": ["respBody"], "enabled": True},
    {"name": "Teams Webhook", "regex": r"outlook\.office(?:365)?\.com/webhook/[a-zA-Z0-9\-@]+", "category": "Webhooks", "sections": ["respBody"], "enabled": True},
    {"name": "Teams Incoming Webhook", "regex": r"\.webhook\.office\.com", "category": "Webhooks", "sections": ["respBody"], "enabled": True},
    {"name": "Firebase DB URL", "regex": r"\.(?:firebaseio\.com|firebasedatabase\.app)", "category": "Cloud", "sections": ["respBody"], "enabled": True},
    {"name": "AWS S3 Bucket", "regex": r"s3(?:\.[a-z0-9-]+)?\.amazonaws\.com(?:/[^\s\"'<>]+)?", "category": "Cloud Storage", "sections": ["respBody"], "enabled": True},
    {"name": "Azure Blob Storage", "regex": r"blob\.core\.windows\.net", "category": "Cloud Storage", "sections": ["respBody"], "enabled": True},
    {"name": "Google Cloud Storage", "regex": r"gs://[a-z\d\-]{3,63}", "category": "Cloud Storage", "sections": ["respBody"], "enabled": True},
    {"name": "Amazon ARN", "regex": r"arn:aws(?:-(?:cn|us-gov|iso-[bcd]))?:[a-zA-Z0-9\-]+:[a-z0-9\-]*:[0-9]{0,12}:[a-zA-Z0-9\-_/:.]+", "category": "AWS", "sections": ["respBody"], "enabled": True},
    {"name": "Discord Webhook", "regex": r"discord(?:app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+", "category": "Webhooks", "sections": ["respBody"], "enabled": True},
]

_FILE_EXTS = [
    ".zip", ".tar", ".gz", ".rar", ".7z", ".bz2", ".xz", ".tar.gz", ".tgz",
    ".pem", ".crt", ".cer", ".der", ".p12", ".pfx", ".key", ".csr", ".jks", ".keystore",
    ".kdbx", ".kdb", ".1pif",
    ".cfg", ".conf", ".config", ".ini", ".properties", ".yaml", ".yml", ".toml",
    ".xml", ".json", ".env",
    ".sql", ".sqlite", ".db", ".mdb", ".dump", ".bak", ".bkp",
    ".doc", ".docx", ".xls", ".xlsx", ".csv", ".pdf",
    ".log", ".swp", ".swo", ".DS_Store", ".htaccess", ".htpasswd", ".npmrc", ".pypirc",
    ".git", ".svn", ".hg",
]
_FILES = [
    {"name": ext, "regex": ext.replace(".", r"\.") + r"(?:\?|$|#)",
     "category": "Files", "sections": ["reqUrl"], "enabled": True}
    for ext in _FILE_EXTS
]

DEFAULT_PATTERNS = _GENERAL + _TOKENS + _URLS + _FILES

# Categoría -> token de color del tema (espejo de SENS_COLORS).
_CATEGORY_TOKEN = {
    "AWS": "orange", "Google": "blue", "Payment": "green", "Credentials": "red",
    "Communication": "purple", "Cloud": "cyan", "Network": "txt2", "Contact": "txt2",
    "Data Security": "red", "Configuration": "orange", "Source Control": "purple",
    "Email": "blue", "Package": "txt2", "AI/ML": "green", "Webhooks": "cyan",
    "Cloud Storage": "cyan", "Files": "txt3", "Amazon": "orange",
}


def category_token(category: str) -> str:
    """Token de color del tema para una categoría (default txt2)."""
    return _CATEGORY_TOKEN.get(category, "txt2")


def calculate_entropy(text: str) -> float:
    """Entropía de Shannon (bits/char). Puerto de encoding.js:calculateEntropy."""
    if not text:
        return 0.0
    freq: dict[str, int] = {}
    for ch in text:
        freq[ch] = freq.get(ch, 0) + 1
    length = len(text)
    entropy = 0.0
    for count in freq.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy


def _headers_text(headers: Any) -> str:
    if isinstance(headers, dict):
        return "\n".join(f"{k}: {v}" for k, v in headers.items())
    return str(headers or "")


def _sections_of(detail: dict[str, Any], max_size: int) -> dict[str, str]:
    resp_body = str(detail.get("response_body") or "")
    if max_size > 0 and len(resp_body) > max_size:
        resp_body = resp_body[:max_size]
    return {
        "reqUrl": str(detail.get("url") or ""),
        "reqHeaders": _headers_text(detail.get("headers")),
        "reqBody": str(detail.get("body") or ""),
        "respHeaders": _headers_text(detail.get("response_headers")),
        "respBody": resp_body,
    }


def scan_detail(
    detail: dict[str, Any],
    patterns: list[dict[str, Any]],
    entropy_threshold: float,
    max_size: int,
) -> list[dict[str, Any]]:
    """Escanea un request-detalle con los patrones activos. Devuelve filas."""
    sections = _sections_of(detail, max_size)
    rows: list[dict[str, Any]] = []
    for pat in patterns:
        if not pat.get("enabled", True):
            continue
        try:
            rx = re.compile(pat["regex"], re.IGNORECASE)
        except re.error:
            continue
        for sec_key in pat.get("sections", []):
            text = sections.get(sec_key, "")
            if not text:
                continue
            for m in rx.finditer(text):
                match_text = m.group(0)
                if not match_text:
                    continue
                entropy = calculate_entropy(match_text)
                if entropy < entropy_threshold:
                    continue
                shown = match_text[:200] + "..." if len(match_text) > 200 else match_text
                rows.append({
                    "match": shown, "patternName": pat["name"],
                    "category": pat["category"], "url": detail.get("url", ""),
                    "method": detail.get("method", ""), "requestId": detail.get("id"),
                    "section": sec_key, "entropy": f"{entropy:.2f}",
                })
    return rows
