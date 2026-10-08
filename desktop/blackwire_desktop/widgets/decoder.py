"""Panel Decoder (Fase 5): Cipher (Chepy) + JWT.

- **Cipher**: construye una receta (cadena ordenada de operaciones) desde el
  catálogo `/api/chepy/operations` y la ejecuta con `/api/chepy/bake`.
- **JWT**: decodifica/recompone tokens en cliente (`jwt_tool`), sin firmar.
"""

from __future__ import annotations

import json
from typing import Any, Callable

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QComboBox,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QPlainTextEdit,
    QPushButton,
    QSplitter,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from .. import themes
from ..jwt_tool import decode_jwt, encode_jwt

Runner = Callable[[Callable[[], Any], Callable[[Any], None]], None]


def _mono() -> QPlainTextEdit:
    ed = QPlainTextEdit()
    ed.setFont(QFont(themes.MONO_FAMILY, 10))
    return ed


class DecoderPanel(QWidget):
    """Cipher + JWT en sub-pestañas."""

    def __init__(self, api, runner: Runner, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._api = api
        self._run = runner
        self._catalog: dict[str, list[dict[str, Any]]] = {}
        self._recipe: list[dict[str, Any]] = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        tabs = QTabWidget()
        tabs.addTab(self._build_cipher(), "Cipher")
        tabs.addTab(self._build_jwt(), "JWT")
        layout.addWidget(tabs)

    # ===================== Cipher ========================================== #
    def _build_cipher(self) -> QWidget:
        page = QWidget()
        lay = QVBoxLayout(page)

        pick = QHBoxLayout()
        self._cat = QComboBox()
        self._cat.currentIndexChanged.connect(self._on_cat)
        self._op = QComboBox()
        add_btn = QPushButton("Añadir op")
        add_btn.clicked.connect(self._add_op)
        pick.addWidget(QLabel("Categoría:"))
        pick.addWidget(self._cat)
        pick.addWidget(QLabel("Op:"))
        pick.addWidget(self._op, 1)
        pick.addWidget(add_btn)
        lay.addLayout(pick)

        split = QSplitter(Qt.Horizontal)

        left = QWidget()
        lleft = QVBoxLayout(left)
        lleft.setContentsMargins(0, 0, 0, 0)
        self._recipe_list = QListWidget()
        self._recipe_list.currentRowChanged.connect(self._on_recipe_sel)
        lleft.addWidget(QLabel("Receta"))
        lleft.addWidget(self._recipe_list, 1)
        recipe_btns = QHBoxLayout()
        up = QPushButton("▲"); up.clicked.connect(lambda: self._move(-1))
        down = QPushButton("▼"); down.clicked.connect(lambda: self._move(1))
        rm = QPushButton("Quitar"); rm.clicked.connect(self._remove_op)
        recipe_btns.addWidget(up); recipe_btns.addWidget(down)
        recipe_btns.addStretch(1); recipe_btns.addWidget(rm)
        lleft.addLayout(recipe_btns)
        self._args_form_host = QWidget()
        self._args_form = QFormLayout(self._args_form_host)
        lleft.addWidget(QLabel("Argumentos"))
        lleft.addWidget(self._args_form_host)
        split.addWidget(left)

        right = QWidget()
        lright = QVBoxLayout(right)
        lright.setContentsMargins(0, 0, 0, 0)
        lright.addWidget(QLabel("Input"))
        self._cipher_in = _mono()
        lright.addWidget(self._cipher_in, 1)
        bake = QPushButton("Bake")
        bake.setObjectName("AccentButton")
        bake.clicked.connect(self._bake)
        lright.addWidget(bake)
        lright.addWidget(QLabel("Output"))
        self._cipher_out = _mono()
        self._cipher_out.setReadOnly(True)
        lright.addWidget(self._cipher_out, 1)
        split.addWidget(right)
        split.setSizes([420, 640])
        lay.addWidget(split, 1)
        return page

    def load_operations(self) -> None:
        self._run(self._api.chepy_operations, self._on_catalog)

    def _on_catalog(self, catalog: dict[str, Any]) -> None:
        self._catalog = catalog if isinstance(catalog, dict) else {}
        self._cat.clear()
        self._cat.addItems(list(self._catalog.keys()))
        self._on_cat(0)

    def _on_cat(self, _index: int) -> None:
        self._op.clear()
        for op in self._catalog.get(self._cat.currentText(), []):
            self._op.addItem(op.get("label", op.get("name", "")), op)

    def _add_op(self) -> None:
        op = self._op.currentData()
        if not op:
            return
        params = op.get("params", []) or []
        args = {p["name"]: p.get("default", "") for p in params}
        entry = {"name": op["name"], "label": op.get("label", op["name"]),
                 "params": params, "args": args}
        self._recipe.append(entry)
        self._recipe_list.addItem(QListWidgetItem(entry["label"]))
        self._recipe_list.setCurrentRow(self._recipe_list.count() - 1)

    def _on_recipe_sel(self, row: int) -> None:
        while self._args_form.rowCount():
            self._args_form.removeRow(0)
        if not (0 <= row < len(self._recipe)):
            return
        entry = self._recipe[row]
        for p in entry["params"]:
            name = p["name"]
            if p.get("type") == "select":
                w = QComboBox()
                w.addItems([str(o) for o in p.get("options", [])])
                w.setCurrentText(str(entry["args"].get(name, p.get("default", ""))))
                w.currentTextChanged.connect(
                    lambda val, n=name, e=entry: e["args"].__setitem__(n, val))
            else:
                w = QLineEdit(str(entry["args"].get(name, p.get("default", ""))))
                w.textChanged.connect(
                    lambda val, n=name, e=entry: e["args"].__setitem__(n, val))
            self._args_form.addRow(p.get("label", name), w)

    def _move(self, delta: int) -> None:
        row = self._recipe_list.currentRow()
        new = row + delta
        if not (0 <= row < len(self._recipe) and 0 <= new < len(self._recipe)):
            return
        self._recipe[row], self._recipe[new] = self._recipe[new], self._recipe[row]
        item = self._recipe_list.takeItem(row)
        self._recipe_list.insertItem(new, item)
        self._recipe_list.setCurrentRow(new)

    def _remove_op(self) -> None:
        row = self._recipe_list.currentRow()
        if 0 <= row < len(self._recipe):
            self._recipe.pop(row)
            self._recipe_list.takeItem(row)

    def _bake(self) -> None:
        ops = [{"name": e["name"], "args": e["args"]} for e in self._recipe]
        text = self._cipher_in.toPlainText()
        self._cipher_out.setPlainText("Procesando…")
        self._run(lambda: self._api.chepy_bake(text, ops), self._on_baked)

    def _on_baked(self, result: dict[str, Any]) -> None:
        if result.get("error"):
            self._cipher_out.setPlainText(f"⚠ Error: {result['error']}")
        else:
            self._cipher_out.setPlainText(str(result.get("output", "")))

    # ===================== JWT ============================================= #
    def _build_jwt(self) -> QWidget:
        page = QWidget()
        lay = QVBoxLayout(page)

        lay.addWidget(QLabel("Token JWT"))
        self._jwt_token = _mono()
        self._jwt_token.setPlaceholderText("eyJhbGci...")
        lay.addWidget(self._jwt_token)

        btns = QHBoxLayout()
        decode_btn = QPushButton("Decodificar ▼")
        decode_btn.clicked.connect(self._jwt_decode)
        encode_btn = QPushButton("▲ Recomponer")
        encode_btn.clicked.connect(self._jwt_encode)
        self._jwt_info = QLabel("")
        btns.addWidget(decode_btn)
        btns.addWidget(encode_btn)
        btns.addStretch(1)
        btns.addWidget(self._jwt_info)
        lay.addLayout(btns)

        split = QSplitter(Qt.Horizontal)
        self._jwt_header = _mono()
        self._jwt_payload = _mono()
        hbox = QWidget(); hl = QVBoxLayout(hbox); hl.setContentsMargins(0, 0, 0, 0)
        hl.addWidget(QLabel("Header")); hl.addWidget(self._jwt_header)
        pbox = QWidget(); pl = QVBoxLayout(pbox); pl.setContentsMargins(0, 0, 0, 0)
        pl.addWidget(QLabel("Payload")); pl.addWidget(self._jwt_payload)
        split.addWidget(hbox); split.addWidget(pbox)
        lay.addWidget(split, 1)

        sig_row = QHBoxLayout()
        sig_row.addWidget(QLabel("Firma:"))
        self._jwt_sig = QLineEdit()
        sig_row.addWidget(self._jwt_sig, 1)
        lay.addLayout(sig_row)
        return page

    def _jwt_decode(self) -> None:
        decoded = decode_jwt(self._jwt_token.toPlainText().strip())
        if decoded is None:
            self._jwt_info.setText("⚠ token inválido")
            return
        self._jwt_header.setPlainText(json.dumps(decoded["header"], indent=2))
        self._jwt_payload.setPlainText(json.dumps(decoded["payload"], indent=2))
        self._jwt_sig.setText(decoded["signature"])
        header = decoded["header"] if isinstance(decoded["header"], dict) else {}
        alg = header.get("alg", "?")
        warn = "  ⚠ alg=none" if str(alg).lower() == "none" else ""
        payload = decoded["payload"] if isinstance(decoded["payload"], dict) else {}
        exp = payload.get("exp")
        exp_txt = ""
        if exp is not None:
            import time
            exp_txt = "  · EXPIRADO" if float(exp) < time.time() else "  · vigente"
        self._jwt_info.setText(f"alg={alg}{warn}{exp_txt}")

    def _jwt_encode(self) -> None:
        try:
            header = json.loads(self._jwt_header.toPlainText() or "{}")
            payload = json.loads(self._jwt_payload.toPlainText() or "{}")
        except (ValueError, TypeError):
            self._jwt_info.setText("⚠ header/payload no es JSON válido")
            return
        token = encode_jwt(header, payload, self._jwt_sig.text())
        self._jwt_token.setPlainText(token)
        self._jwt_info.setText("recompuesto (sin firmar)")
