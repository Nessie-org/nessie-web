/* ══════════════════════════════════════════════════════════════
   filters.js — Node attribute filters.
   All filters in a workspace are ANDed together.
   ══════════════════════════════════════════════════════════════ */
'use strict';

function wireFilterControls(ws) {
  const p = ws.pane;
  p.querySelector('.filter-apply').addEventListener('click', () => applyFilter(ws));
  p.querySelector('.filter-reset').addEventListener('click', () => clearAllFilters(ws));
  p.querySelector('.filter-val').addEventListener('keydown', e => {
    if (e.key === 'Enter') applyFilter(ws);
  });
  p.querySelector('.fb-clear').addEventListener('click', () => clearAllFilters(ws));
}

/* ── Add a new filter from the filter bar inputs ───────────── */
function applyFilter(ws) {
  const attr = ws.pane.querySelector('.filter-attr').value.trim();
  const op   = ws.pane.querySelector('.filter-op').value;
  const rawV = ws.pane.querySelector('.filter-val').value.trim();
  if (!attr || !rawV) { conLog(ws, 'Enter attribute name and value.', 'warn'); return; }
  const val = isNaN(rawV) ? rawV : parseFloat(rawV);
  ws.activeFilters.push({ attr, op, val, expr: `${attr} ${op} ${rawV}` });
  ws.pane.querySelector('.filter-val').value = '';
  refreshFilterStack(ws);
  applyFiltersToGraph(ws);
  debouncedSave();
  conLog(ws, `Filter added: ${attr} ${op} ${rawV}`, 'info');
}

/* ── Remove one filter by index — called from onclick in HTML ─ */
function removeFilter(wsId, i) {
  const ws = getWs(wsId);
  if (!ws) return;
  ws.activeFilters.splice(i, 1);
  refreshFilterStack(ws);
  applyFiltersToGraph(ws);
  debouncedSave();
}

/* ── Remove all filters ─────────────────────────────────────── */
function clearAllFilters(ws) {
  ws.activeFilters = [];
  refreshFilterStack(ws);
  applyFiltersToGraph(ws);
  debouncedSave();
  conLog(ws, 'All filters cleared.', 'info');
}

/* ── Evaluate one filter against one node ───────────────────── */
function evalFilter(node, f) {
  const raw = (node.attributes || {})[f.attr];
  if (raw === undefined) return false;
  const nv = parseFloat(raw);
  switch (f.op) {
    case '==': return String(raw) === String(f.val);
    case '!=': return String(raw) !== String(f.val);
    case '<':  return !isNaN(nv) && nv <  f.val;
    case '<=': return !isNaN(nv) && nv <= f.val;
    case '>':  return !isNaN(nv) && nv >  f.val;
    case '>=': return !isNaN(nv) && nv >= f.val;
  }
  return false;
}

/* ── Show / hide nodes and edges based on active filters ─────── */
function applyFiltersToGraph(ws) {
  if (!ws.activeFilters.length) {
    d3.select(ws.svgEl).select('.nodes').selectAll('g.node').style('display', null);
    d3.select(ws.svgEl).select('.edges').selectAll('g.eg').style('display', null);
    ws.filterBanner.classList.remove('on');
    return;
  }
  const vis = new Set();
  ws.nodes.forEach(n => {
    if (ws.activeFilters.every(f => evalFilter(n, f))) vis.add(n.id);
  });
  d3.select(ws.svgEl).select('.nodes').selectAll('g.node')
    .style('display', d => vis.has(d.id) ? null : 'none');
  d3.select(ws.svgEl).select('.edges').selectAll('g.eg')
    .style('display', d => (vis.has(d.source.id) && vis.has(d.target.id)) ? null : 'none');
  const n = ws.activeFilters.length;
  ws.filterBannerTxt.textContent =
    `⚗ ${vis.size}/${ws.nodes.length} nodes — ${n} filter${n > 1 ? 's' : ''} active`;
  ws.filterBanner.classList.add('on');
}

/* ── Rebuild the filter stack UI ───────────────────────────── */
function refreshFilterStack(ws) {
  const badge = ws.filterBadge;
  badge.textContent     = ws.activeFilters.length;
  badge.style.display   = ws.activeFilters.length ? 'inline-flex' : 'none';

  if (!ws.activeFilters.length) {
    ws.filterStack.innerHTML = '<div class="filter-empty">No active filters</div>';
    return;
  }
  ws.filterStack.innerHTML = ws.activeFilters.map((f, i) => {
    const n = ws.nodes.filter(nd => evalFilter(nd, f)).length;
    return `<div class="filter-card">
      <span class="fc-expr">${f.expr}</span>
      <span class="fc-count">${n}n</span>
      <button class="fc-rm" onclick="removeFilter('${ws.id}',${i})">✕</button>
    </div>`;
  }).join('');
}
