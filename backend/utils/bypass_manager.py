"""
Bypass Manager - Gestiona reglas para excluir URLs del proxy MITM
Útil para sitios como Google reCAPTCHA que no funcionan con certificados MITM
"""

import re
from typing import List, Dict, Optional
from urllib.parse import urlparse


class BypassRule:
    """Representa una regla de bypass"""

    def __init__(self, id: int, pattern: str, is_regex: bool = False, description: str = "", enabled: bool = True):
        self.id = id
        self.pattern = pattern
        self.is_regex = is_regex
        self.description = description
        self.enabled = enabled

        # Compilar regex si aplica
        self._regex = None
        if is_regex:
            try:
                self._regex = re.compile(pattern, re.IGNORECASE)
            except re.error as e:
                raise ValueError(f"Invalid regex pattern: {e}")

    def matches(self, url: str) -> bool:
        """Verifica si una URL coincide con esta regla"""
        if not self.enabled:
            return False

        # Extraer el host de la URL
        try:
            parsed = urlparse(url)
            host = parsed.hostname or parsed.netloc
        except:
            host = url

        if self.is_regex:
            if self._regex:
                return bool(self._regex.search(host))
            return False
        else:
            # Match exacto o wildcard simple
            if '*' in self.pattern:
                # Convertir wildcard a regex
                escaped = re.escape(self.pattern).replace(r'\*', '.*')
                pattern_regex = re.compile(f'^{escaped}$', re.IGNORECASE)
                return bool(pattern_regex.match(host))
            else:
                # Match exacto (case-insensitive)
                return host.lower() == self.pattern.lower()

    def to_dict(self) -> Dict:
        """Convierte la regla a diccionario"""
        return {
            "id": self.id,
            "pattern": self.pattern,
            "is_regex": self.is_regex,
            "description": self.description,
            "enabled": self.enabled
        }


class BypassManager:
    """Administra reglas de bypass"""

    def __init__(self):
        self.rules: List[BypassRule] = []

    def load_rules(self, rules_data: List[Dict]):
        """Carga reglas desde datos de base de datos"""
        self.rules = []
        for data in rules_data:
            try:
                rule = BypassRule(
                    id=data['id'],
                    pattern=data['pattern'],
                    is_regex=bool(data.get('is_regex', False)),
                    description=data.get('description', ''),
                    enabled=bool(data.get('enabled', True))
                )
                self.rules.append(rule)
            except Exception as e:
                # Log error pero continuar con otras reglas
                print(f"Error loading bypass rule {data.get('id')}: {e}")

    def should_bypass(self, url: str) -> bool:
        """Verifica si una URL debe ser bypassed"""
        for rule in self.rules:
            if rule.matches(url):
                return True
        return False

    def get_ignore_hosts_pattern(self) -> Optional[str]:
        """
        Genera el patrón para mitmproxy --ignore-hosts

        Format: regex pattern que matchea hosts a ignorar
        Ejemplo: "^(.*\.)?google\.com$|^(.*\.)?gstatic\.com$"
        """
        if not self.rules:
            return None

        patterns = []

        for rule in self.rules:
            if not rule.enabled:
                continue

            if rule.is_regex:
                # Ya es regex, usar directamente
                patterns.append(f"({rule.pattern})")
            else:
                # Convertir pattern simple/wildcard a regex
                if '*' in rule.pattern:
                    # Wildcard: *.google.com -> ^(.*\.)?google\.com$
                    # Primero escapar el pattern completo
                    parts = rule.pattern.split('*')
                    escaped_parts = [re.escape(part) for part in parts]
                    # Reemplazar * con el patrón que matchea subdominios opcionales
                    if rule.pattern.startswith('*.'):
                        # *.example.com -> match example.com y subdominios
                        domain = re.escape(rule.pattern[2:])  # Remover *.
                        patterns.append(f"^({domain}|.*\\.{domain})$")
                    else:
                        # Otros casos de wildcard
                        pattern = '.*'.join(escaped_parts)
                        patterns.append(f"^{pattern}$")
                else:
                    # Pattern exacto: google.com -> ^google\.com$
                    escaped = re.escape(rule.pattern)
                    patterns.append(f"^{escaped}$")

        if not patterns:
            return None

        # Combinar todos los patrones con OR
        combined = '|'.join(patterns)
        return combined


# Patrones predefinidos comunes para Google/reCAPTCHA
GOOGLE_BYPASS_PRESETS = [
    {
        "pattern": "*.google.com",
        "description": "Google domains (including reCAPTCHA)",
        "is_regex": False
    },
    {
        "pattern": "*.gstatic.com",
        "description": "Google static content",
        "is_regex": False
    },
    {
        "pattern": "*.googleapis.com",
        "description": "Google APIs",
        "is_regex": False
    },
    {
        "pattern": "*.googleusercontent.com",
        "description": "Google user content",
        "is_regex": False
    },
    {
        "pattern": "*.recaptcha.net",
        "description": "reCAPTCHA domains",
        "is_regex": False
    },
]

# Otros presets útiles
CLOUDFLARE_BYPASS_PRESETS = [
    {
        "pattern": "*.cloudflare.com",
        "description": "Cloudflare services",
        "is_regex": False
    },
    {
        "pattern": "*.cloudflarestream.com",
        "description": "Cloudflare streaming",
        "is_regex": False
    },
]

COMMON_CDN_PRESETS = [
    {
        "pattern": "*.cdn.cloudflare.net",
        "description": "Cloudflare CDN",
        "is_regex": False
    },
    {
        "pattern": "*.akamaized.net",
        "description": "Akamai CDN",
        "is_regex": False
    },
    {
        "pattern": "*.fastly.net",
        "description": "Fastly CDN",
        "is_regex": False
    },
]

ALL_PRESETS = {
    "google": GOOGLE_BYPASS_PRESETS,
    "cloudflare": CLOUDFLARE_BYPASS_PRESETS,
    "cdn": COMMON_CDN_PRESETS,
}
