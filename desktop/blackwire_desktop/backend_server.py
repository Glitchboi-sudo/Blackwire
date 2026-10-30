"""Arranque del backend (FastAPI/uvicorn) como subproceso de la GUI.

La app de escritorio necesita el backend en `:5000` para cualquier petición. Este
módulo lo lanza al iniciar **si no está ya corriendo** (idempotente: si alguien ya
tiene el backend arriba, lo reutiliza y no abre un segundo proceso), espera a que
responda y lo detiene al cerrar — pero solo si *nosotros* lo arrancamos.

Equivale a `make start` (uvicorn main:app) pero gestionado por la ventana nativa.
El directorio del backend se resuelve relativo al repo; se puede forzar con la
variable de entorno `BLACKWIRE_BACKEND_DIR`.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse


class BackendError(RuntimeError):
    """El backend no se pudo localizar o arrancar."""


def _backend_dir() -> Path:
    """Localiza `backend/` (con `main.py`) relativo al paquete o por env var."""
    override = os.environ.get("BLACKWIRE_BACKEND_DIR")
    if override:
        return Path(override).expanduser().resolve()
    # .../Blackwire/desktop/blackwire_desktop/backend_server.py -> parents[2] = Blackwire
    return Path(__file__).resolve().parents[2] / "backend"


def _python_exe(repo_root: Path) -> str:
    """Intérprete para el backend: venv del repo (como `make`), si no sys.executable.

    La GUI puede correr con un Python distinto al del backend (p. ej. PySide6 en el
    sistema y FastAPI en `venv/`). Preferimos el venv para que uvicorn tenga deps.
    """
    override = os.environ.get("BLACKWIRE_PY")
    if override:
        return override
    rel = "Scripts/python.exe" if os.name == "nt" else "bin/python"
    cand = repo_root / "venv" / rel
    return str(cand) if cand.exists() else sys.executable


class BackendServer:
    """Gestiona el ciclo de vida del subproceso uvicorn del backend."""

    def __init__(self, base_url: str) -> None:
        parsed = urlparse(base_url)
        self._host = parsed.hostname or "127.0.0.1"
        self._port = parsed.port or 5000
        self._proc: subprocess.Popen | None = None
        self._dir = _backend_dir()
        self._python = _python_exe(self._dir.parent)
        self.log_path = self._dir.parent / ".run" / "server.log"

    @property
    def started_here(self) -> bool:
        """True si este objeto arrancó el backend (y por tanto debe detenerlo)."""
        return self._proc is not None

    def start(self) -> None:
        """Lanza `uvicorn main:app` en segundo plano. Idempotente por diseño:
        el llamador debe comprobar `ping()` antes y omitir si ya responde."""
        if self._proc is not None:
            return
        if not (self._dir / "main.py").exists():
            raise BackendError(
                f"No se encontró el backend en {self._dir} "
                f"(define BLACKWIRE_BACKEND_DIR si está en otra ruta)."
            )
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            self._python, "-m", "uvicorn", "main:app",
            "--host", self._host, "--port", str(self._port),
        ]
        # Grupo de proceso propio (POSIX) para poder matar limpio al cerrar.
        kwargs: dict = {"cwd": str(self._dir)}
        if os.name == "posix":
            kwargs["start_new_session"] = True
        try:
            log = open(self.log_path, "ab")
            self._proc = subprocess.Popen(
                cmd, stdout=log, stderr=subprocess.STDOUT, **kwargs
            )
        except OSError as exc:
            raise BackendError(f"No se pudo arrancar uvicorn: {exc}") from exc

    def wait_ready(
        self, ping: Callable[[], bool], timeout: float = 30.0,
        on_tick: Callable[[], None] | None = None,
    ) -> bool:
        """Sondea `ping()` hasta que el backend responda o venza el timeout.

        `on_tick` se invoca en cada iteración (p. ej. `QApplication.processEvents`
        para no congelar la UI mientras se espera).
        """
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            # Si el proceso que arrancamos murió, no tiene sentido seguir esperando.
            if self._proc is not None and self._proc.poll() is not None:
                return False
            if ping():
                return True
            if on_tick is not None:
                on_tick()
            time.sleep(0.25)
        return False

    def stop(self) -> None:
        """Detiene el backend solo si lo arrancamos nosotros."""
        if self._proc is None:
            return
        proc, self._proc = self._proc, None
        if proc.poll() is not None:
            return
        try:
            if os.name == "posix":
                import signal
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            else:
                proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        except (ProcessLookupError, PermissionError, OSError):
            pass
