"""Internacionalización ligera de la GUI nativa (en / es / pt).

Idioma fuente = **inglés**: las cadenas en el código se escriben en inglés y
`t("English source")` devuelve su traducción para el idioma activo, con *fallback*
a la propia cadena fuente si no hay entrada. Sin dependencias de Qt Linguist ni
archivos `.qm`: un único catálogo Python, portable y editable.

El cambio de idioma se persiste en `Settings` y se aplica reconstruyendo la UI
(reinicio): las cadenas se resuelven al construir cada widget, por lo que un
reinicio limpio es la vía fiable para re-traducir toda la ventana.
"""

from __future__ import annotations

# Idiomas ofrecidos (código -> etiqueta nativa mostrada en el menú).
LANGUAGES: dict[str, str] = {
    "en": "English",
    "es": "Español",
    "pt": "Português",
}
DEFAULT_LANG = "en"

# Catálogo por idioma, indexado por la cadena fuente en inglés.
# `en` es implícito (la fuente), así que solo definimos `es` y `pt`.
_CATALOG: dict[str, dict[str, str]] = {
    "es": {
        # -- Chrome / navegación --------------------------------------------- #
        "Blackwire — native": "Blackwire — nativo",
        "Projects": "Proyectos",
        "Scope": "Scope",
        "Proxy": "Proxy",
        "Collections": "Collections",
        "Repeater": "Repeater",
        "Intruder": "Intruder",
        "Tools": "Herramientas",
        "Traffic": "Tráfico",
        "Config": "Configuración",
        # -- Intercept (acciones) -------------------------------------------- #
        "Forward": "Reenviar",
        "Forward modified": "Reenviar modificado",
        "Drop": "Descartar",
        "Intercept its response": "Interceptar su respuesta",
        "Bulk actions": "Acciones en lote",
        "Forward all": "Reenviar todo",
        "Drop all": "Descartar todo",
        "Forward responses": "Reenviar respuestas",
        "Drop responses": "Descartar respuestas",
        "Proxy Bypass": "Proxy Bypass",
        "HTTP history": "Historial HTTP",
        "Intercept": "Intercept",
        "WS": "WS",
        "Console": "Consola",
        "Sensitive": "Sensitive",
        "Session": "Session",
        "Match && Replace": "Match && Replace",
        "Webhook.site": "Webhook.site",
        "Comparer": "Comparer",
        "Decoder": "Decoder",
        # -- Densidad -------------------------------------------------------- #
        "Compact": "Compacta",
        "Comfortable": "Cómoda",
        "Spacious": "Amplia",
        # -- Menús ----------------------------------------------------------- #
        "&File": "&Archivo",
        "&Tools": "&Herramientas",
        "&View": "&Ver",
        "&Help": "A&yuda",
        "New project…": "Nuevo proyecto…",
        "Switch project": "Cambiar de proyecto",
        "(no projects)": "(sin proyectos)",
        "Export project (JSON)…": "Exportar proyecto (JSON)…",
        "Export project (Burp XML)…": "Exportar proyecto (Burp XML)…",
        "Import Burp XML…": "Importar Burp XML…",
        "Start / Stop proxy": "Iniciar / Detener proxy",
        "Enable / Disable Intercept": "Activar / Desactivar Intercept",
        "Proxy settings…": "Configuración del proxy…",
        "Send current request to": "Enviar request actual a",
        "Sensitive Discovery": "Sensitive Discovery",
        "Navigate to": "Navegar a",
        "Theme": "Tema",
        "Density": "Densidad",
        "Language": "Idioma",
        "About Blackwire": "Acerca de Blackwire",
        "Documentation (Blackwire.wiki)": "Documentación (Blackwire.wiki)",
        "Keyboard shortcuts…": "Atajos de teclado…",
        # -- Comandos (paleta / atajos) -------------------------------------- #
        "Refresh history": "Refrescar historial",
        "Go to Projects": "Ir a Proyectos",
        "Command Palette…": "Paleta de comandos…",
        "Focus HTTPQL filter": "Enfocar filtro HTTPQL",
        "Intercept: toggle on/off": "Intercept: activar/desactivar",
        "Go to Proxy (HTTP history)": "Ir a Proxy (Historial HTTP)",
        "Go to Intercept": "Ir a Intercept",
        "Go to Repeater": "Ir a Repeater",
        "Go to Intruder": "Ir a Intruder",
        "Go to Collections": "Ir a Collections",
        "Go to Decoder (Cipher/JWT)": "Ir a Decoder (Cipher/JWT)",
        "Go to Sensitive": "Ir a Sensitive",
        "Go to WebSocket (Proxy)": "Ir a WebSocket (Proxy)",
        "Go to Session rules": "Ir a Session rules",
        "Go to Match & Replace": "Ir a Match & Replace",
        "Go to Webhook.site": "Ir a Webhook.site",
        "Go to Comparer": "Ir a Comparer",
        "Go to Scope": "Ir a Scope",
        "Go to Proxy Bypass": "Ir a Proxy Bypass",
        "Go to Console (proxy logs)": "Ir a Console (logs del proxy)",
        "Open browser with Blackwire CA": "Abrir navegador con el CA de Blackwire",
        "Add request to Collections": "Añadir request a Collections",
        "Send to Repeater": "Enviar al Repeater",
        "Repeater: save tab": "Repeater: guardar pestaña",
        "Send to Intruder": "Enviar al Intruder",
        "Comparer: set A = current request": "Comparer: fijar A = request actual",
        "Comparer: set B = current response": "Comparer: fijar B = respuesta actual",
        "Theme: next": "Tema: siguiente",
        "Save Proxy layout…": "Guardar layout del Proxy…",
        "Load Proxy layout…": "Cargar layout del Proxy…",
        "Reset Proxy layout": "Restablecer layout del Proxy",
        "Quit": "Salir",
        # -- Diálogos / estado ----------------------------------------------- #
        "Select a request in the history": "Selecciona un request en el historial",
        "No response": "Sin respuesta",
        "Searching…": "Buscando…",
        "Select a request first": "Selecciona un request primero",
        "Request ready: pick a collection and 'Add current request'":
            "Request listo: elige colección y 'Añadir request actual'",
        "URL copied to clipboard": "URL copiada al portapapeles",
        "cURL command copied to clipboard": "Comando cURL copiado al portapapeles",
        "Decoded ({kind}) copied to clipboard":
            "Decodificado ({kind}) copiado al portapapeles",
        "Select text to decode": "Selecciona texto para decodificar",
        "Could not decode: {err}": "No se pudo decodificar: {err}",
        "Favorite: {state}": "Favorito: {state}",
        "yes": "sí",
        "no": "no",
        "Save layout": "Guardar layout",
        "Layout name:": "Nombre del layout:",
        "Layout '{name}' saved": "Layout '{name}' guardado",
        "Load layout": "Cargar layout",
        "Layout:": "Layout:",
        "No saved layouts": "No hay layouts guardados",
        "Layout '{name}' loaded": "Layout '{name}' cargado",
        "Proxy layout reset": "Layout del Proxy restablecido",
        "Save preset": "Guardar preset",
        "Preset name:": "Nombre del preset:",
        "The filter is empty; nothing to save": "El filtro está vacío; nada que guardar",
        "Invalid HTTPQL: {err}": "HTTPQL inválido: {err}",
        "Theme: {name}": "Tema: {name}",
        "Density: {name}": "Densidad: {name}",
        "Language: {name}": "Idioma: {name}",
        "No active project": "No hay proyecto activo",
        "Exported to {path}": "Exportado a {path}",
        "Request saved: sqlmap -r {path}": "Request guardado: sqlmap -r {path}",
        "Imported {done}/{total} requests": "Importados {done}/{total} requests",
        "Error: {msg}": "Error: {msg}",
        "{n} requests": "{n} requests",
        "project: {name}": "proyecto: {name}",
        "live: —": "live: —",
        "live: connected": "live: conectado",
        "live: reconnecting…": "live: reconectando…",
        "Restart required": "Reinicio necesario",
        "The language changes after restarting Blackwire. Restart now?":
            "El idioma cambia tras reiniciar Blackwire. ¿Reiniciar ahora?",
        "Proxy interceptor HTTP/HTTPS for security testing.":
            "Proxy interceptor HTTP/HTTPS para pruebas de seguridad.",
        "Version": "Versión",
        "Starting backend…": "Iniciando el backend…",
        "Backend error": "Error del backend",
        "Could not start the backend:\n{err}": "No se pudo iniciar el backend:\n{err}",
        "The backend did not respond in time. Check the log:\n{log}":
            "El backend no respondió a tiempo. Revisa el log:\n{log}",
        # -- MCP (puerta para agentes de IA) --------------------------------- #
        "MCP: —": "MCP: —",
        "MCP: on": "MCP: activo",
        "MCP: off": "MCP: inactivo",
        "Enable": "Activar",
        "Disable": "Desactivar",
        "Copy config": "Copiar config",
        "Copy the MCP client config for Claude Desktop/Code":
            "Copiar la config del cliente MCP para Claude Desktop/Code",
        "Enabling MCP…": "Activando MCP…",
        "Disabling MCP…": "Desactivando MCP…",
        "MCP enabled": "MCP activado",
        "MCP disabled": "MCP desactivado",
        "MCP client config copied to clipboard":
            "Config del cliente MCP copiada al portapapeles",
        "MCP client config": "Config del cliente MCP",
        "Paste this into your AI client's MCP config, then enable the gate "
        "here. The server is launched by the client (stdio).":
            "Pega esto en la config MCP de tu cliente de IA y luego activa la "
            "puerta aquí. El servidor lo lanza el cliente (stdio).",
        "MCP activity": "Actividad MCP",
        "No MCP tool calls recorded yet.":
            "Aún no hay llamadas de herramientas MCP registradas.",
        "MCP (AI agents)": "MCP (agentes de IA)",
        "MCP: enable/disable gate": "MCP: activar/desactivar puerta",
        "MCP: copy client config": "MCP: copiar config del cliente",
        "MCP: show activity": "MCP: ver actividad",
    },
    "pt": {
        "Blackwire — native": "Blackwire — nativo",
        "Projects": "Projetos",
        "Scope": "Escopo",
        "Proxy": "Proxy",
        "Collections": "Coleções",
        "Repeater": "Repeater",
        "Intruder": "Intruder",
        "Tools": "Ferramentas",
        "Traffic": "Tráfego",
        "Config": "Configuração",
        # -- Intercept (ações) ----------------------------------------------- #
        "Forward": "Reencaminhar",
        "Forward modified": "Reencaminhar modificado",
        "Drop": "Descartar",
        "Intercept its response": "Intercetar a resposta",
        "Bulk actions": "Ações em lote",
        "Forward all": "Reencaminhar tudo",
        "Drop all": "Descartar tudo",
        "Forward responses": "Reencaminhar respostas",
        "Drop responses": "Descartar respostas",
        "Proxy Bypass": "Proxy Bypass",
        "HTTP history": "Histórico HTTP",
        "Intercept": "Intercept",
        "WS": "WS",
        "Console": "Console",
        "Sensitive": "Sensitive",
        "Session": "Sessão",
        "Match && Replace": "Match && Replace",
        "Webhook.site": "Webhook.site",
        "Comparer": "Comparer",
        "Decoder": "Decoder",
        "Compact": "Compacta",
        "Comfortable": "Confortável",
        "Spacious": "Ampla",
        "&File": "&Arquivo",
        "&Tools": "&Ferramentas",
        "&View": "&Exibir",
        "&Help": "Aj&uda",
        "New project…": "Novo projeto…",
        "Switch project": "Trocar de projeto",
        "(no projects)": "(sem projetos)",
        "Export project (JSON)…": "Exportar projeto (JSON)…",
        "Export project (Burp XML)…": "Exportar projeto (Burp XML)…",
        "Import Burp XML…": "Importar Burp XML…",
        "Start / Stop proxy": "Iniciar / Parar proxy",
        "Enable / Disable Intercept": "Ativar / Desativar Intercept",
        "Proxy settings…": "Configuração do proxy…",
        "Send current request to": "Enviar request atual para",
        "Sensitive Discovery": "Sensitive Discovery",
        "Navigate to": "Navegar para",
        "Theme": "Tema",
        "Density": "Densidade",
        "Language": "Idioma",
        "About Blackwire": "Sobre o Blackwire",
        "Documentation (Blackwire.wiki)": "Documentação (Blackwire.wiki)",
        "Keyboard shortcuts…": "Atalhos de teclado…",
        "Refresh history": "Atualizar histórico",
        "Go to Projects": "Ir para Projetos",
        "Command Palette…": "Paleta de comandos…",
        "Focus HTTPQL filter": "Focar filtro HTTPQL",
        "Intercept: toggle on/off": "Intercept: ativar/desativar",
        "Go to Proxy (HTTP history)": "Ir para Proxy (Histórico HTTP)",
        "Go to Intercept": "Ir para Intercept",
        "Go to Repeater": "Ir para Repeater",
        "Go to Intruder": "Ir para Intruder",
        "Go to Collections": "Ir para Coleções",
        "Go to Decoder (Cipher/JWT)": "Ir para Decoder (Cipher/JWT)",
        "Go to Sensitive": "Ir para Sensitive",
        "Go to WebSocket (Proxy)": "Ir para WebSocket (Proxy)",
        "Go to Session rules": "Ir para regras de Sessão",
        "Go to Match & Replace": "Ir para Match & Replace",
        "Go to Webhook.site": "Ir para Webhook.site",
        "Go to Comparer": "Ir para Comparer",
        "Go to Scope": "Ir para Escopo",
        "Go to Proxy Bypass": "Ir para Proxy Bypass",
        "Go to Console (proxy logs)": "Ir para Console (logs do proxy)",
        "Open browser with Blackwire CA": "Abrir navegador com o CA do Blackwire",
        "Add request to Collections": "Adicionar request às Coleções",
        "Send to Repeater": "Enviar para o Repeater",
        "Repeater: save tab": "Repeater: salvar aba",
        "Send to Intruder": "Enviar para o Intruder",
        "Comparer: set A = current request": "Comparer: definir A = request atual",
        "Comparer: set B = current response": "Comparer: definir B = resposta atual",
        "Theme: next": "Tema: próximo",
        "Save Proxy layout…": "Salvar layout do Proxy…",
        "Load Proxy layout…": "Carregar layout do Proxy…",
        "Reset Proxy layout": "Redefinir layout do Proxy",
        "Quit": "Sair",
        "Select a request in the history": "Selecione um request no histórico",
        "No response": "Sem resposta",
        "Searching…": "Buscando…",
        "Select a request first": "Selecione um request primeiro",
        "Request ready: pick a collection and 'Add current request'":
            "Request pronto: escolha uma coleção e 'Adicionar request atual'",
        "URL copied to clipboard": "URL copiada para a área de transferência",
        "cURL command copied to clipboard":
            "Comando cURL copiado para a área de transferência",
        "Decoded ({kind}) copied to clipboard":
            "Decodificado ({kind}) copiado para a área de transferência",
        "Select text to decode": "Selecione o texto para decodificar",
        "Could not decode: {err}": "Não foi possível decodificar: {err}",
        "Favorite: {state}": "Favorito: {state}",
        "yes": "sim",
        "no": "não",
        "Save layout": "Salvar layout",
        "Layout name:": "Nome do layout:",
        "Layout '{name}' saved": "Layout '{name}' salvo",
        "Load layout": "Carregar layout",
        "Layout:": "Layout:",
        "No saved layouts": "Nenhum layout salvo",
        "Layout '{name}' loaded": "Layout '{name}' carregado",
        "Proxy layout reset": "Layout do Proxy redefinido",
        "Save preset": "Salvar preset",
        "Preset name:": "Nome do preset:",
        "The filter is empty; nothing to save": "O filtro está vazio; nada a salvar",
        "Invalid HTTPQL: {err}": "HTTPQL inválido: {err}",
        "Theme: {name}": "Tema: {name}",
        "Density: {name}": "Densidade: {name}",
        "Language: {name}": "Idioma: {name}",
        "No active project": "Nenhum projeto ativo",
        "Exported to {path}": "Exportado para {path}",
        "Request saved: sqlmap -r {path}": "Request salvo: sqlmap -r {path}",
        "Imported {done}/{total} requests": "Importados {done}/{total} requests",
        "Error: {msg}": "Erro: {msg}",
        "{n} requests": "{n} requests",
        "project: {name}": "projeto: {name}",
        "live: —": "live: —",
        "live: connected": "live: conectado",
        "live: reconnecting…": "live: reconectando…",
        "Restart required": "Reinício necessário",
        "The language changes after restarting Blackwire. Restart now?":
            "O idioma muda após reiniciar o Blackwire. Reiniciar agora?",
        "Proxy interceptor HTTP/HTTPS for security testing.":
            "Proxy interceptor HTTP/HTTPS para testes de segurança.",
        "Version": "Versão",
        "Starting backend…": "Iniciando o backend…",
        "Backend error": "Erro do backend",
        "Could not start the backend:\n{err}": "Não foi possível iniciar o backend:\n{err}",
        "The backend did not respond in time. Check the log:\n{log}":
            "O backend não respondeu a tempo. Verifique o log:\n{log}",
        # -- MCP (porta para agentes de IA) ---------------------------------- #
        "MCP: —": "MCP: —",
        "MCP: on": "MCP: ativo",
        "MCP: off": "MCP: inativo",
        "Enable": "Ativar",
        "Disable": "Desativar",
        "Copy config": "Copiar config",
        "Copy the MCP client config for Claude Desktop/Code":
            "Copiar a config do cliente MCP para Claude Desktop/Code",
        "Enabling MCP…": "Ativando MCP…",
        "Disabling MCP…": "Desativando MCP…",
        "MCP enabled": "MCP ativado",
        "MCP disabled": "MCP desativado",
        "MCP client config copied to clipboard":
            "Config do cliente MCP copiada para a área de transferência",
        "MCP client config": "Config do cliente MCP",
        "Paste this into your AI client's MCP config, then enable the gate "
        "here. The server is launched by the client (stdio).":
            "Cole isto na config MCP do seu cliente de IA e depois ative a "
            "porta aqui. O servidor é iniciado pelo cliente (stdio).",
        "MCP activity": "Atividade MCP",
        "No MCP tool calls recorded yet.":
            "Ainda não há chamadas de ferramentas MCP registradas.",
        "MCP (AI agents)": "MCP (agentes de IA)",
        "MCP: enable/disable gate": "MCP: ativar/desativar porta",
        "MCP: copy client config": "MCP: copiar config do cliente",
        "MCP: show activity": "MCP: ver atividade",
    },
}

_current = DEFAULT_LANG


def set_language(lang: str) -> None:
    """Fija el idioma activo (ignora códigos desconocidos)."""
    global _current
    if lang in LANGUAGES:
        _current = lang


def current_language() -> str:
    return _current


def t(source: str, /, **kwargs: object) -> str:
    """Traduce `source` (inglés) al idioma activo; *fallback* a `source`.

    Acepta placeholders `str.format` (p. ej. `t("{n} requests", n=5)`).
    """
    text = _CATALOG.get(_current, {}).get(source, source)
    return text.format(**kwargs) if kwargs else text
