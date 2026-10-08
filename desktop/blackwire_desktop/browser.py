"""Lanzar Chromium pre-configurado para el proxy de Blackwire, confiando en su CA.

Estilo "embedded browser" de Burp: en vez de instalar el CA de mitmproxy en el
almacén del sistema, se lanza Chromium con
`--ignore-certificate-errors-spki-list=<hash>`, que hace que el navegador confíe
EXCLUSIVAMENTE en la clave pública del CA de Blackwire (no deshabilita la
validación TLS para el resto). El hash es el SHA-256 del SubjectPublicKeyInfo del
CA, en base64 — lo mismo que publica Chrome para pinning.

El navegador usa un `--user-data-dir` dedicado (perfil aparte, no contamina el
perfil normal del usuario) y apunta al `--proxy-server` del proxy activo.

El CA lo genera `make cert`. En modo nativo vive en `~/.mitmproxy/`; en el
empaque Docker se bind-montea en `~/Blackwire/certs/`. `resolve_ca_path()` prueba
ambas.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

# Rutas candidatas del CA (nativo primero, luego el bind-mount de Docker).
_CA_CANDIDATES = (
    Path.home() / ".mitmproxy" / "mitmproxy-ca-cert.pem",
    Path.home() / "Blackwire" / "certs" / "mitmproxy-ca-cert.pem",
)
DEFAULT_CA_PATH = _CA_CANDIDATES[0]

# Perfil dedicado del navegador (persistente entre lanzamientos, aislado del
# perfil normal). Mantiene logins/cookies de la sesión de pruebas.
_PROFILE_DIR = Path.home() / ".cache" / "blackwire" / "chromium-profile"

# Binarios candidatos, en orden de preferencia (Chromium primero).
_BROWSER_CANDIDATES = (
    "chromium", "chromium-browser",
    "google-chrome", "google-chrome-stable", "chrome",
    "brave", "brave-browser",
    "microsoft-edge", "microsoft-edge-stable",
)


def resolve_ca_path() -> Path | None:
    """Primera ruta de CA existente (nativo o Docker), o None si no hay."""
    for path in _CA_CANDIDATES:
        if path.exists():
            return path
    return None


def find_browser() -> str | None:
    """Ruta al primer navegador basado en Chromium disponible, o None."""
    for name in _BROWSER_CANDIDATES:
        path = shutil.which(name)
        if path:
            return path
    return None


def compute_spki(ca_path: Path) -> str | None:
    """SHA-256 (base64) del SubjectPublicKeyInfo del CA, para el pin de Chromium.

    Equivale a:
        openssl x509 -in CA -pubkey -noout |
        openssl pkey -pubin -outform der |
        openssl dgst -sha256 -binary | openssl base64
    Devuelve None si falta openssl o el cert (el llamador hace fallback).
    """
    if not ca_path.exists() or not shutil.which("openssl"):
        return None
    try:
        pub = subprocess.run(
            ["openssl", "x509", "-in", str(ca_path), "-pubkey", "-noout"],
            capture_output=True, check=True,
        ).stdout
        der = subprocess.run(
            ["openssl", "pkey", "-pubin", "-outform", "der"],
            input=pub, capture_output=True, check=True,
        ).stdout
        digest = subprocess.run(
            ["openssl", "dgst", "-sha256", "-binary"],
            input=der, capture_output=True, check=True,
        ).stdout
        b64 = subprocess.run(
            ["openssl", "base64"], input=digest, capture_output=True, check=True,
        ).stdout
        return b64.decode().strip()
    except (subprocess.CalledProcessError, OSError):
        return None


def launch_chromium(
    host: str, port: int, url: str = "about:blank",
) -> tuple[bool, str]:
    """Lanza Chromium apuntando al proxy host:port y confiando en el CA.

    Devuelve (ok, mensaje) para la barra de estado. No bloquea: el proceso se
    desprende (start_new_session) para que viva aparte de la GUI.
    """
    binary = find_browser()
    if binary is None:
        return False, (
            "No se encontró Chromium/Chrome. Instala chromium o google-chrome."
        )

    # Para 0.0.0.0 / :: (todas las interfaces) el navegador se conecta por loopback.
    connect_host = "127.0.0.1" if host in ("", "0.0.0.0", "::", "0.0.0.0/0") else host

    _PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    args = [
        binary,
        f"--proxy-server=http://{connect_host}:{port}",
        # No proxyees el tráfico interno del propio navegador (loopback).
        "--proxy-bypass-list=<-loopback>",
        f"--user-data-dir={_PROFILE_DIR}",
        "--no-first-run",
        "--no-default-browser-check",
    ]

    ca_path = resolve_ca_path()
    spki = compute_spki(ca_path) if ca_path else None
    if spki:
        args.append(f"--ignore-certificate-errors-spki-list={spki}")
        trust = "confiando en el CA de Blackwire"
    else:
        # Fallback: sin SPKI no podemos pinnear solo el CA de Blackwire.
        args.append("--ignore-certificate-errors")
        trust = "⚠ sin pin de CA (se ignoran TODOS los errores de cert)"

    args.append(url)

    try:
        subprocess.Popen(
            args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError as exc:
        return False, f"No se pudo lanzar el navegador: {exc}"

    return True, f"Navegador abierto en :{port} ({trust})"
