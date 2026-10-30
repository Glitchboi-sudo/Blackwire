"""Asset/Tech Fingerprinting (estilo Wappalyzer), 100% en cliente.

No hay endpoint de backend: igual que `sensitive.py`, esto analiza el detalle de
un request ya capturado (headers, cookies, body) contra un set de firmas y
devuelve las tecnologías detectadas. `widgets/asset_profile.py` lo corre tanto
en un escaneo retroactivo del historial como en caliente por cada request nuevo
que llega por WebSocket, para armar un perfil por host mientras se explora.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

# Cada regla: {"name", "category", "checks": [...]}.
# Tipos de check:
#   {"type": "header", "key": <nombre de header>, "regex": ..., "version_group": n?}
#   {"type": "cookie", "key": <nombre de cookie>}
#   {"type": "body", "regex": ..., "version_group": n?}
RULES: list[dict[str, Any]] = [
    # -- Servidores web ------------------------------------------------------ #
    {"name": "nginx", "category": "Servidor web", "checks": [
        {"type": "header", "key": "Server", "regex": r"nginx(?:/([\d.]+))?", "version_group": 1}]},
    {"name": "Apache", "category": "Servidor web", "checks": [
        {"type": "header", "key": "Server", "regex": r"Apache(?:/([\d.]+))?", "version_group": 1}]},
    {"name": "Microsoft IIS", "category": "Servidor web", "checks": [
        {"type": "header", "key": "Server", "regex": r"Microsoft-IIS(?:/([\d.]+))?", "version_group": 1}]},
    {"name": "LiteSpeed", "category": "Servidor web", "checks": [
        {"type": "header", "key": "Server", "regex": r"LiteSpeed"}]},
    {"name": "Caddy", "category": "Servidor web", "checks": [
        {"type": "header", "key": "Server", "regex": r"Caddy"}]},
    {"name": "openresty", "category": "Servidor web", "checks": [
        {"type": "header", "key": "Server", "regex": r"openresty(?:/([\d.]+))?", "version_group": 1}]},
    {"name": "Apache Tomcat", "category": "Servidor web", "checks": [
        {"type": "header", "key": "Server", "regex": r"(?:Apache-Coyote|Tomcat)(?:/([\d.]+))?", "version_group": 1},
        {"type": "cookie", "key": "JSESSIONID"}]},
    {"name": "Werkzeug (Flask)", "category": "Framework backend", "checks": [
        {"type": "header", "key": "Server", "regex": r"Werkzeug(?:/([\d.]+))?", "version_group": 1}]},
    {"name": "Gunicorn", "category": "Servidor web", "checks": [
        {"type": "header", "key": "Server", "regex": r"gunicorn(?:/([\d.]+))?", "version_group": 1}]},
    {"name": "Kestrel (ASP.NET Core)", "category": "Servidor web", "checks": [
        {"type": "header", "key": "Server", "regex": r"Kestrel"}]},

    # -- Lenguajes / backend -------------------------------------------------- #
    {"name": "PHP", "category": "Lenguaje/Backend", "checks": [
        {"type": "header", "key": "X-Powered-By", "regex": r"PHP(?:/([\d.]+))?", "version_group": 1},
        {"type": "cookie", "key": "PHPSESSID"}]},
    {"name": "ASP.NET", "category": "Framework backend", "checks": [
        {"type": "header", "key": "X-Powered-By", "regex": r"ASP\.NET"},
        {"type": "header", "key": "X-AspNet-Version", "regex": r"([\d.]+)", "version_group": 1},
        {"type": "cookie", "key": "ASP.NET_SessionId"}]},
    {"name": "Express", "category": "Framework backend", "checks": [
        {"type": "header", "key": "X-Powered-By", "regex": r"Express"}]},
    {"name": "Django", "category": "Framework backend", "checks": [
        {"type": "cookie", "key": "csrftoken"},
        {"type": "cookie", "key": "django_language"},
        {"type": "body", "regex": r"csrfmiddlewaretoken"}]},
    {"name": "Laravel", "category": "Framework backend", "checks": [
        {"type": "cookie", "key": "laravel_session"},
        {"type": "cookie", "key": "XSRF-TOKEN"}]},
    {"name": "Ruby on Rails", "category": "Framework backend", "checks": [
        {"type": "header", "key": "X-Powered-By", "regex": r"Phusion Passenger"},
        {"type": "cookie", "key": "_rails_session"},
        {"type": "body", "regex": r"csrf-param.{0,20}authenticity_token"}]},
    {"name": "Spring", "category": "Framework backend", "checks": [
        {"type": "cookie", "key": "JSESSIONID"},
        {"type": "header", "key": "X-Application-Context", "regex": r".+"}]},

    # -- CMS ------------------------------------------------------------------ #
    {"name": "WordPress", "category": "CMS", "checks": [
        {"type": "cookie", "key": "wordpress_logged_in"},
        {"type": "body", "regex": r"wp-content|wp-includes"},
        {"type": "body", "regex": r'name="generator"\s+content="WordPress\s*([\d.]+)?', "version_group": 1}]},
    {"name": "WooCommerce", "category": "CMS", "checks": [
        {"type": "cookie", "key": "woocommerce_cart_hash"},
        {"type": "body", "regex": r"woocommerce"}]},
    {"name": "Drupal", "category": "CMS", "checks": [
        {"type": "header", "key": "X-Generator", "regex": r"Drupal\s*([\d.]+)?", "version_group": 1},
        {"type": "cookie", "key": "Drupal.visitor"},
        {"type": "body", "regex": r"Drupal\.settings"}]},
    {"name": "Joomla", "category": "CMS", "checks": [
        {"type": "cookie", "key": "joomla_user_state"},
        {"type": "body", "regex": r"/media/jui/|Joomla!"}]},
    {"name": "Magento", "category": "CMS", "checks": [
        {"type": "cookie", "key": "mage-cache-sessid"},
        {"type": "body", "regex": r"Mage\.Cookies|/static/version\d+/frontend/"}]},
    {"name": "Shopify", "category": "CMS", "checks": [
        {"type": "header", "key": "X-Shopify-Stage", "regex": r".+"},
        {"type": "body", "regex": r"cdn\.shopify\.com"}]},
    {"name": "Ghost", "category": "CMS", "checks": [
        {"type": "header", "key": "X-Ghost-Cache-Status", "regex": r".+"},
        {"type": "body", "regex": r'name="generator"\s+content="Ghost\s*([\d.]+)?', "version_group": 1}]},

    # -- Frameworks/librerías frontend ---------------------------------------- #
    {"name": "React", "category": "Framework frontend", "checks": [
        {"type": "body", "regex": r"data-reactroot|__REACT_DEVTOOLS_GLOBAL_HOOK__|react-dom"}]},
    {"name": "Next.js", "category": "Framework frontend", "checks": [
        {"type": "body", "regex": r"__NEXT_DATA__|/_next/static/"}]},
    {"name": "Vue.js", "category": "Framework frontend", "checks": [
        {"type": "body", "regex": r"__vue__|data-v-[0-9a-f]{6,}|Vue\.config"}]},
    {"name": "Nuxt.js", "category": "Framework frontend", "checks": [
        {"type": "body", "regex": r"__NUXT__|/_nuxt/"}]},
    {"name": "Angular", "category": "Framework frontend", "checks": [
        {"type": "body", "regex": r"ng-version=\"([\d.]+)\"", "version_group": 1},
        {"type": "body", "regex": r"ng-app|\[ng-version\]"}]},
    {"name": "Svelte", "category": "Framework frontend", "checks": [
        {"type": "body", "regex": r"svelte-[a-z0-9]{6,}"}]},
    {"name": "jQuery", "category": "Librería JS", "checks": [
        {"type": "body", "regex": r"jquery[.-]([\d.]+)(?:\.min)?\.js", "version_group": 1},
        {"type": "body", "regex": r"jquery\.min\.js|jQuery\.fn\.jquery"}]},
    {"name": "Bootstrap", "category": "UI Framework", "checks": [
        {"type": "body", "regex": r"bootstrap[.-]([\d.]+)(?:\.min)?\.(?:css|js)", "version_group": 1},
        {"type": "body", "regex": r"bootstrap\.(?:min\.)?(?:css|js)"}]},
    {"name": "Tailwind CSS", "category": "UI Framework", "checks": [
        {"type": "body", "regex": r"tailwindcss|tailwind\.min\.css"}]},
    {"name": "Font Awesome", "category": "UI Framework", "checks": [
        {"type": "body", "regex": r"font-awesome|fontawesome[.-](?:min\.)?(?:css|js)"}]},
    {"name": "Alpine.js", "category": "Librería JS", "checks": [
        {"type": "body", "regex": r"alpinejs|x-data="}]},
    {"name": "htmx", "category": "Librería JS", "checks": [
        {"type": "body", "regex": r"htmx\.(?:min\.)?js|hx-get=|hx-post="}]},
    {"name": "Webpack", "category": "Herramientas de build", "checks": [
        {"type": "body", "regex": r"webpackJsonp|__webpack_require__"}]},
    {"name": "Vite", "category": "Herramientas de build", "checks": [
        {"type": "body", "regex": r"/@vite/client|vite/modulepreload-polyfill"}]},

    # -- Analytics / marketing -------------------------------------------------#
    {"name": "Google Analytics", "category": "Analytics", "checks": [
        {"type": "body", "regex": r"google-analytics\.com/(?:ga|analytics)\.js|gtag\('config'"}]},
    {"name": "Google Tag Manager", "category": "Analytics", "checks": [
        {"type": "body", "regex": r"googletagmanager\.com/gtm\.js"}]},
    {"name": "Hotjar", "category": "Analytics", "checks": [
        {"type": "body", "regex": r"static\.hotjar\.com"}]},
    {"name": "Segment", "category": "Analytics", "checks": [
        {"type": "body", "regex": r"cdn\.segment\.com/analytics\.js"}]},
    {"name": "Facebook Pixel", "category": "Analytics", "checks": [
        {"type": "body", "regex": r"connect\.facebook\.net.+fbevents\.js"}]},

    # -- Seguridad / terceros -------------------------------------------------- #
    {"name": "reCAPTCHA", "category": "Seguridad", "checks": [
        {"type": "body", "regex": r"google\.com/recaptcha"}]},
    {"name": "hCaptcha", "category": "Seguridad", "checks": [
        {"type": "body", "regex": r"hcaptcha\.com"}]},
    {"name": "Sentry", "category": "Seguridad", "checks": [
        {"type": "body", "regex": r"browser\.sentry-cdn\.com|Sentry\.init"}]},
    {"name": "Stripe.js", "category": "Pagos", "checks": [
        {"type": "body", "regex": r"js\.stripe\.com"}]},

    # -- CDN / Proxy / Hosting ------------------------------------------------- #
    {"name": "Cloudflare", "category": "CDN/Proxy", "checks": [
        {"type": "header", "key": "CF-Ray", "regex": r".+"},
        {"type": "header", "key": "Server", "regex": r"cloudflare"}]},
    {"name": "Varnish", "category": "CDN/Proxy", "checks": [
        {"type": "header", "key": "X-Varnish", "regex": r".+"},
        {"type": "header", "key": "Via", "regex": r"varnish"}]},
    {"name": "Fastly", "category": "CDN/Proxy", "checks": [
        {"type": "header", "key": "X-Served-By", "regex": r"cache-"},
        {"type": "header", "key": "X-Fastly-Request-ID", "regex": r".+"}]},
    {"name": "Akamai", "category": "CDN/Proxy", "checks": [
        {"type": "header", "key": "X-Akamai-Transformed", "regex": r".+"},
        {"type": "header", "key": "Server", "regex": r"AkamaiGHost"}]},
    {"name": "Amazon CloudFront", "category": "CDN/Proxy", "checks": [
        {"type": "header", "key": "X-Amz-Cf-Id", "regex": r".+"},
        {"type": "header", "key": "Via", "regex": r"CloudFront"}]},
    {"name": "Amazon S3", "category": "Hosting/PaaS", "checks": [
        {"type": "header", "key": "Server", "regex": r"AmazonS3"}]},
    {"name": "Vercel", "category": "Hosting/PaaS", "checks": [
        {"type": "header", "key": "X-Vercel-Id", "regex": r".+"},
        {"type": "header", "key": "Server", "regex": r"Vercel"}]},
    {"name": "Netlify", "category": "Hosting/PaaS", "checks": [
        {"type": "header", "key": "X-Nf-Request-Id", "regex": r".+"},
        {"type": "header", "key": "Server", "regex": r"Netlify"}]},
    {"name": "Heroku", "category": "Hosting/PaaS", "checks": [
        {"type": "header", "key": "Via", "regex": r"heroku-router"}]},
    {"name": "Firebase Hosting", "category": "Hosting/PaaS", "checks": [
        {"type": "header", "key": "Server", "regex": r"Google Frontend"},
        {"type": "header", "key": "X-Firebase-Backend", "regex": r".+"}]},
    {"name": "Kong Gateway", "category": "CDN/Proxy", "checks": [
        {"type": "header", "key": "Via", "regex": r"kong"},
        {"type": "header", "key": "X-Kong-Proxy-Latency", "regex": r".+"}]},
    {"name": "GraphQL", "category": "API", "checks": [
        {"type": "body", "regex": r'"__typename"'},
        {"type": "header", "key": "Content-Type", "regex": r"application/graphql"}]},
]


def _cookie_names(cookie_header: str) -> set[str]:
    names: set[str] = set()
    for part in re.split(r"[;,]", cookie_header or ""):
        part = part.strip()
        if not part:
            continue
        name = part.split("=", 1)[0].strip()
        if name:
            names.add(name)
    return names


def host_of(url: str) -> str:
    """Host:puerto de una URL (o la URL tal cual si no se puede parsear)."""
    try:
        return urlparse(url).netloc or url
    except Exception:  # noqa: BLE001
        return url


def _lower_dict(headers: Any) -> dict[str, str]:
    if not isinstance(headers, dict):
        return {}
    return {str(k).lower(): str(v) for k, v in headers.items()}


def detect_profile(detail: dict[str, Any]) -> list[dict[str, Any]]:
    """Analiza un request-detalle (igual forma que `sensitive.scan_detail`).

    Devuelve una lista de hallazgos `{name, category, version, evidence,
    confidence}`, uno por regla que matcheó (como mucho uno por regla: el
    primer check que matchea gana y se deja de evaluar esa regla)."""
    resp_h = _lower_dict(detail.get("response_headers"))
    req_h = _lower_dict(detail.get("headers"))
    body = str(detail.get("response_body") or "")
    cookie_names = _cookie_names(req_h.get("cookie", "")) | _cookie_names(resp_h.get("set-cookie", ""))

    findings: list[dict[str, Any]] = []
    for rule in RULES:
        for check in rule["checks"]:
            ctype = check["type"]
            if ctype == "cookie":
                if check["key"] not in cookie_names:
                    continue
                findings.append({
                    "name": rule["name"], "category": rule["category"], "version": None,
                    "evidence": f"cookie: {check['key']}", "confidence": "Alta",
                })
                break

            if ctype == "header":
                haystack = resp_h.get(check["key"].lower())
                confidence = "Alta"
            elif ctype == "body":
                haystack = body
                confidence = "Media"
            else:
                continue

            if not haystack:
                continue
            try:
                m = re.search(check["regex"], haystack, re.IGNORECASE)
            except re.error:
                continue
            if not m:
                continue

            version = None
            vg = check.get("version_group")
            if vg and len(m.groups()) >= vg and m.group(vg):
                version = m.group(vg)

            source = check.get("key", "body")
            snippet = m.group(0)[:60]
            findings.append({
                "name": rule["name"], "category": rule["category"], "version": version,
                "evidence": f"{ctype}:{source} ~ {snippet}", "confidence": confidence,
            })
            break  # siguiente regla: no sumar más evidencia de esta misma regla

    return findings
