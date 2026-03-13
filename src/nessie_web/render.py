"""
nessie_explorer.render
======================
Jedina javna funkcija: ``render(adapter) -> str``.
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader

from nessie_api.protocols import Context

_STATIC = Path(__file__).parent / "_static"

_CSS_FILES = [
    "css/global.css",
    "css/toolbar.css",
    "css/wsbar.css",
    "css/layout.css",
    "css/tree-view.css",
    "css/main-view.css",
    "css/bottom.css",
    "css/right-sidebar.css",
    "css/statusbar.css",
]

_JS_FILES = [
    "js/resize.js",
    "js/settings.js",
    "js/properties.js",
    "js/filters.js",
    "js/console.js",
    "js/tree-view.js",
    "js/birdview.js",
    "js/graph.js",
    "js/main.js",
]


def _read_files(file_list: list[str]) -> str:
    parts = []
    for rel in file_list:
        path = _STATIC / rel
        parts.append(f"/* \u2500\u2500 {rel} \u2500\u2500 */\n")
        parts.append(path.read_text(encoding="utf-8"))
        parts.append("\n")
    return "\n".join(parts)


def render(adapter: Context) -> str:
    """
    Renderuje Nessie Graph Explorer u jedan samodovoljan HTML string.

    Plugin HTML se injektuje server-side direktno u DOM (ne kroz JS innerHTML)
    kako bi se osiguralo da se <script> tagovi unutar plugin HTML-a izvrse.
    """
    count        = adapter.get_workspace_count()
    raw_index    = adapter.get_active_workspace_index()
    active_index = max(0, min(raw_index, count - 1)) if raw_index is not None else None

    workspaces_js:   list[dict[str, Any]] = []
    workspaces_html: list[dict[str, Any]] = []

    for i in range(count):
        graph      = adapter.get_graph_at(i)
        graph_dict = graph.to_dict()
        name       = graph_dict.get("name") or f"workspace_{i + 1}"
        ws_id      = f"ws-{name.replace(' ', '-')}"
        is_active  = (active_index is not None and i == active_index)

        # Serialize active filters via FilterExpression.to_json()
        try:
            raw_filters = adapter.get_active_filters_at(i)
            active_filters = [f.to_json() for f in raw_filters]
        except (AttributeError, TypeError):
            active_filters = []

        graph_dict["active_filters"] = active_filters

        # Serialize console messages — supports both .to_json() and
        # direct attribute access (.message / .type) for compatibility
        # with different ConsoleMessage implementations.
        try:
            raw_messages = adapter.get_console_messages_at(i)
            console_messages = []
            for m in raw_messages:
                if hasattr(m, 'to_json'):
                    console_messages.append(m.to_json())
                elif hasattr(m, 'message'):
                    type_val = m.type.value if hasattr(m.type, 'value') else str(m.type)
                    console_messages.append({"message": m.message, "type": type_val})
        except (AttributeError, TypeError):
            console_messages = []

        graph_dict["console_messages"] = console_messages

        workspaces_js.append({
            "id":        ws_id,
            "name":      name,
            "graphData": graph_dict,
        })

        # Plugin HTML se injektuje samo za aktivni workspace.
        # Ostali su prazne ljuske — tab klik ce ih lazy-loadati (TODO).
        plugin_html = adapter.get_visualised_graph_at(i) if is_active else ""
        workspaces_html.append({
            "id":          ws_id,
            "name":        name,
            "plugin_html": plugin_html,
            "is_active":   is_active
        })

    server_state: dict[str, Any] = {
        "activeWorkspaceIndex": active_index,  # None when no workspace is active
        "workspaces":           workspaces_js,
    }

    inline_css = _read_files(_CSS_FILES)
    inline_js  = _read_files(_JS_FILES)

    env = Environment(
        loader=FileSystemLoader(str(_STATIC / "templates")),
        autoescape=False,
    )
    template = env.get_template("base.html.jinja2")

    return template.render(
        workspaces=workspaces_html,
        server_state_json=server_state,
        inline_css=inline_css,
        inline_js=inline_js,
		plugin_name=adapter.get_visualiser_name_at(active_index) if active_index is not None else "-",
    )