/* ══════════════════════════════════════════════════════════════
   tree-view.js — Left sidebar: BFS tree grouped by connected
                  component, root = node with fewest in-edges.
   ══════════════════════════════════════════════════════════════ */
'use strict';

/* ── Wire expand/collapse buttons ────────────────────────────── */
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

/* ════════════════════════════════════════════════════════════════
   buildTree
   ════════════════════════════════════════════════════════════════ */
function buildTree(ws, data) {
  const container = ws.treeBody;
  container.innerHTML = '';

  if (!data.nodes || !data.nodes.length) {
    container.querySelector('.tree-empty') ||
      (container.innerHTML = '<div class="tree-empty">No nodes.</div>');
    return;
  }

  const directed = data.type === 'directed';

  /* ── Degree maps ─────────────────────────────────────────────── */
  // inDeg[id]  = number of edges pointing INTO id
  // outDeg[id] = number of edges going OUT of id
  const inDeg  = {}, outDeg = {};
  data.nodes.forEach(n => { inDeg[n.id] = 0; outDeg[n.id] = 0; });

  // outAdj[id] = [targetId, ...] — used for BFS traversal
  // undirAdj[id] = [neighborId, ...] — used for component detection
  const outAdj   = {}, undirAdj = {};
  data.nodes.forEach(n => { outAdj[n.id] = []; undirAdj[n.id] = []; });

  (data.edges || []).forEach(e => {
    const s = e.source, t = e.target;
    if (!inDeg.hasOwnProperty(s) || !inDeg.hasOwnProperty(t)) return;
    outDeg[s]++;
    inDeg[t]++;
    outAdj[s].push(t);
    undirAdj[s].push(t);
    undirAdj[t].push(s);
    if (!directed) {
      // undirected: symmetric
      outDeg[t]++;
      inDeg[s]++;
      outAdj[t].push(s);
    }
  });

  /* ── Connected components (undirected BFS) ───────────────────── */
  const visited   = new Set();
  const components = [];

  data.nodes.forEach(n => {
    if (visited.has(n.id)) return;
    const comp = [];
    const queue = [n.id];
    visited.add(n.id);
    while (queue.length) {
      const cur = queue.shift();
      comp.push(cur);
      undirAdj[cur].forEach(nb => {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
      });
    }
    components.push(comp);
  });

  /* ── Root selection per component ────────────────────────────── */
  function pickRoot(ids) {
    return ids.slice().sort((a, b) => {
      if (inDeg[a] !== inDeg[b]) return inDeg[a] - inDeg[b];   // fewer in-edges first
      if (outDeg[b] !== outDeg[a]) return outDeg[b] - outDeg[a]; // more out-edges first
      return String(a) < String(b) ? -1 : 1;                    // smaller id first
    })[0];
  }

  /* ── Render ──────────────────────────────────────────────────── */
  // globalPlaced tracks ids already rendered anywhere in the tree
  // (used to detect cross-refs)
  const globalPlaced = new Set();

  components.forEach((compIds, ci) => {
    const root = pickRoot(compIds);

    // Component wrapper
    const compWrap = document.createElement('div');
    compWrap.className = 'tree-component';

    _bfsRender(root, compWrap, 0);

    container.appendChild(compWrap);
  });

  /* ── BFS render ──────────────────────────────────────────────── */
  function _bfsRender(rootId, parentEl, _unused) {
    // BFS queue: { id, parentEl, depth }
    const queue = [{ id: rootId, parentEl, depth: 0 }];

    while (queue.length) {
      const { id, parentEl: pEl, depth } = queue.shift();

      const isRef = globalPlaced.has(id);
      globalPlaced.add(id);

      const children = !isRef ? outAdj[id] : [];

      const row      = _makeRow(id, depth, isRef, children.length > 0);
      pEl.appendChild(row);

      if (!isRef && children.length) {
        const kidsEl = document.createElement('div');
        kidsEl.className = 'tree-children open';
        pEl.appendChild(kidsEl);

        // Wire toggle
        const toggle = row.querySelector('.tree-toggle');
        if (toggle) {
          toggle.addEventListener('click', e => {
            e.stopPropagation();
            const open = kidsEl.classList.toggle('open');
            toggle.classList.toggle('open', open);
          });
        }

        children.forEach(childId => {
          queue.push({ id: childId, parentEl: kidsEl, depth: depth + 1 });
        });
      }
    }
  }

  /* ── Build one row element ───────────────────────────────────── */
  function _makeRow(id, depth, isRef, hasChildren) {
    const row = document.createElement('div');
    row.dataset.id = id;

    const indent = 8 + depth * 14;

    if (isRef) {
      // Cross-reference: styled differently, click scrolls to original
      row.className = 'tree-node tree-ref';
      row.style.paddingLeft = indent + 'px';
      row.innerHTML = `
        <span class="tree-ref-arrow">↩</span>
        <span class="tree-label">${id}</span>`;
      row.title = 'Already shown above — click to select';
      row.addEventListener('click', () => {
        selectNode(ws, id);
        // Scroll to the original row in the tree
        const orig = container.querySelector(`.tree-node:not(.tree-ref)[data-id="${id}"]`);
        if (orig) orig.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } else {
      row.className = 'tree-node';
      row.style.paddingLeft = indent + 'px';
      row.innerHTML = `
        ${hasChildren ? '<span class="tree-toggle open">▶</span>' : '<span class="tree-leaf"></span>'}
        <span class="tree-label">${id}</span>`;
      row.addEventListener('click', e => {
        if (e.target.classList.contains('tree-toggle')) return;
        selectNode(ws, id);
      });
    }

    return row;
  }
}
