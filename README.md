# nessie-explorer

Framework-agnostic HTML renderer for the **Nessie Graph Explorer** UI.

Generates a single, self-contained HTML page — no external assets required at
runtime (CSS and JS are inlined). The page embeds a D3 force-directed graph
explorer with multi-workspace support, an interactive console, filters, a bird
view, and properties panel.

---

## Installation

```bash
pip install nessie-explorer          # once published to PyPI
# or, from source:
pip install -e /path/to/nessie-explorer
```

**Requires:** Python ≥ 3.10, Jinja2 ≥ 3.1.

---

## Quick start

```python
from nessie_explorer import render

class MyAdapter:
    def __init__(self, graphs, plugin):
        self._graphs = graphs
        self._plugin = plugin

    def get_workspace_count(self):        return len(self._graphs)
    def get_active_workspace_index(self): return 0

    def get_graph_at(self, i):            return self._graphs[i]

    def get_plugin_html_at(self, i):
        from nessie_api.models import Action
        action = Action(name="visualise_graph", payload=self._graphs[i])
        return self._plugin.handle(action)

html = render(MyAdapter(graphs, plugin))
```

### Django

```python
from django.http import HttpResponse
from nessie_explorer import render

def graph_view(request):
    return HttpResponse(render(MyAdapter(graphs, plugin)))
```

### Flask

```python
from flask import Response
from nessie_explorer import render

@app.route("/graph")
def graph():
    return Response(render(MyAdapter(graphs, plugin)), mimetype="text/html")
```

### FastAPI

```python
from fastapi.responses import HTMLResponse
from nessie_explorer import render

@app.get("/graph", response_class=HTMLResponse)
def graph():
    return render(MyAdapter(graphs, plugin))
```

---

## `NessieAdapter` protocol

Implement these four methods — no base class needed:

| Method | Returns | Description |
|--------|---------|-------------|
| `get_workspace_count()` | `int` | Number of workspace tabs (≥ 1) |
| `get_active_workspace_index()` | `int` | Which tab is initially active |
| `get_graph_at(index)` | Graph-like object | See duck-typing notes below |
| `get_plugin_html_at(index)` | `str` | Raw HTML from `plugin.handle(action)` |

### Graph duck-typing

`get_graph_at()` can return any object that has:

- `.name` → `str` — used as tab label and SVG id suffix (`main-view-{name}`)
- `.type` → `str` — e.g. `"directed"`, `"undirected"`
- `.nodes` → iterable of objects with `.id` and `.attributes` (dict-like)
- `.edges` → iterable of objects with `.id`, `.source`, `.target`, `.attributes`

Works with `nessie_api.models.Graph` out of the box.

---

## Client-side plugin hooks

If your plugin registers a JS renderer, expose it via:

```javascript
window.NessiePlugins['my_plugin_name'] = {
  renderNode(g, d) {
    // g = D3 selection of the node <g>
    // d = node datum  { id, attributes, _w, _h, x, y }
    // Set d._w and d._h to control collision radius
    g.append('rect').attr('width', d._w = 140).attr('height', d._h = 60);
  }
};
```

Place this script in the HTML string returned by `get_plugin_html_at()`.
The `ws.pluginName` field in `NESSIE_SERVER_STATE` is used to look up the renderer.

---

## `window.NESSIE_SERVER_STATE` shape

The renderer injects this global automatically:

```javascript
window.NESSIE_SERVER_STATE = {
  activeWorkspaceIndex: 0,           // int
  workspaces: [
    {
      id:         "ws-my_graph",     // "ws-" + graph.name
      name:       "my_graph",        // graph.name
      pluginHtml: "...",             // raw HTML from plugin.handle()
      graphData: {
        name:  "my_graph",
        type:  "directed",
        nodes: [{ id: "...", attributes: { type: "module", ... } }],
        edges: [{ id: "e0", source: "...", target: "...", attributes: {} }]
      }
    }
  ]
};
```

---

## Project structure

```
src/nessie_explorer/
├── __init__.py              # exports: render, NessieAdapter
├── protocol.py              # NessieAdapter Protocol
├── render.py                # render() function
├── _graph_serializer.py     # graph → dict (duck-typed)
└── _static/
    ├── css/
    │   ├── global.css       # tokens, reset, scrollbars
    │   ├── toolbar.css
    │   ├── wsbar.css
    │   ├── layout.css       # app shell, columns, resize handles
    │   ├── tree-view.css
    │   ├── main-view.css
    │   ├── bottom.css       # console, filters
    │   ├── right-sidebar.css
    │   └── statusbar.css
    ├── js/
    │   ├── persistence.js   # localStorage save/restore
    │   ├── resize.js        # drag handles
    │   ├── settings.js      # physics sliders
    │   ├── properties.js    # node inspector
    │   ├── filters.js       # attribute filters
    │   ├── console.js       # REPL console
    │   ├── tree-view.js     # left panel tree
    │   ├── birdview.js      # minimap canvas
    │   ├── graph.js         # D3 simulation
    │   └── main.js          # workspace manager, init
    └── templates/
        └── base.html.jinja2 # full page template
```
