/* ══════════════════════════════════════════════════════════════
   persistence.js — localStorage save / restore of UI state.

   Saves:  per-workspace zoom transform, filters, selection,
           sim params, sim toggle, panel sizes, active tab,
           settings open/closed.  Active workspace index.

   Does NOT save graph content — that always comes from the
   server (window.NESSIE_SERVER_STATE).

   Key: 'nessie_v3'
   ══════════════════════════════════════════════════════════════ */
'use strict';

const LS_KEY = 'nessie_v3';

function debounce(fn, ms) {
	let t;
	return (...a) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...a), ms);
	};
}
const debouncedSave = debounce(saveState, 300);

/* ── Read current layout sizes from DOM ────────────────────── */
function readLayout(ws) {
	const p = ws.pane;
	return {
		leftW: p.querySelector('.col-left')?.offsetWidth || 220,
		rightW: p.querySelector('.col-right')?.offsetWidth || 240,
		bottomH: p.querySelector('.bottom-pane')?.offsetHeight || 190,
		settingsOpen:
			p.querySelector('.settings-body')?.classList.contains('open') ||
			false,
		activeTab: ws._activeTab || 'console',
	};
}

/* ── Apply saved layout sizes to DOM ───────────────────────── */
function applyLayout(ws, layout) {
	if (!layout) return;
	const p = ws.pane;

	function pin(el, prop, val) {
		if (!el || !val) return;
		el.style[prop] = val + 'px';
		el.style.flexBasis = val + 'px';
		el.style.flexGrow = '0';
		el.style.flexShrink = '0';
	}
	pin(p.querySelector('.col-left'), 'width', layout.leftW);
	pin(p.querySelector('.col-right'), 'width', layout.rightW);
	pin(p.querySelector('.bottom-pane'), 'height', layout.bottomH);

	if (layout.settingsOpen) {
		p.querySelector('.settings-body')?.classList.add('open');
		p.querySelector('.settings-arrow')?.classList.add('open');
	}
	if (layout.activeTab && layout.activeTab !== 'console') {
		p.querySelectorAll('.btab').forEach((t) =>
			t.classList.remove('active'),
		);
		p.querySelectorAll('.tab-pane').forEach((t) =>
			t.classList.remove('active'),
		);
		p.querySelector(`.btab[data-tab="${layout.activeTab}"]`)?.classList.add(
			'active',
		);
		p.querySelector(
			`.tab-pane[data-tab-id="${layout.activeTab}"]`,
		)?.classList.add('active');
		ws._activeTab = layout.activeTab;
	}
}

/* ── Serialize everything to localStorage ──────────────────── */
function saveState() {
	try {
		const state = {
			workspaces: workspaces.map((ws) => ({
				id: ws.id,
				simParams: { ...ws.simParams },
				simRunning: ws.simRunning,
				selectedId: ws.selectedId,
				transform: {
					x: ws.transform.x,
					y: ws.transform.y,
					k: ws.transform.k,
				},
				layout: readLayout(ws),
			})),
		};
		localStorage.setItem(LS_KEY, JSON.stringify(state));
	} catch (e) {
		console.warn('Nessie: could not save state', e);
	}
}

/* ── Load raw persisted object (may be null / empty) ───────── */
function loadPersistedState() {
	try {
		return JSON.parse(localStorage.getItem(LS_KEY)) || {};
	} catch {
		return {};
	}
}

/* ── Restore UI state into an already-initialized workspace ── */
function restoreWorkspaceUiState(ws, saved) {
	if (!saved) return;

	/* Sim params → sliders */
	if (saved.simParams) {
		ws.simParams = { ...DEFAULTS, ...saved.simParams };
		const p = ws.pane;
		p.querySelector('.sl-link').value = ws.simParams.link;
		p.querySelector('.sl-charge').value = ws.simParams.charge;
		p.querySelector('.sl-coll').value = ws.simParams.coll;
		p.querySelector('.v-link').textContent = ws.simParams.link;
		p.querySelector('.v-charge').textContent = ws.simParams.charge;
		p.querySelector('.v-coll').textContent = ws.simParams.coll;
	}

	/* Sim running toggle */
	if (typeof saved.simRunning === 'boolean') {
		ws.simRunning = saved.simRunning;
		ws.pane
			.querySelector('.sim-toggle')
			.classList.toggle('on', ws.simRunning);
	}

	/* Panel layout */
	applyLayout(ws, saved.layout);

	/* Selected node (applied after graph is loaded in main.js) */
	if (saved.selectedId) ws._savedSelectedId = saved.selectedId;

	/* Zoom transform (applied after graph is loaded in main.js) */
	if (saved.transform) ws._savedTransform = saved.transform;
}
