/* ══════════════════════════════════════════════════════════════
   main.js — Workspace manager and application init.

   Data source:  window.NESSIE_SERVER_STATE (injected by Python)
   UI state:     localStorage via persistence.js

   window.NESSIE_SERVER_STATE = {
     activeWorkspaceIndex: 0,
     workspaces: [
       {
         id:         'ws-1',
         name:       'my_graph',        // = graph.name
         pluginName: 'block_visualizer',
         pluginHtml: '<svg id="main-view-my_graph">...</svg><script>...<script>',
         graphData:  { type, nodes, edges },  // graph.to_dict()
       },
       ...
     ]
   }
   ══════════════════════════════════════════════════════════════ */
'use strict';

/* Shared globals (referenced by all other modules) */
let workspaces = [];
let activeWsId = null;
window.NessiePlugins = window.NessiePlugins || {};

function getWs(id)  { return workspaces.find(w => w.id === id); }
function activeWs() { return getWs(activeWsId); }

/* ── Create and register one workspace ─────────────────────── */
function initWorkspace(spec, savedState) {
  const ws = {
    id:         spec.id,
    label:      spec.name,
    pluginName: spec.pluginName || '',
    graphData:  spec.graphData || null,

    /* D3 state */
    nodes: [], edges: [],
    sim:   null, zoom: null,

    /* UI state — restored from savedState below */
    selectedId:    null,
    activeFilters: [],
    simRunning:    true,
    simParams:     { ...DEFAULTS },
    transform:     d3.zoomIdentity,

    /* DOM refs — populated after pane is attached */
    pane:           null,
    svgEl:          null,
    bvCanvas:       null,
    conOutput:      null,
    filterStack:    null,
    filterBadge:    null,
    filterBanner:   null,
    filterBannerTxt:null,
    treeBody:       null,
    propsBody:      null,
    tab:            null,
    _activeTab:     'console',
    _bv:            null,
  };

  /* Pane and tab are already in DOM (server-rendered) — just wire them */
  attachWorkspacePaneDOM(ws);
  attachWorkspaceTab(ws);

  /* Restore persisted UI state (sliders, layout, etc.) */
  if (savedState) restoreWorkspaceUiState(ws, savedState);

  /* Wire all controls */
  wireConsoleControls(ws);
  wireFilterControls(ws);
  wireTreeControls(ws);
  wireSettingsControls(ws);
  wireBirdviewControls(ws);
  wireZoomButtons(ws);

  /* Load the graph */
  if (ws.graphData) {
    loadGraph(ws, ws.graphData);

    /* Restore filters after graph build */
    if (ws._savedFilters?.length) {
      ws.activeFilters = ws._savedFilters;
      delete ws._savedFilters;
      refreshFilterStack(ws);
      applyFiltersToGraph(ws);
    }
    /* Restore selection */
    if (ws._savedSelectedId) {
      const exists = ws.nodes.find(n => n.id === ws._savedSelectedId);
      if (exists) selectNode(ws, ws._savedSelectedId);
      delete ws._savedSelectedId;
    }
    /* Restore zoom (delayed so sim tick doesn't overwrite it) */
    if (ws._savedTransform) {
      const t = ws._savedTransform;
      delete ws._savedTransform;
      if (t.k !== 1) {
        setTimeout(() => {
          if (ws.zoom)
            d3.select(ws.svgEl).call(
              ws.zoom.transform,
              d3.zoomIdentity.translate(t.x, t.y).scale(t.k)
            );
        }, 960);
      }
    }
  } else {
    conLog(ws, 'No graph loaded.', 'info');
  }

  workspaces.push(ws);
  return ws;
}

/* ── Wire up a server-rendered pane (pane already in DOM) ───── */
function attachWorkspacePaneDOM(ws) {
  const pane = document.querySelector(`.ws-pane[data-ws-id="${ws.id}"]`);
  if (!pane) { console.error('Nessie: pane not found for', ws.id); return; }
  ws.pane = pane;

  /* Grab refs */
  ws.svgEl           = pane.querySelector('svg[id^="main-view"], svg[id^="main_view"], .graph-svg');
  ws.bvCanvas        = pane.querySelector('.bv-canvas');
  ws.conOutput       = pane.querySelector('.con-output');
  ws.filterStack     = pane.querySelector('.filter-stack');
  ws.filterBadge     = pane.querySelector('.btab-badge');
  ws.filterBanner    = pane.querySelector('.filter-banner');
  ws.filterBannerTxt = pane.querySelector('.filter-banner-txt');
  ws.treeBody        = pane.querySelector('.tree-body');
  ws.propsBody       = pane.querySelector('.props-body');

  /* Resize handles */
  setupResizeHandle(pane.querySelector('.v-handle-left'),  pane.querySelector('.col-left'),    'col',       120, 400);
  setupResizeHandle(pane.querySelector('.v-handle-right'), pane.querySelector('.col-right'),   'col-right', 180, 480);
  setupResizeHandle(pane.querySelector('.h-handle'),       pane.querySelector('.bottom-pane'), 'row',       100, 480);
}

/* ── Wire up a server-rendered tab (tab already in DOM) ──────── */
function attachWorkspaceTab(ws) {
  const tab = document.querySelector(`.ws-tab[data-ws-id="${ws.id}"]`);
  if (!tab) { console.error('Nessie: tab not found for', ws.id); return; }
  tab.addEventListener('click', e => {
    if (e.target.classList.contains('ws-tab-close')) closeWorkspace(ws.id);
    // TODO: povezati na back — promena aktivnog workspace-a dolazi sa servera
  });
  ws.tab = tab;
}

/* ── Wire zoom buttons ──────────────────────────────────────── */
function wireZoomButtons(ws) {
  const p = ws.pane;
  p.querySelector('.zoom-in').addEventListener('click', () => {
    if (ws.zoom) d3.select(ws.svgEl).transition().duration(250).call(ws.zoom.scaleBy, 1.4);
  });
  p.querySelector('.zoom-out').addEventListener('click', () => {
    if (ws.zoom) d3.select(ws.svgEl).transition().duration(250).call(ws.zoom.scaleBy, 0.7);
  });
  p.querySelector('.zoom-fit').addEventListener('click', () => fitGraph(ws, true));
}

/* ── Wire bottom tabs (Console / Filters) ───────────────────── */
document.addEventListener('click', e => {
  const tab = e.target.closest('.btab');
  if (!tab) return;
  const pane = tab.closest('.ws-pane'); if (!pane) return;
  pane.querySelectorAll('.btab').forEach(t => t.classList.remove('active'));
  pane.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  const id = tab.dataset.tab;
  pane.querySelector(`.tab-pane[data-tab-id="${id}"]`)?.classList.add('active');
  const ws = workspaces.find(w => w.pane === pane);
  if (ws) { ws._activeTab = id; debouncedSave(); }
}, true);

/* ── Switch active workspace ────────────────────────────────── */
function switchWorkspace(id) {
  activeWsId = id;
  document.querySelectorAll('.ws-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.wsId === id));
  document.querySelectorAll('.ws-pane').forEach(p =>
    p.classList.toggle('active', p.dataset.wsId === id));
  const ws = getWs(id);
  if (ws) {
    updateStatusBar(ws);
    if (ws.nodes.length) {
      setTimeout(() => {
        updateBirdview(ws);
        if (!ws.svgEl) return;
        const W = ws.svgEl.clientWidth, H = ws.svgEl.clientHeight;
        if (!W || !H) return;
        /* Recentre forces with real dimensions (pane was hidden at loadGraph time) */
        if (ws.sim) {
          ws.sim.force('cx', d3.forceX(W / 2).strength(0.05));
          ws.sim.force('cy', d3.forceY(H / 2).strength(0.05));
          ws.sim.alpha(0.3).restart();
        }
        fitGraph(ws, false);
      }, 50);
    }
  }
}

/* ── Close a workspace ──────────────────────────────────────── */
function closeWorkspace(id) {
  if (workspaces.length <= 1) return;
  const idx = workspaces.findIndex(w => w.id === id);
  const ws  = workspaces[idx];
  if (ws.sim) ws.sim.stop();
  ws.pane.remove();
  ws.tab.remove();
  workspaces.splice(idx, 1);
  switchWorkspace(workspaces[Math.min(idx, workspaces.length-1)].id);
  saveState();
}

/* ── Status bar ─────────────────────────────────────────────── */
function updateStatusBar(ws) {
  document.getElementById('sb-dot').classList.toggle('live', ws.nodes.length > 0);
  document.getElementById('sb-status').textContent =
    ws.graphData ? (ws.graphData.type || '') + ' graph' : 'No graph loaded';
  document.getElementById('sb-stats').style.display    = ws.nodes.length ? 'flex'  : 'none';
  document.getElementById('sb-sep2').style.display     = ws.nodes.length ? 'block' : 'none';
  document.getElementById('sb-n').textContent           = ws.nodes.length;
  document.getElementById('sb-e').textContent           = ws.edges.length;
  document.getElementById('sb-zoom-item').style.display = ws.nodes.length ? 'flex'  : 'none';
  document.getElementById('sb-zoom').textContent =
    Math.round(ws.transform.k * 100) + '%';
  const sel = document.getElementById('sb-sel');
  if (ws.selectedId) {
    sel.style.display='flex';
    document.getElementById('sb-sel-id').textContent = ws.selectedId;
  } else sel.style.display='none';
  document.getElementById('btn-reload').disabled = !ws.graphData;
  document.getElementById('sb-plugin-label').textContent   = ws.pluginName;
}

/* ── Global toolbar wiring ──────────────────────────────────── */
document.getElementById('btn-fit').addEventListener('click', () => {
  const ws = activeWs(); if (ws) fitGraph(ws, true);
});
document.getElementById('btn-reload').addEventListener('click', () => {
  const ws = activeWs(); if (ws && ws.graphData) loadGraph(ws, ws.graphData);
});
document.getElementById('plugin-chip').addEventListener('click', () => {
  alert('TODO: Plugin selector\n\nCurrent plugin: ' + (activeWs()?.pluginName || ''));
});
document.getElementById('ws-add').addEventListener('click', () => {
  alert('TODO: New workspace dialog');
});
document.getElementById('btn-settings-toggle').addEventListener('click', () => {
  const ws = activeWs(); if (!ws) return;
  const body  = ws.pane.querySelector('.settings-body');
  const arrow = ws.pane.querySelector('.settings-arrow');
  const open  = body.classList.toggle('open');
  arrow.classList.toggle('open', open);
  debouncedSave();
});

/* ──────────────────────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────────────────────── */
(function init() {
  const server    = window.NESSIE_SERVER_STATE || {};
  const persisted = loadPersistedState();

  /* Build lookup: saved UI state by workspace id */
  const savedById = {};
  (persisted.workspaces || []).forEach(s => { savedById[s.id] = s; });

  (server.workspaces || []).forEach(spec => {
    initWorkspace(spec, savedById[spec.id]);
  });

  if (!workspaces.length) {
    console.error('Nessie: no workspaces initialised — check NESSIE_SERVER_STATE');
    return;
  }

  /* Determine active workspace */
  const targetId = (server.workspaces?.[server.activeWorkspaceIndex ?? 0]?.id)
    || workspaces[0].id;
  const exists = workspaces.find(w => w.id === targetId);
  switchWorkspace(exists ? targetId : workspaces[0].id);

  conLog(workspaces[0], 'Nessie Graph Explorer ready.', 'ok');
})();
