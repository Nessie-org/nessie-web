/* ══════════════════════════════════════════════════════════════
   tree-view.js — Left sidebar: BFS tree grouped by connected
                  component, root = node with fewest in-edges.
   ══════════════════════════════════════════════════════════════ */
'use strict';

/* ── Wire expand/collapse buttons ────────────────────────────── */
function wireTreeControls(ws) {
	const p = ws.pane;
	p.querySelector('.btn-expand-all').addEventListener('click', () => {
		p.querySelectorAll('.tree-children').forEach((el) => el.classList.add('open'));
		p.querySelectorAll('.tree-toggle').forEach((el) => el.classList.add('open'));
	});
	p.querySelector('.btn-collapse-all').addEventListener('click', () => {
		p.querySelectorAll('.tree-children').forEach((el) => el.classList.remove('open'));
		p.querySelectorAll('.tree-toggle').forEach((el) => el.classList.remove('open'));
	});
}

/* ════════════════════════════════════════════════════════════════
   buildTree
   ════════════════════════════════════════════════════════════════ */
function buildTree(ws, data) {
	const container = ws.treeBody;
	container.innerHTML = '';

	if (!data.nodes || !data.nodes.length) {
		container.innerHTML = '<div class="tree-empty">No nodes.</div>';
		return;
	}

	const directed = data.type === 'directed';

	/* ── Degree maps ─────────────────────────────────────────────── */
	const inDeg = {}, outDeg = {};
	data.nodes.forEach((n) => { inDeg[n.id] = 0; outDeg[n.id] = 0; });

	const outAdj = {}, undirAdj = {};
	data.nodes.forEach((n) => { outAdj[n.id] = []; undirAdj[n.id] = []; });

	(data.edges || []).forEach((e) => {
		const s = e.source, t = e.target;
		if (!(s in inDeg) || !(t in inDeg)) return;
		outDeg[s]++;
		inDeg[t]++;
		outAdj[s].push(t);
		undirAdj[s].push(t);
		undirAdj[t].push(s);
		if (!directed) {
			outDeg[t]++;
			inDeg[s]++;
			outAdj[t].push(s);
		}
	});

	/* ── Connected components (undirected BFS) ───────────────────── */
	const visitedComp = new Set();
	const components = [];

	data.nodes.forEach((n) => {
		if (visitedComp.has(n.id)) return;
		const comp = [];
		const queue = [n.id];
		visitedComp.add(n.id);
		while (queue.length) {
			const cur = queue.shift();
			comp.push(cur);
			undirAdj[cur].forEach((nb) => {
				if (!visitedComp.has(nb)) { visitedComp.add(nb); queue.push(nb); }
			});
		}
		components.push(comp);
	});

	/* ── Root selection per component ────────────────────────────── */
	function pickRoot(ids) {
		return ids.slice().sort((a, b) => {
			if (inDeg[a] !== inDeg[b]) return inDeg[a] - inDeg[b];
			if (outDeg[b] !== outDeg[a]) return outDeg[b] - outDeg[a];
			return String(a) < String(b) ? -1 : 1;
		})[0];
	}

	/* ── globalPlaced tracks every rendered node id ──────────────── */
	const globalPlaced = new Set();

	/* ── Render all components ───────────────────────────────────── */
	components.forEach((compIds) => {
		const compSet = new Set(compIds);
		const compWrap = document.createElement('div');
		compWrap.className = 'tree-component';

		/* Keep rendering BFS sub-trees until every node in the
		   component has been placed. Nodes unreachable via out-edges
		   from earlier roots become roots of their own sub-tree.    */
		while (true) {
			// Find next unplaced node in this component
			const unplaced = compIds.filter(id => !globalPlaced.has(id));
			if (!unplaced.length) break;

			// Pick the best root among unplaced nodes
			const root = pickRoot(unplaced);
			_bfsRender(root, compWrap, 0);
		}

		container.appendChild(compWrap);
	});

	/* ── BFS render from one root ────────────────────────────────── */
	function _bfsRender(rootId, parentEl, _unused) {
		const queue = [{ id: rootId, parentEl, depth: 0 }];

		while (queue.length) {
			const { id, parentEl: pEl, depth } = queue.shift();

			const isRef = globalPlaced.has(id);
			globalPlaced.add(id);

			// Only follow out-edges for unvisited nodes
			const children = isRef ? [] : outAdj[id].filter(cid => true);

			const row = _makeRow(id, depth, isRef, children.length > 0);
			pEl.appendChild(row);

			if (!isRef && children.length) {
				const kidsEl = document.createElement('div');
				kidsEl.className = 'tree-children open';
				pEl.appendChild(kidsEl);

				const toggle = row.querySelector('.tree-toggle');
				if (toggle) {
					toggle.addEventListener('click', (e) => {
						e.stopPropagation();
						const open = kidsEl.classList.toggle('open');
						toggle.classList.toggle('open', open);
					});
				}

				children.forEach((childId) => {
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
			row.className = 'tree-node tree-ref';
			row.style.paddingLeft = indent + 'px';
			row.innerHTML = `
				<span class="tree-ref-arrow">↩</span>
				<span class="tree-label">${id}</span>`;
			row.title = 'Already shown above — click to select';
			row.addEventListener('click', () => {
				selectNode(ws, id);
				const orig = container.querySelector(`.tree-node:not(.tree-ref)[data-id="${id}"]`);
				if (orig) orig.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			});
		} else {
			row.className = 'tree-node';
			row.style.paddingLeft = indent + 'px';
			row.innerHTML = `
				${hasChildren ? '<span class="tree-toggle open">▶</span>' : '<span class="tree-leaf"></span>'}
				<span class="tree-label">${id}</span>`;
			row.addEventListener('click', (e) => {
				if (e.target.classList.contains('tree-toggle')) return;
				selectNode(ws, id);
			});
		}

		return row;
	}
}