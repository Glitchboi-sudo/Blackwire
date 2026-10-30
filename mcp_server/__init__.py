"""Blackwire MCP server — expone las herramientas de Blackwire por MCP (stdio).

Paquete independiente del backend y de la GUI (sin PySide6): un proceso que el
cliente de IA (Claude Desktop/Code, …) lanza por stdio y que habla con la API
REST de Blackwire en localhost. Ver `server.py` para las herramientas y
`rest.py` para el cliente HTTP.
"""

__all__ = ["server", "rest"]
