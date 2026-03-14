# nessie-web

The official web UI plugin for [Nessie Graph Explorer](https://github.com/Nessie-org). It renders the full browser-based interface as a single self-contained HTML page, served directly by the Nessie backend.

## Overview

`nessie-web` is a Nessie plugin that handles the `render` action — it takes the current application state from the Nessie backend and produces a complete, inline HTML document with all CSS and JavaScript bundled. The result is a fully interactive graph explorer running in any modern web browser, with no build step or asset server required.

**Key features:**

- Single-file HTML output — all CSS and JS inlined at render time via Jinja2
- Multi-workspace support with tabbed navigation
- D3-powered force-directed graph with zoom, pan, and fit controls
- Node attribute inspection in a collapsible right sidebar
- Tree view for hierarchical graph browsing
- Attribute-based node filtering with an active filter stack
- Integrated console panel for datasource messages
- Minimap (birdview) for navigating large graphs
- Plugin picker UI for loading datasources and swapping visualizers
- Resizable layout panels (left sidebar, right sidebar, bottom pane)
- Search bar with backend-driven query state persistence
- Server-side state rendering — every action triggers a clean re-render

## Requirements

- Python 3.9+
- A running [Nessie Graph Explorer](https://github.com/Nessie-org) instance with `nessie-api >= 0.1.0`
- Jinja2 >= 3.1

External frontend dependencies (loaded from CDN at runtime):

- [D3.js](https://d3js.org/) v7.8.5 — force simulation and graph layout
- [Font Awesome](https://fontawesome.com/) 6.5.0 — icons
- [JetBrains Mono & Syne](https://fonts.google.com/) — typography

## Installation

Install from PyPI:

```bash
pip install nessie-web
```

Or install from source:

```bash
git clone https://github.com/Nessie-org/nessie-web.git
cd nessie-web
pip install .
```

Once installed, the plugin registers itself automatically with Nessie Graph Explorer via its entry point (`nessie_plugins`). No manual configuration is required.

## How It Works

When Nessie dispatches a `render` action to this plugin, `render.py` is invoked with the active `Context`:

1. **State extraction** — the renderer reads the number of workspaces, the active workspace index, each workspace's graph data, active filters, console messages, and current search query from the `Context` adapter.
2. **Inlining** — all CSS files and JS files are read from the `_static/` directory and concatenated into single inline strings.
3. **Templating** — the assembled state and assets are passed to `base.html.jinja2`, which produces one self-contained HTML document.
4. **Client init** — on page load, the browser reads `window.NESSIE_SERVER_STATE` (injected by the template) and initialises the D3 simulation, workspace tabs, panel resize handles, and all event wiring.
5. **Action loop** — any user interaction that changes state (opening a workspace, applying a filter, searching, switching tabs) calls `POST /perform-action` on the Nessie backend and reloads the page, which triggers a fresh render.

## Architecture

### Python layer

| File | Responsibility |
|------|---------------|
| `plugin.py` | Registers the `render` handler under the `"Nessie Web"` plugin name |
| `render.py` | Reads context state, inlines static assets, renders the Jinja2 template |

### Frontend layer

| File | Responsibility |
|------|---------------|
| `backend.js` | `backendAction()` and `backendGetPlugins()` — all server communication; plugin picker and requirements popup UI |
| `main.js` | Workspace lifecycle, tab switching, status bar, toolbar wiring, search, app init |
| `graph.js` | D3 force simulation; reads plugin-rendered SVG nodes/edges and animates them |
| `filters.js` | Filter form wiring, active filter stack rendering |
| `tree-view.js` | Hierarchical tree panel populated from graph nodes |
| `properties.js` | Node attribute panel, populated on node selection |
| `birdview.js` | Canvas minimap synced to the main SVG viewport |
| `console.js` | Console message rendering and controls |
| `settings.js` | Simulation parameter controls (link distance, charge, etc.) |
| `resize.js` | Drag-to-resize handles for sidebar and bottom panels |

### Static assets

```
src/nessie_web/
├── _static/
│   ├── css/           # Modular stylesheets (inlined at render time)
│   ├── js/            # Frontend modules (inlined at render time)
│   └── templates/
│       └── base.html.jinja2   # Master HTML template
├── plugin.py
├── render.py
└── __init__.py
```

## Backend API

The frontend communicates exclusively with two endpoints on the Nessie backend:

### `POST /perform-action`

Dispatches a named action and reloads the page on success.

```json
{
  "Action Name": "open_workspace",
  "payload": {
    "plugin": "NPM Package Dependencies",
    "payload": { "Package Name": "express" }
  }
}
```

Supported action names (handled by other installed Nessie plugins):

| Action | Description |
|--------|-------------|
| `open_workspace` | Load a new graph from a datasource plugin |
| `close_workspace` | Close a workspace tab |
| `switch_workspace` | Make a workspace active |
| `load_graph` | Reload the current graph |
| `search` | Apply a search query to the active graph |
| `add_filter` | Add an attribute filter |
| `remove_filter` | Remove a specific filter |
| `clear_filters` | Remove all active filters |
| `change_visualizer` | Switch the active visualizer plugin |

### `GET /plugins?Action+Name=<action>`

Returns the list of installed plugins that handle a given action, used to populate the plugin picker.

```json
[
  {
    "name": "NPM Package Dependencies",
    "requirements": { "Package Name": "string" }
  }
]
```

## Development

Clone the repository and install in editable mode:

```bash
git clone https://github.com/Nessie-org/nessie-web.git
cd nessie-web
pip install -e .
```

Frontend files (`_static/css/` and `_static/js/`) are plain CSS and JavaScript with no bundler or transpiler. Edit them directly — changes take effect on the next render call.

This project uses [Hatchling](https://hatch.pypa.io/) as its build backend, [Black](https://black.readthedocs.io/) and [Ruff](https://docs.astral.sh/ruff/) for Python formatting/linting, [mypy](https://mypy.readthedocs.io/) for type checking, and [Prettier](https://prettier.io/) for JS/CSS formatting (configuration in `.prettierrc`).

Format and lint:

```bash
# Python
black src/
ruff check src/
mypy src/

# JavaScript / CSS
prettier --write "src/**/*.js" "src/**/*.css"
```

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes before submitting a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Open a pull request against `main`

## License

MIT © [Nessie-org](https://github.com/Nessie-org). See [LICENSE](LICENSE) for details.