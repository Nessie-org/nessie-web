/* ══════════════════════════════════════════════════════════════
   tree-view.js — Left sidebar: hierarchical node tree,
                  grouped by node attribute "type".
   ══════════════════════════════════════════════════════════════ */
'use strict';

const TREE_COLOR = {
  module:   '#00d9ff',
  class:    '#3ddc84',
  function: '#ffb347',
  external: '#8b90a0',
  pipeline: '#a78bfa',
  ml:       '#f87171',
  storage:  '#34d399',
  infra:    '#fbbf24',
};

/* ── Wire tree expand/collapse buttons ─────────────────────── */
function wireTreeControls(ws) {
  const p = ws.pane;
  p.querySelector('.btn-expand-all').addEventListener('click', () => {
    p.querySelectorAll('.tree-children').forEach(el => el.classList.add('open'));
    p.querySelectorAll('.tree-toggle').forEach(el => el.classList.add('open'));
  });
  p.querySelector('.btn-collapse-all').addEventListener('click', () => {
    p.querySelectorAll('.tree-children').forEach(el => el.classList.remove('open'));
    p.querySelectorAll('.tree-toggle').forEach(el => el.classList.remove('open'));
  });
}

/* ── Build the full tree from graph data ───────────────────── */
function buildTree(ws, data) {
  const container = ws.treeBody;
  container.innerHTML = '';

  /* Group nodes by their "type" attribute */
  const groups = {};
  data.nodes.forEach(n => {
    const t = (n.attributes && n.attributes.type) || 'other';
    (groups[t] = groups[t] || []).push(n);
  });

  Object.entries(groups).forEach(([type, nodes]) => {
    const col = TREE_COLOR[type] || '#8b90a0';

    const wrap = document.createElement('div');
    const hdr  = document.createElement('div');
    const kids = document.createElement('div');

    hdr.className  = 'tree-group';
    kids.className = 'tree-children open';

    hdr.innerHTML = `
      <span class="tree-toggle open">▶</span>
      <span class="tree-color" style="background:${col}"></span>
      <span>${type}</span>
      <span class="tree-count">${nodes.length}</span>`;

    nodes.forEach(n => {
      const row = document.createElement('div');
      row.className  = 'tree-node';
      row.dataset.id = n.id;
      row.innerHTML  = `
        <span class="tree-dot" style="background:${col}"></span>
        <span class="tree-label">${n.id}</span>`;
      row.addEventListener('click', () => selectNode(ws, n.id));
      kids.appendChild(row);
    });

    hdr.addEventListener('click', () => {
      const open = kids.classList.toggle('open');
      hdr.querySelector('.tree-toggle').classList.toggle('open', open);
    });

    wrap.appendChild(hdr);
    wrap.appendChild(kids);
    container.appendChild(wrap);
  });
}
