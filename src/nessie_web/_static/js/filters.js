/* ══════════════════════════════════════════════════════════════
   filters.js — Node attribute filters.
   All mutations go to the backend and trigger a full reload.
   ══════════════════════════════════════════════════════════════ */
'use strict';

function wireFilterControls(ws) {
	const p = ws.pane;

	/* Apply */
	p.querySelector('.filter-apply').addEventListener('click', () => {
		const attrEl = p.querySelector('.filter-attr');
		const valEl = p.querySelector('.filter-val');
		const attr = attrEl.value.trim();
		const op = p.querySelector('.filter-op').value;
		const val = valEl.value.trim();
		attrEl.value = '';
		valEl.value = '';
		if (!attr || !val) return;
		// BACK INTEGRATION
		backendAction('add_filter', {
			filter: {
				attr_name: attr,
				operator: op,
				value: isNaN(val) ? val : parseFloat(val),
			},
		});
	});

	/* Enter key in value field triggers apply */
	p.querySelector('.filter-val').addEventListener('keydown', (e) => {
		if (e.key === 'Enter') p.querySelector('.filter-apply').click();
	});

	/* Reset all */
	p.querySelector('.filter-reset').addEventListener('click', () => {
		// BACK INTEGRATION
		backendAction('clear_filters', {});
	});
}

/* ── Called from removeFilter onclick in refreshFilterStack ─── */
function removeFilter(wsId, filterJson) {
	// BACK INTEGRATION
	backendAction('remove_filter', { filter: JSON.parse(filterJson) });
}

/* ── Rebuild filter stack from ws.activeFilters ─────────────── */
function refreshFilterStack(ws) {
	const badge = ws.filterBadge;
	badge.textContent = ws.activeFilters.length;
	badge.style.display = ws.activeFilters.length ? 'inline-flex' : 'none';

	if (!ws.activeFilters.length) {
		ws.filterStack.innerHTML =
			'<div class="filter-empty">No active filters</div>';
		return;
	}

	ws.filterStack.innerHTML = ws.activeFilters
		.map((f) => {
			const json = JSON.stringify({
				attr_name: f.attr_name,
				operator: f.operator,
				value: f.value,
			}).replace(/'/g, '&#39;');
			return `<div class="filter-card">
      <span class="fc-expr">${f.attr_name} ${f.operator} ${f.value}</span>
      <button class="fc-rm" onclick="removeFilter('${ws.id}','${json.replace(/"/g, '&quot;')}')">✕</button>
    </div>`;
		})
		.join('');
}

/* ── Load server-provided filters into ws.activeFilters ─────── */
function loadServerFilters(ws, graphData) {
	ws.activeFilters = graphData.active_filters || [];
	refreshFilterStack(ws);
}
