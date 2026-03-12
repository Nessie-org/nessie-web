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

from protocol import NessieAdapter

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
    "js/persistence.js",
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


def render(adapter: NessieAdapter) -> str:
    """
    Renderuje Nessie Graph Explorer u jedan samodovoljan HTML string.

    Plugin HTML se injektuje server-side direktno u DOM (ne kroz JS innerHTML)
    kako bi se osiguralo da se <script> tagovi unutar plugin HTML-a izvrse.
    """
    count        = adapter.get_workspace_count()
    active_index = max(0, min(adapter.get_active_workspace_index(), count - 1))

    workspaces_js:   list[dict[str, Any]] = []
    workspaces_html: list[dict[str, Any]] = []

    for i in range(count):
        graph      = adapter.get_graph_at(i)
        graph_dict = graph.to_dict()
        name       = graph_dict.get("name") or f"workspace_{i + 1}"
        ws_id      = f"ws-{name.replace(' ', '-')}"
        is_active  = (i == active_index)

        workspaces_js.append({
            "id":        ws_id,
            "name":      name,
            "graphData": graph_dict,
        })

        # Plugin HTML se injektuje samo za aktivni workspace.
        # Ostali su prazne ljuske — tab klik ce ih lazy-loadati (TODO).
        plugin_html = adapter.get_plugin_html_at(i) if is_active else ""
        workspaces_html.append({
            "id":          ws_id,
            "name":        name,
            "plugin_html": plugin_html,
            "is_active":   is_active
        })

    server_state: dict[str, Any] = {
        "activeWorkspaceIndex": active_index,
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
		plugin_name=adapter.get_visualiser_name_at(active_index),
    )
