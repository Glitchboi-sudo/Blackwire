"""Arranque del backend en **Docker** gestionado por la GUI (modo empaquetado).

En el modelo de distribución, la GUI nativa corre en el HOST y el backend
(FastAPI + mitmproxy) corre en un contenedor Docker — misma defensa en profundidad
que el viejo shell Tauri, que era quien gestionaba el ciclo de vida del contenedor.
Este módulo porta esa lógica a Python para que la app nativa sea autosuficiente:

  1. comprueba que Docker esté disponible,
  2. crea los directorios del host que el compose bind-montará,
  3. carga la imagen `blackwire:latest` desde el tarball incluido si falta,
  4. elimina un contenedor viejo y hace `docker compose up -d`,
  5. espera a que el backend responda.

Expone la MISMA interfaz que `backend_server.BackendServer`
(`start()`, `wait_ready()`, `stop()`, `started_here`, `log_path`) para que
`main.ensure_backend()` pueda usar cualquiera de los dos de forma intercambiable
(ver `make_backend_runtime`).

En desarrollo el backend corre en el host (uvicorn directo), así que el modo por
defecto es `host`; el modo `docker` se activa en el binario empaquetado
(PyInstaller, `sys.frozen`) o forzando `BLACKWIRE_BACKEND_MODE=docker`.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable, List, Optional

CONTAINER_NAME = "blackwire"
IMAGE_NAME = "blackwire:latest"
IMAGE_TARBALL = "blackwire-image.tar.gz"
# Nombres de compose aceptados (el empaquetado copia el runtime como el primero).
_COMPOSE_NAMES = ("docker-compose.yml", "docker-compose.runtime.yml")


class DockerError(RuntimeError):
    """No se pudo gestionar el contenedor del backend."""


def _run(args: List[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, **kwargs)


def _compose_prefix() -> List[str]:
    """`docker compose` (plugin v2) si existe; si no, `docker-compose` (v1)."""
    try:
        v2 = _run(["docker", "compose", "version"])
        if v2.returncode == 0:
            return ["docker", "compose"]
    except OSError:
        pass
    return ["docker-compose"]


def _resource_dir() -> Optional[Path]:
    """Directorio que contiene el compose (+ el tarball de la imagen).

    Busca junto al ejecutable empaquetado, en `sys._MEIPASS` (PyInstaller),
    en `packaging/` del repo (desarrollo) y en el cwd.
    """
    candidates: List[Path] = []
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        candidates.append(exe_dir)
        # macOS .app: el ejecutable vive en Contents/MacOS/; los recursos
        # empaquetados (compose + tarball) van en Contents/Resources/.
        candidates.append(exe_dir.parent / "Resources")
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidates.append(Path(meipass))
    # .../desktop/blackwire_desktop/docker_runtime.py -> parents[2] = repo raíz.
    candidates.append(Path(__file__).resolve().parents[2] / "packaging")
    candidates.append(Path.cwd())
    for base in candidates:
        for name in _COMPOSE_NAMES:
            if (base / name).exists():
                return base
    return None


def _compose_file(resource_dir: Path) -> Path:
    for name in _COMPOSE_NAMES:
        path = resource_dir / name
        if path.exists():
            return path
    raise DockerError(f"compose file not found in {resource_dir}")


def _host_base() -> Path:
    return Path(os.environ.get("HOME", "~")).expanduser() / "Blackwire"


class DockerRuntime:
    """Gestiona el ciclo de vida del contenedor `blackwire` del backend."""

    def __init__(self, base_url: str) -> None:
        self._base_url = base_url
        self._started_here = False
        self._resource_dir = _resource_dir()
        # Mensaje de ayuda mostrado si el backend no arranca (análogo a log_path).
        self.log_path = f"docker logs {CONTAINER_NAME}"

    @property
    def started_here(self) -> bool:
        return self._started_here

    # -- helpers ------------------------------------------------------------ #
    @staticmethod
    def docker_available() -> bool:
        try:
            return _run(["docker", "ps"]).returncode == 0
        except OSError:
            return False

    def _container_running(self) -> bool:
        try:
            out = _run(["docker", "ps", "-q", "-f", f"name={CONTAINER_NAME}"])
            return bool(out.stdout.strip())
        except OSError:
            return False

    @staticmethod
    def _image_exists() -> bool:
        try:
            return bool(_run(["docker", "images", "-q", IMAGE_NAME]).stdout.strip())
        except OSError:
            return False

    def _ensure_host_dirs(self) -> None:
        base = _host_base()
        for rel in ("certs", "data/projects", "extensions"):
            (base / rel).mkdir(parents=True, exist_ok=True)

    def _load_image(self) -> None:
        if self._resource_dir is None:
            raise DockerError("resource directory with the image tarball not found")
        tarball = self._resource_dir / IMAGE_TARBALL
        if not tarball.exists():
            raise DockerError(f"bundled image not found at {tarball}")
        result = _run(["docker", "load", "-i", str(tarball)])
        if result.returncode != 0:
            raise DockerError(f"docker load failed: {result.stderr.strip()[:300]}")

    # -- interfaz tipo BackendServer ---------------------------------------- #
    def start(self) -> None:
        """Levanta el contenedor del backend (idempotente si ya corre)."""
        if not self.docker_available():
            raise DockerError(
                "Docker is not running. Start Docker Desktop and try again.")
        if self._container_running():
            return
        if self._resource_dir is None:
            raise DockerError(
                "docker-compose file not found next to the app (corrupt install?).")
        self._ensure_host_dirs()
        if not self._image_exists():
            self._load_image()
        # Eliminar un contenedor homónimo detenido para evitar conflicto de nombre.
        _run(["docker", "rm", "-f", CONTAINER_NAME])
        compose_file = _compose_file(self._resource_dir)
        up = _run([*_compose_prefix(), "-f", str(compose_file), "up", "-d"],
                  cwd=str(self._resource_dir))
        if up.returncode != 0:
            raise DockerError(f"docker compose up failed: {up.stderr.strip()[:300]}")
        self._started_here = True

    def wait_ready(
        self, ping: Callable[[], bool], timeout: float = 60.0,
        on_tick: Optional[Callable[[], None]] = None,
    ) -> bool:
        """Sondea `ping()` hasta que el backend responda o venza el timeout.

        Timeout por defecto más alto que en host: el contenedor tarda más en
        arrancar (sobre todo en el primer `docker load`)."""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if ping():
                return True
            if on_tick is not None:
                on_tick()
            time.sleep(0.5)
        return False

    def stop(self) -> None:
        """Detiene el contenedor solo si lo arrancamos nosotros."""
        if not self._started_here or self._resource_dir is None:
            return
        try:
            compose_file = _compose_file(self._resource_dir)
        except DockerError:
            return
        _run([*_compose_prefix(), "-f", str(compose_file), "down"],
             cwd=str(self._resource_dir))
        self._started_here = False


def _backend_mode() -> str:
    """'host' (uvicorn local) o 'docker' (contenedor). Default: auto por `frozen`."""
    mode = os.environ.get("BLACKWIRE_BACKEND_MODE", "auto").strip().lower()
    if mode in ("host", "docker"):
        return mode
    return "docker" if getattr(sys, "frozen", False) else "host"


def make_backend_runtime(base_url: str):
    """Devuelve el gestor de backend adecuado al modo (host vs docker).

    Mismo contrato que `BackendServer`: `start/wait_ready/stop/started_here/
    log_path`. En `host` reutiliza `BackendServer` (uvicorn); en `docker` usa
    `DockerRuntime`.
    """
    if _backend_mode() == "docker":
        return DockerRuntime(base_url)
    from .backend_server import BackendServer
    return BackendServer(base_url)
