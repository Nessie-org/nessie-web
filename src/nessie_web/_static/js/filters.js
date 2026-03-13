/* ══════════════════════════════════════════════════════════════
   filters.js — Node attribute filters.

   Active filters come from the server (adapter.get_active_filters_at).
   Apply / remove trigger a TODO alert — backend integration pending.
   ══════════════════════════════════════════════════════════════ */
'use strict';

function wireFilterControls(ws) {
  const p = ws.pane;

  /* Apply — clear attr field, alert TODO */
  p.querySelector('.filter-apply').addEventListener('click', () => {
    const attrEl = p.querySelector('.filter-attr');
    const attr   = attrEl.value.trim();
    const op     = p.querySelector('.filter-op').value;
    const val    = p.querySelector('.filter-val').value.trim();
    attrEl.value = '';
    if (!attr || !val) { conLog(ws, 'Enter attribute name and value.', 'warn'); return; }
    // TODO: send filter to backend
    alert(`TODO: Apply filter — ${attr} ${op} ${val}`);
  });

  /* Enter key in value field triggers apply */
  p.querySelector('.filter-val').addEventListener('keydown', e => {
    if (e.key === 'Enter') p.querySelector('.filter-apply').click();
  });

  /* Reset all — TODO */
  p.querySelector('.filter-reset').addEventListener('click', () => {
    // TODO: send clear-all-filters to backend
    alert('TODO: Clear all filters');
  });
}

/* ── Called from removeFilter onclick in refreshFilterStack ─── */
function removeFilter(wsId, i) {
  // TODO: send remove filter at index i to backend
  alert(`TODO: Remove filter at index ${i}`);
}

/* ── Rebuild filter stack from ws.activeFilters ─────────────── */
function refreshFilterStack(ws) {
  const badge = ws.filterBadge;
  badge.textContent   = ws.activeFilters.length;
  badge.style.display = ws.activeFilters.length ? 'inline-flex' : 'none';

  if (!ws.activeFilters.length) {
    ws.filterStack.innerHTML = '<div class="filter-empty">No active filters</div>';
    return;
  }

  ws.filterStack.innerHTML = ws.activeFilters.map((f, i) => `
    <div class="filter-card">
      <span class="fc-expr">${f.attr_name} ${f.operator} ${f.value}</span>
      <button class="fc-rm" onclick="removeFilter('${ws.id}',${i})">✕</button>
    </div>`
  ).join('');
}

/* ── Load server-provided filters into ws.activeFilters ─────── */
function loadServerFilters(ws, graphData) {
  ws.activeFilters = (graphData.active_filters || []);
  refreshFilterStack(ws);
}
