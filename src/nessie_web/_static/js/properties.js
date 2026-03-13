/* ══════════════════════════════════════════════════════════════
   properties.js — Right sidebar: Properties panel.
                   Renders node attributes and edge lists.
   ══════════════════════════════════════════════════════════════ */
'use strict';

function showProperties(ws, id) {
	const node = ws.nodes.find((n) => n.id === id);
	if (!node) return;

	const out = ws.edges.filter((e) => e.source.id === id);
	const inc = ws.edges.filter((e) => e.target.id === id);

	let html = `
    <div class="props-node-hdr">
      <div class="props-node-id">${node.id}</div>
      <div class="props-node-meta">${out.length} out · ${inc.length} in</div>
    </div>`;

	const attrs = Object.entries(node.attributes || {});
	if (attrs.length) {
		html += '<div class="props-sec-hdr">Attributes</div>';
		attrs.forEach(([k, v]) => {
			html += `<div class="props-row">
        <span class="pk">${k}</span>
        <span class="pv">${v}</span>
      </div>`;
		});
	}

	if (out.length) {
		html += '<div class="props-sec-hdr">Outgoing</div>';
		out.forEach((e) => {
			html += `<div class="edge-row" data-goto="${e.target.id}">
        <span class="eout">→</span>
        <span class="etgt">${e.target.id}</span>
        ${e.label ? `<span class="elbl">${e.label}</span>` : ''}
      </div>`;
		});
	}

	if (inc.length) {
		html += '<div class="props-sec-hdr">Incoming</div>';
		inc.forEach((e) => {
			html += `<div class="edge-row" data-goto="${e.source.id}">
        <span class="ein">←</span>
        <span class="etgt">${e.source.id}</span>
        ${e.label ? `<span class="elbl">${e.label}</span>` : ''}
      </div>`;
		});
	}

	ws.propsBody.innerHTML = html;
	ws.propsBody
		.querySelectorAll('.edge-row')
		.forEach((el) =>
			el.addEventListener('click', () => selectNode(ws, el.dataset.goto)),
		);
}

function clearProperties(ws) {
	ws.propsBody.innerHTML =
		'<div class="props-empty">Select a node to inspect</div>';
}
