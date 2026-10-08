"""Cliente WebSocket para historial en vivo (Fase 1).

El backend emite por `ws://host/ws` mensajes JSON del tipo
`{"type": "new_request", "data": {id, method, url, response_status, ...}}`.
`QtWebSockets` no está disponible en este entorno (falta la lib nativa), así que
se usa `websocket-client` en un QThread y se reemiten los eventos a la UI con
señales Qt (seguro entre hilos: Qt hace cola de los slots en el hilo receptor).
"""

from __future__ import annotations

import json
from typing import Any

import websocket  # websocket-client
from PySide6.QtCore import QObject, QThread, Signal


def ws_url_from_base(base_url: str) -> str:
    """Deriva la URL ws:// o wss:// del endpoint /ws desde la base HTTP."""
    url = base_url.rstrip("/")
    if url.startswith("https://"):
        return "wss://" + url[len("https://"):] + "/ws"
    if url.startswith("http://"):
        return "ws://" + url[len("http://"):] + "/ws"
    return "ws://" + url + "/ws"


class LiveHistoryClient(QObject):
    """Escucha `/ws` en un hilo y reemite eventos a la UI.

    Señales:
        new_request(dict): llegó un request nuevo (payload de `data`).
        event(str, dict):  cualquier otro mensaje (type, data) para el resto de UI.
        connected():       la conexión WS se estableció.
        disconnected(str): la conexión se cerró/falló (motivo).
    """

    new_request = Signal(dict)
    event = Signal(str, dict)  # (type, mensaje completo) — incluye claves de nivel 0
    connected = Signal()
    disconnected = Signal(str)

    def __init__(self, base_url: str, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self._url = ws_url_from_base(base_url)
        self._thread: QThread | None = None
        self._worker: _WsWorker | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = QThread()
        self._worker = _WsWorker(self._url)
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        # Reemitir desde el worker (hilo WS) hacia esta fachada (hilo UI).
        self._worker.new_request.connect(self.new_request)
        self._worker.event.connect(self.event)
        self._worker.connected.connect(self.connected)
        self._worker.disconnected.connect(self.disconnected)
        self._thread.start()

    def stop(self) -> None:
        if self._worker is not None:
            self._worker.stop()
        if self._thread is not None:
            self._thread.quit()
            self._thread.wait(2000)
            self._thread = None
            self._worker = None


class _WsWorker(QObject):
    """Corre el loop de `websocket-client` con reconexión en el hilo WS."""

    new_request = Signal(dict)
    event = Signal(str, dict)
    connected = Signal()
    disconnected = Signal(str)

    def __init__(self, url: str) -> None:
        super().__init__()
        self._url = url
        self._running = True
        self._app: websocket.WebSocketApp | None = None

    def run(self) -> None:
        # run_forever con reconexión manual mientras no nos pidan parar.
        while self._running:
            self._app = websocket.WebSocketApp(
                self._url,
                on_open=self._on_open,
                on_message=self._on_message,
                on_error=self._on_error,
                on_close=self._on_close,
            )
            try:
                # reconnect=0 => no reintenta solo; el while de arriba reintenta.
                self._app.run_forever(ping_interval=20, ping_timeout=10)
            except Exception as exc:  # noqa: BLE001 - reportar y reintentar
                self.disconnected.emit(str(exc))
            if not self._running:
                break
            # Pausa breve antes de reintentar sin bloquear el apagado.
            QThread.msleep(1500)

    def stop(self) -> None:
        self._running = False
        if self._app is not None:
            try:
                self._app.close()
            except Exception:  # noqa: BLE001 - cierre best-effort
                pass

    # -- callbacks de websocket-client (en el hilo WS) ---------------------- #
    def _on_open(self, _ws: Any) -> None:
        self.connected.emit()

    def _on_message(self, _ws: Any, message: str) -> None:
        try:
            msg = json.loads(message)
        except (ValueError, TypeError):
            return
        if not isinstance(msg, dict):
            return
        mtype = msg.get("type", "")
        data = msg.get("data")
        if mtype == "new_request" and isinstance(data, dict):
            self.new_request.emit(data)
        # Reemitir el mensaje completo: los eventos de intercept llevan claves de
        # nivel superior (enabled, request_id) fuera de `data`.
        self.event.emit(mtype, msg)

    def _on_error(self, _ws: Any, error: Any) -> None:
        self.disconnected.emit(str(error))

    def _on_close(self, _ws: Any, _code: Any, _reason: Any) -> None:
        self.disconnected.emit("cerrada")
