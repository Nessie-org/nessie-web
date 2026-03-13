/* ══════════════════════════════════════════════════════════════
   settings.js — Per-workspace physics settings:
                 sliders, sim toggle, reset button.
   ══════════════════════════════════════════════════════════════ */
'use strict';

const DEFAULTS = { link: 200, charge: -500, coll: 20 };

function wireSettingsControls(ws) {
	const p = ws.pane;

	/* Collapsible settings header */
	p.querySelector('.settings-hdr').addEventListener('click', () => {
		const open = p.querySelector('.settings-body').classList.toggle('open');
		p.querySelector('.settings-arrow').classList.toggle('open', open);
	});

	/* Link distance slider */
	p.querySelector('.sl-link').addEventListener('input', (e) => {
		ws.simParams.link = +e.target.value;
		p.querySelector('.v-link').textContent = ws.simParams.link;
		reloadSim(ws);
	});

	/* Charge slider */
	p.querySelector('.sl-charge').addEventListener('input', (e) => {
		ws.simParams.charge = +e.target.value;
		p.querySelector('.v-charge').textContent = ws.simParams.charge;
		reloadSim(ws);
	});

	/* Collision padding slider */
	p.querySelector('.sl-coll').addEventListener('input', (e) => {
		ws.simParams.coll = +e.target.value;
		p.querySelector('.v-coll').textContent = ws.simParams.coll;
		reloadSim(ws);
	});

	/* Simulation on/off toggle */
	p.querySelector('.sim-toggle').addEventListener('click', function () {
		ws.simRunning = !ws.simRunning;
		this.classList.toggle('on', ws.simRunning);
		if (ws.sim) ws.simRunning ? ws.sim.restart() : ws.sim.stop();
	});

	/* Reset button */
	p.querySelector('.reset-btn').addEventListener('click', () => resetSim(ws));
}

function reloadSim(ws) {
	if (!ws.sim) return;
	ws.sim.force('link').distance(ws.simParams.link);
	ws.sim.force('charge').strength(ws.simParams.charge);
	ws.sim
		.force('collision')
		.radius((n) => Math.max(n.w, n.h) * 0.6 + ws.simParams.coll);
	ws.sim.alpha(0.3).restart();
}

function resetSim(ws) {
	ws.simParams = { ...DEFAULTS };
	const p = ws.pane;
	p.querySelector('.sl-link').value = DEFAULTS.link;
	p.querySelector('.sl-charge').value = DEFAULTS.charge;
	p.querySelector('.sl-coll').value = DEFAULTS.coll;
	p.querySelector('.v-link').textContent = DEFAULTS.link;
	p.querySelector('.v-charge').textContent = DEFAULTS.charge;
	p.querySelector('.v-coll').textContent = DEFAULTS.coll;
	reloadSim(ws);
	conLog(ws, 'Simulation reset to defaults.', 'ok');
}
