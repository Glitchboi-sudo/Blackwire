"""Persistencia de preferencias de la GUI nativa (Fase 1).

Wrapper fino sobre `QSettings` (archivo INI propio, portable) para recordar entre
sesiones: tema, densidad, URL del backend, geometría de la ventana, layout de los
docks (`saveState`/`restoreState`) y atajos reconfigurados.
"""

from __future__ import annotations

from typing import Any

from PySide6.QtCore import QByteArray, QSettings

from . import themes

ORG = "Blackwire"
APP = "BlackwireDesktop"


class Settings:
    """Lee/escribe preferencias con claves tipadas y valores por defecto."""

    def __init__(self) -> None:
        # IniFormat + UserScope: archivo legible y portable, no el registro.
        self._s = QSettings(QSettings.IniFormat, QSettings.UserScope, ORG, APP)

    # -- preferencias simples ----------------------------------------------- #
    @property
    def theme(self) -> str:
        value = self._s.value("ui/theme", themes.DEFAULT_THEME, type=str)
        return value if value in themes.THEMES else themes.DEFAULT_THEME

    @theme.setter
    def theme(self, key: str) -> None:
        self._s.setValue("ui/theme", key)

    @property
    def density(self) -> str:
        value = self._s.value("ui/density", themes.DEFAULT_DENSITY, type=str)
        return value if value in themes.DENSITIES else themes.DEFAULT_DENSITY

    @density.setter
    def density(self, key: str) -> None:
        self._s.setValue("ui/density", key)

    @property
    def base_url(self) -> str:
        return self._s.value("api/base_url", "http://127.0.0.1:5000", type=str)

    @base_url.setter
    def base_url(self, url: str) -> None:
        self._s.setValue("api/base_url", url)

    @property
    def last_tool(self) -> int:
        """Índice de la última herramienta (pestaña) activa."""
        return self._s.value("ui/last_tool", 0, type=int)

    @last_tool.setter
    def last_tool(self, index: int) -> None:
        self._s.setValue("ui/last_tool", index)

    # -- estado de ventana / layout de docks -------------------------------- #
    @property
    def geometry(self) -> QByteArray | None:
        value = self._s.value("win/geometry")
        return value if isinstance(value, QByteArray) and not value.isEmpty() else None

    @geometry.setter
    def geometry(self, data: QByteArray) -> None:
        self._s.setValue("win/geometry", data)

    @property
    def window_state(self) -> QByteArray | None:
        # Clave versionada (v3): el estado guardado es el del QMainWindow anidado de
        # la sub-pestaña "HTTP history" (Intercept pasó a ser otra sub-pestaña).
        value = self._s.value("win/proxy_state_v3")
        return value if isinstance(value, QByteArray) and not value.isEmpty() else None

    @window_state.setter
    def window_state(self, data: QByteArray) -> None:
        self._s.setValue("win/proxy_state_v3", data)

    # -- atajos reconfigurables (id de comando -> secuencia) ---------------- #
    def shortcut(self, command_id: str, default: str) -> str:
        return self._s.value(f"keys/{command_id}", default, type=str)

    def set_shortcut(self, command_id: str, sequence: str) -> None:
        self._s.setValue(f"keys/{command_id}", sequence)

    # -- layouts con nombre (guardar/restaurar disposición de docks) -------- #
    def save_named_layout(self, name: str, state: QByteArray) -> None:
        self._s.setValue(f"layouts/{name}", state)

    def named_layout(self, name: str) -> QByteArray | None:
        value = self._s.value(f"layouts/{name}")
        return value if isinstance(value, QByteArray) and not value.isEmpty() else None

    def layout_names(self) -> list[str]:
        self._s.beginGroup("layouts")
        names = self._s.childKeys()
        self._s.endGroup()
        return sorted(names)

    # -- utilidades --------------------------------------------------------- #
    def sync(self) -> None:
        self._s.sync()

    def raw(self, key: str, default: Any = None) -> Any:
        return self._s.value(key, default)
