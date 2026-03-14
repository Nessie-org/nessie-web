/* ══════════════════════════════════════════════════════════════
   main.js — Workspace manager and application init.
   ══════════════════════════════════════════════════════════════ */
'use strict';

/* Shared globals */
let workspaces = [];
let activeWsId = null;
window.NessiePlugins = window.NessiePlugins || {};

function getWs(id) {
	return workspaces.find((w) => w.id === id);
}
function activeWs() {
	return getWs(activeWsId);
}

/* ── Create and register one workspace ─────────────────────── */
function initWorkspace(spec) {
	const ws = {
		id: spec.id,
		label: spec.name,
		pluginName: spec.pluginName || '',
		graphData: spec.graphData || null,

		nodes: [],
		edges: [],
		sim: null,
		zoom: null,

		selectedId: null,
		activeFilters: [],
		simRunning: true,
		simParams: { ...DEFAULTS },
		transform: d3.zoomIdentity,

		pane: null,
		svgEl: null,
		bvCanvas: null,
		conOutput: null,
		filterStack: null,
		filterBadge: null,
		treeBody: null,
		propsBody: null,
		tab: null,
		_activeTab: 'console',
		_bv: null,
	};

	attachWorkspacePaneDOM(ws);
	attachWorkspaceTab(ws);

	wireConsoleControls(ws);
	wireFilterControls(ws);
	wireTreeControls(ws);
	wireSettingsControls(ws);
	wireBirdviewControls(ws);
	wireZoomButtons(ws);

	if (ws.graphData) {
		loadServerFilters(ws, ws.graphData);
		loadServerConsoleMessages(ws, ws.graphData);
		loadGraph(ws, ws.graphData);
	}

	workspaces.push(ws);
	return ws;
}

/* ── Wire up server-rendered pane ───────────────────────────── */
function attachWorkspacePaneDOM(ws) {
	const pane = document.querySelector(`.ws-pane[data-ws-id="${ws.id}"]`);
	if (!pane) {
		console.error('Nessie: pane not found for', ws.id);
		return;
	}
	ws.pane = pane;

	ws.svgEl = pane.querySelector(
		'svg[id^="main-view"], svg[id^="main_view"], .graph-svg',
	);
	ws.bvCanvas = pane.querySelector('.bv-canvas');
	ws.conOutput = pane.querySelector('.con-output');
	ws.filterStack = pane.querySelector('.filter-stack');
	ws.filterBadge = pane.querySelector('.btab-badge');
	ws.treeBody = pane.querySelector('.tree-body');
	ws.propsBody = pane.querySelector('.props-body');

	setupResizeHandle(
		pane.querySelector('.v-handle-left'),
		pane.querySelector('.col-left'),
		'col',
		120,
		400,
	);
	setupResizeHandle(
		pane.querySelector('.v-handle-right'),
		pane.querySelector('.col-right'),
		'col-right',
		180,
		480,
	);
	setupResizeHandle(
		pane.querySelector('.h-handle'),
		pane.querySelector('.bottom-pane'),
		'row',
		100,
		480,
	);
}

/* ── Wire up server-rendered tab ────────────────────────────── */
function attachWorkspaceTab(ws) {
	const tab = document.querySelector(`.ws-tab[data-ws-id="${ws.id}"]`);
	if (!tab) {
		console.error('Nessie: tab not found for', ws.id);
		return;
	}

	tab.addEventListener('click', (e) => {
		if (e.target.classList.contains('ws-tab-close')) {
			/* Find index of this workspace among server workspaces */
			const idx = workspaces.findIndex((w) => w.id === ws.id);
			// BACK INTEGRATION
			backendAction('close_workspace', { index: idx });
			return;
		}
		const idx = workspaces.findIndex((w) => w.id === ws.id);
		// BACK INTEGRATION
		backendAction('switch_workspace', { index: idx });
	});

	ws.tab = tab;
}

/* ── Wire zoom buttons ──────────────────────────────────────── */
function wireZoomButtons(ws) {
	const p = ws.pane;
	p.querySelector('.zoom-in').addEventListener('click', () => {
		if (ws.zoom)
			d3.select(ws.svgEl)
				.transition()
				.duration(250)
				.call(ws.zoom.scaleBy, 1.4);
	});
	p.querySelector('.zoom-out').addEventListener('click', () => {
		if (ws.zoom)
			d3.select(ws.svgEl)
				.transition()
				.duration(250)
				.call(ws.zoom.scaleBy, 0.7);
	});
	p.querySelector('.zoom-fit').addEventListener('click', () =>
		fitGraph(ws, true),
	);
}

/* ── Bottom tab switching ───────────────────────────────────── */
document.addEventListener(
	'click',
	(e) => {
		const tab = e.target.closest('.btab');
		if (!tab) return;
		const pane = tab.closest('.ws-pane');
		if (!pane) return;
		pane.querySelectorAll('.btab').forEach((t) =>
			t.classList.remove('active'),
		);
		pane.querySelectorAll('.tab-pane').forEach((t) =>
			t.classList.remove('active'),
		);
		tab.classList.add('active');
		const id = tab.dataset.tab;
		pane.querySelector(`.tab-pane[data-tab-id="${id}"]`)?.classList.add(
			'active',
		);
		const ws = workspaces.find((w) => w.pane === pane);
		if (ws) ws._activeTab = id;
	},
	true,
);

/* ── Switch active workspace (local UI only — server drives state) */
function switchWorkspace(id) {
	activeWsId = id;
	document
		.querySelectorAll('.ws-tab')
		.forEach((t) => t.classList.toggle('active', t.dataset.wsId === id));
	document
		.querySelectorAll('.ws-pane')
		.forEach((p) => p.classList.toggle('active', p.dataset.wsId === id));
	const ws = getWs(id);
	if (ws) {
		updateStatusBar(ws);
		if (ws.nodes.length) {
			setTimeout(() => {
				updateBirdview(ws);
				if (!ws.svgEl) return;
				const W = ws.svgEl.clientWidth,
					H = ws.svgEl.clientHeight;
				if (!W || !H) return;
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

/* ── Status bar ─────────────────────────────────────────────── */
function updateStatusBar(ws) {
	document
		.getElementById('sb-dot')
		.classList.toggle('live', ws.nodes.length > 0);
	document.getElementById('sb-status').textContent = ws.graphData
		? (ws.graphData.type || '') + ' graph'
		: 'No graph loaded';
	document.getElementById('sb-stats').style.display = ws.nodes.length
		? 'flex'
		: 'none';
	document.getElementById('sb-sep2').style.display = ws.nodes.length
		? 'block'
		: 'none';
	document.getElementById('sb-n').textContent = ws.nodes.length;
	document.getElementById('sb-e').textContent = ws.edges.length;
	document.getElementById('sb-zoom-item').style.display = ws.nodes.length
		? 'flex'
		: 'none';
	document.getElementById('sb-zoom').textContent =
		Math.round(ws.transform.k * 100) + '%';
	const sel = document.getElementById('sb-sel');
	if (ws.selectedId) {
		sel.style.display = 'flex';
		document.getElementById('sb-sel-id').textContent = ws.selectedId;
	} else sel.style.display = 'none';
	document.getElementById('btn-reload').disabled = !ws.graphData;
	document.getElementById('sb-plugin-label').textContent = ws.pluginName;
}

/* ── Global toolbar ─────────────────────────────────────────── */
document.getElementById('btn-fit').addEventListener('click', () => {
	const ws = activeWs();
	if (ws) fitGraph(ws, true);
});
document.getElementById('btn-reload').addEventListener('click', () => {
	const ws = activeWs();
	if (ws && ws.graphData) loadGraph(ws, ws.graphData);
});
document.getElementById('plugin-chip').addEventListener('click', () => {
	changeVisualizerDialog();
});
document.getElementById('ws-add').addEventListener('click', () => {
	openNewWorkspaceDialog();
});
document.getElementById('btn-settings-toggle').addEventListener('click', () => {
	const ws = activeWs();
	if (!ws) return;
	const body = ws.pane.querySelector('.settings-body');
	const arrow = ws.pane.querySelector('.settings-arrow');
	const open = body.classList.toggle('open');
	arrow.classList.toggle('open', open);
});

/* ── Search ─────────────────────────────────────────────────── */
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');

function doSearch() {
	const query = searchInput?.value.trim();
	let body = { query };
	if (!query) {
		body = { query: "" };
	}
	// BACK INTEGRATION
	backendAction('search', body);
}
searchBtn?.addEventListener('click', doSearch);
searchInput?.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') doSearch();
});

/* ──────────────────────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────────────────────── */
(function init() {
	const server = window.NESSIE_SERVER_STATE || {};
	(server.workspaces || []).forEach((spec) => initWorkspace(spec));

	if (!workspaces.length) {
		console.error('Nessie: no workspaces initialised');
		return;
	}

	/* Populate search field from active workspace's last query */
	const activeSpec = server.workspaces?.[server.activeWorkspaceIndex ?? 0];
	if (activeSpec?.graphData?.search_query && searchInput) {
		searchInput.value = activeSpec.graphData.search_query;
	}

	if (
		server.activeWorkspaceIndex !== null &&
		server.activeWorkspaceIndex !== undefined
	) {
		const targetId =
			server.workspaces?.[server.activeWorkspaceIndex]?.id ??
			workspaces[0].id;
		const exists = workspaces.find((w) => w.id === targetId);
		switchWorkspace(exists ? targetId : workspaces[0].id);
	}
})();
