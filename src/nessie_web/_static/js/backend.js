/* ══════════════════════════════════════════════════════════════
   backend.js — Centralized backend API helpers.

   All interactions with the server go through these functions.
   After any state-changing action the page is reloaded so the
   server re-renders with the updated state.
   ══════════════════════════════════════════════════════════════ */
'use strict';

/* ── Perform a plugin action (POST /perform-action) ─────────── */
// BACK INTEGRATION
async function backendAction(actionName, payload = {}, pluginName = '') {
	try {
		const body = { 'Action Name': actionName, payload };
		if (pluginName) body['Plugin Name'] = pluginName;

		const res = await fetch('/perform-action', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			const text = await res.text();
			console.error(
				`[Nessie] Action "${actionName}" failed (${res.status}):`
			);
			return false;
		}

		window.location.reload();
		return true;
	} catch (err) {
		console.error(`[Nessie] Action "${actionName}" error:`, err);
		return false;
	}
}

/* ── Fetch available plugins for a given action (GET /plugins) ─ */
// BACK INTEGRATION
async function backendGetPlugins(actionName) {
	try {
		const res = await fetch(
			`/plugins?${new URLSearchParams({ 'Action Name': actionName })}`,
		);
		if (!res.ok) return [];
		return await res.json();
	} catch (err) {
		console.error('[Nessie] GET /plugins error:', err);
		return [];
	}
}

/* ── Build a requirements form from plugin.requirements ─────── */
/* Returns { formEl, getValues } where getValues() → plain object */
function buildRequirementsForm(requirements) {
	const form = document.createElement('div');
	form.className = 'popup-form';

	const fields = {};

	Object.entries(requirements || {}).forEach(([key, type]) => {
		const row = document.createElement('div');
		row.className = 'popup-field';

		const label = document.createElement('label');
		label.textContent = key;
		row.appendChild(label);

		let input;
		if (type === 'boolean') {
			input = document.createElement('input');
			input.type = 'checkbox';
		} else if (type === 'file') {
			input = document.createElement('input');
			input.type = 'file';
			// For file inputs we send the absolute path, not the file object
			input.addEventListener('change', () => {
				// Store path via webkitRelativePath or name as fallback;
				// real absolute path only available via electron/native — store filename for now
				input._absolutePath = input.files[0]?.name ?? '';
			});
		} else if (type === 'number') {
			input = document.createElement('input');
			input.type = 'number';
		} else {
			input = document.createElement('input');
			input.type = 'text';
		}

		input.className = 'popup-input';
		fields[key] = { input, type };
		row.appendChild(input);
		form.appendChild(row);
	});

	function getValues() {
		const out = {};
		Object.entries(fields).forEach(([key, { input, type }]) => {
			if (type === 'boolean') out[key] = input.checked;
			else if (type === 'number') out[key] = parseFloat(input.value) || 0;
			else if (type === 'file')
				out[key] = input._absolutePath || input.value;
			else out[key] = input.value;
		});
		return out;
	}

	return { formEl: form, getValues };
}

/* ── Generic popup ───────────────────────────────────────────── */
/*
  showPopup({
    title:    string,
    body:     HTMLElement | string,
    confirm:  string,          // confirm button label
    onConfirm: async () => bool  // return false to keep popup open
  })
*/
function showPopup({ title, body, confirm = 'OK', onConfirm }) {
	// Overlay
	const overlay = document.createElement('div');
	overlay.className = 'popup-overlay';

	const box = document.createElement('div');
	box.className = 'popup-box';

	const hdr = document.createElement('div');
	hdr.className = 'popup-hdr';
	hdr.innerHTML = `<span class="popup-title">${title}</span>
    <button class="popup-close icon-btn">✕</button>`;

	const content = document.createElement('div');
	content.className = 'popup-content';
	if (typeof body === 'string') content.innerHTML = body;
	else content.appendChild(body);

	const footer = document.createElement('div');
	footer.className = 'popup-footer';
	const cancelBtn = document.createElement('button');
	cancelBtn.className = 'popup-btn popup-btn-cancel';
	cancelBtn.textContent = 'Cancel';
	const confirmBtn = document.createElement('button');
	confirmBtn.className = 'popup-btn popup-btn-confirm';
	confirmBtn.textContent = confirm;
	footer.appendChild(cancelBtn);
	footer.appendChild(confirmBtn);

	box.appendChild(hdr);
	box.appendChild(content);
	box.appendChild(footer);
	overlay.appendChild(box);
	document.body.appendChild(overlay);

	function close() {
		overlay.remove();
	}
	hdr.querySelector('.popup-close').addEventListener('click', close);
	cancelBtn.addEventListener('click', close);
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) close();
	});

	confirmBtn.addEventListener('click', async () => {
		confirmBtn.disabled = true;
		const ok = await onConfirm();
		if (ok === false) confirmBtn.disabled = false;
		// if true/undefined → backendAction triggers reload
	});

	return { close };
}

/* ── Plugin picker (first step — list of plugin buttons) ─────── */
function showPluginPicker({ title, hint, plugins, onPick }) {
	const overlay = document.createElement('div');
	overlay.className = 'picker-overlay';

	const box = document.createElement('div');
	box.className = 'picker-box';

	box.innerHTML = `
    <div class="picker-header">
      <div class="picker-hint">${hint}</div>
      <h3>${title}</h3>
    </div>
    <div class="picker-list"></div>
    <div class="picker-footer">
      <button class="picker-cancel">Cancel</button>
    </div>`;

	const list = box.querySelector('.picker-list');
	plugins.forEach((p) => {
		const item = document.createElement('div');
		item.className = 'picker-item';
		item.innerHTML = `
      <div class="picker-item-icon">⬡</div>
      <div class="picker-item-info">
        <div class="picker-item-name">${p.name}</div>
        ${
			Object.keys(p.requirements || {}).length
				? `<div class="picker-item-desc">${Object.keys(p.requirements).join(', ')}</div>`
				: '<div class="picker-item-desc">No setup required</div>'
		}
      </div>`;
		item.addEventListener('click', () => {
			overlay.remove();
			onPick(p);
		});
		list.appendChild(item);
	});

	box.querySelector('.picker-cancel').addEventListener('click', () =>
		overlay.remove(),
	);
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) overlay.remove();
	});
	overlay.appendChild(box);
	document.body.appendChild(overlay);
}

/* ── Requirements popup (second step — only if needed) ──────── */
function showRequirementsPopup({ title, plugin, onConfirm }) {
	const reqs = plugin.requirements || {};
	if (!Object.keys(reqs).length) {
		// No requirements — skip straight to action
		onConfirm({});
		return;
	}
	const { formEl, getValues } = buildRequirementsForm(reqs);
	showPopup({
		title,
		body: formEl,
		confirm: 'Confirm',
		onConfirm: async () => {
			await onConfirm(getValues());
		},
	});
}

/* ── Open-workspace dialog ───────────────────────────────────── */
async function openNewWorkspaceDialog() {
	// BACK INTEGRATION
	const plugins = await backendGetPlugins('load_graph');
	if (!plugins.length) {
		alert('No datasource plugins available.');
		return;
	}

	showPluginPicker({
		hint: 'INTENT: LOAD_DATA',
		title: 'Choose a Data Source',
		plugins,
		onPick: (plugin) => {
			showRequirementsPopup({
				title: plugin.name,
				plugin,
				onConfirm: async (setup) => {
					// BACK INTEGRATION
					await backendAction('open_workspace', {
						plugin: plugin.name,
						payload: setup,
					});
				},
			});
		},
	});
}

/* ── Change-visualizer dialog ────────────────────────────────── */
async function changeVisualizerDialog() {
	// BACK INTEGRATION
	const plugins = await backendGetPlugins('visualise_graph');
	if (!plugins.length) {
		alert('No visualizer plugins available.');
		return;
	}

	showPluginPicker({
		hint: 'INTENT: VISUALISE',
		title: 'Choose a Visualizer',
		plugins,
		onPick: (plugin) => {
			showRequirementsPopup({
				title: plugin.name,
				plugin,
				onConfirm: async (setup) => {
					// BACK INTEGRATION
					await backendAction('change_visualizer', {
						visualizer_name: plugin.name,
						...setup,
					});
				},
			});
		},
	});
}
