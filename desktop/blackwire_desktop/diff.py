"""Diff por líneas (LCS) para el Comparer (Fase 3).

Puerto 1:1 de `frontend/src/utils/parsing.js:diffLines`. Devuelve una lista de
entradas alineadas con tipo `equal` / `added` / `removed`. Para textos muy grandes
(>5000 líneas en cualquiera de los dos lados) cae a una comparación posicional
barata, igual que la web.
"""

from __future__ import annotations

from typing import Any

_LARGE = 5000


def diff_lines(text_a: str | None, text_b: str | None) -> list[dict[str, Any]]:
    """Alinea `text_a` y `text_b` por líneas vía LCS. Entradas:
    {"type": "equal"|"added"|"removed", "lineA": str|None, "lineB": str|None}."""
    a = (text_a or "").split("\n")
    b = (text_b or "").split("\n")
    m, n = len(a), len(b)

    # Fallback posicional para textos enormes (evita la matriz DP O(m*n)).
    if m > _LARGE or n > _LARGE:
        result: list[dict[str, Any]] = []
        for i in range(max(m, n)):
            la = a[i] if i < m else None
            lb = b[i] if i < n else None
            if la == lb:
                result.append({"type": "equal", "lineA": la, "lineB": lb})
            else:
                if la is not None:
                    result.append({"type": "removed", "lineA": la, "lineB": None})
                if lb is not None:
                    result.append({"type": "added", "lineA": None, "lineB": lb})
        return result

    # Matriz de longitudes de LCS.
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        row = dp[i]
        prev = dp[i - 1]
        ai = a[i - 1]
        for j in range(1, n + 1):
            if ai == b[j - 1]:
                row[j] = prev[j - 1] + 1
            else:
                row[j] = prev[j] if prev[j] >= row[j - 1] else row[j - 1]

    # Backtrack para reconstruir la alineación.
    result = []
    i, j = m, n
    while i > 0 or j > 0:
        if i > 0 and j > 0 and a[i - 1] == b[j - 1]:
            result.append({"type": "equal", "lineA": a[i - 1], "lineB": b[j - 1]})
            i -= 1
            j -= 1
        elif j > 0 and (i == 0 or dp[i][j - 1] >= dp[i - 1][j]):
            j -= 1
            result.append({"type": "added", "lineA": None, "lineB": b[j]})
        else:
            i -= 1
            result.append({"type": "removed", "lineA": a[i], "lineB": None})
    result.reverse()
    return result
