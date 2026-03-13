/* ══════════════════════════════════════════════════════════════
   graph.js — D3 force simulation over plugin-rendered SVG.

   The plugin has ALREADY rendered nodes and edges into:
     #main-view  (the SVG root)
     #nodes      (group containing elements with [node] attr)
     #edges      (group containing elements with [edge] attr)

   This file only moves what the plugin drew — never re-renders.
   ══════════════════════════════════════════════════════════════ */
'use strict';

/* ── Top-level geometry helpers ───────────────────────────────── */
function _ncx(n) { return n.tag === 'circle' || n.tag === 'ellipse' ? n.x + n.rx : n.x + n.w / 2; }
function _ncy(n) { return n.tag === 'circle' || n.tag === 'ellipse' ? n.y + n.ry : n.y + n.h / 2; }

function _nodeExit(n, ux, uy) {
  if (n.tag === 'circle' || n.tag === 'ellipse')
    return { x: _ncx(n) + ux * n.rx, y: _ncy(n) + uy * n.ry };
  const s = Math.min(
    ux ? (n.w / 2) / Math.abs(ux) : Infinity,
    uy ? (n.h / 2) / Math.abs(uy) : Infinity
  );
  return { x: _ncx(n) + ux * s, y: _ncy(n) + uy * s };
}

/* s and t are node objects (after forceLink mutation) */
function _edgePts(s, t) {
  const dx = _ncx(t) - _ncx(s), dy = _ncy(t) - _ncy(s);
  const len = Math.hypot(dx, dy);
  if (len < 1) return { x1: _ncx(s), y1: _ncy(s), x2: _ncx(t), y2: _ncy(t) };
  const ux = dx / len, uy = dy / len;
  const p1 = _nodeExit(s,  ux,  uy);
  const p2 = _nodeExit(t, -ux, -uy);
  return { x1: p1.x, y1: p1.y, x2: p2.x - ux * 3, y2: p2.y - uy * 3 };
}

function _pf(v, fallback) {
  const n = parseFloat(v);
  return isFinite(n) ? n : fallback;
}

function _readNode(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'circle' || tag === 'ellipse') {
    const rx = _pf(el.getAttribute('rx') ?? el.getAttribute('r'), 10);
    const ry = _pf(el.getAttribute('ry') ?? el.getAttribute('r'), 10);
    const cx = _pf(el.getAttribute('cx'), 0);
    const cy = _pf(el.getAttribute('cy'), 0);
    return { el, tag, x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2, rx, ry };
  }
  if (tag === 'g') {
    const tf = el.getAttribute('transform') || '';
    const m  = tf.match(/translate\(\s*([^,\s)]+)[,\s]+([^)]+)\)/);
    const x  = m ? _pf(m[1], 0) : 0;
    const y  = m ? _pf(m[2], 0) : 0;
    let w = 20, h = 20;
    el.querySelectorAll('rect').forEach(r => {
      const rw = _pf(r.getAttribute('width'),  0);
      const rh = _pf(r.getAttribute('height'), 0);
      if (rw * rh > w * h) { w = rw; h = rh; }
    });
    return { el, tag, x, y, w, h };
  }
  return {
    el, tag,
    x: _pf(el.getAttribute('x'),      0),
    y: _pf(el.getAttribute('y'),      0),
    w: _pf(el.getAttribute('width'),  20),
    h: _pf(el.getAttribute('height'), 20),
  };
}

/* ════════════════════════════════════════════════════════════════
   loadGraph
   ════════════════════════════════════════════════════════════════ */
function loadGraph(ws, data) {
  ws.graphData = data;
  ws.pane.querySelector('.graph-empty').style.display = 'none';

  const svgEl = ws.svgEl;
  if (!svgEl) return;

  const nodesContainer = svgEl.querySelector('#nodes');
  const edgesContainer = svgEl.querySelector('#edges');

  if (!nodesContainer) return;

  /* ── Nodes: elements with [node] attribute ───────────────────── */
  ws.nodes = [...nodesContainer.querySelectorAll('[node]')].map((el, i) => {
    const n    = _readNode(el);
    n.id       = el.dataset.id || (data.nodes[i] && data.nodes[i].id) || String(i);
    n.attributes = (data.nodes[i] && data.nodes[i].attributes) || {};
    return n;
  });

  /* ── Edges: elements with [edge] attribute ───────────────────── */
  /* source/target stored as integer indices; forceLink will mutate
     them into node object references after the first tick.         */
  ws.edges = [];
  if (edgesContainer) {
    [...edgesContainer.querySelectorAll('[edge]')].forEach((el, i) => {
      const si = parseInt(el.getAttribute('data-source'), 10);
      const ti = parseInt(el.getAttribute('data-target'), 10);
      if (isNaN(si) || isNaN(ti) || !ws.nodes[si] || !ws.nodes[ti] || si === ti) return;
      ws.edges.push({ id: `e${i}`, el, source: si, target: ti });
    });
  }

  /* ── Zoom — per-layer so plugin's coordinate system is preserved  */
  let currentTransform = d3.zoomIdentity;
  ws.zoom = d3.zoom()
    .scaleExtent([0.05, 8])
    .filter(ev => ev.type === 'wheel' || !ev.target.closest('[node]'))
    .on('zoom', ev => {
      currentTransform = ev.transform;
      if (nodesContainer) d3.select(nodesContainer).attr('transform', ev.transform);
      if (edgesContainer) d3.select(edgesContainer).attr('transform', ev.transform);
      ws.transform = ev.transform;
      updateBirdview(ws);
      if (ws.id === activeWsId)
        document.getElementById('sb-zoom').textContent =
          Math.round(ev.transform.k * 100) + '%';
    });
  d3.select(svgEl).call(ws.zoom).on('dblclick.zoom', null);
  d3.select(svgEl).on('click', () => selectNode(ws, null));

  /* ── Drag ─────────────────────────────────────────────────────── */
  function clientToSVG(cx, cy) {
    const rect = svgEl.getBoundingClientRect();
    return {
      x: (cx - rect.left - currentTransform.x) / currentTransform.k,
      y: (cy - rect.top  - currentTransform.y) / currentTransform.k,
    };
  }

  const drag = d3.drag()
    .on('start', function(ev) {
      ev.sourceEvent.stopPropagation();
      const n = d3.select(this).datum();
      if (!ev.active) ws.sim.alphaTarget(0.3).restart();
      n.fx = n.x; n.fy = n.y;
      d3.select(this).style('cursor', 'grabbing').raise();
    })
    .on('drag', function(ev) {
      const n   = d3.select(this).datum();
      const pos = clientToSVG(ev.sourceEvent.clientX, ev.sourceEvent.clientY);
      n.fx = pos.x - n.w / 2;
      n.fy = pos.y - n.h / 2;
    })
    .on('end', function(ev) {
      const n = d3.select(this).datum();
      if (!ev.active) ws.sim.alphaTarget(0);
      n.fx = null; n.fy = null;
      d3.select(this).style('cursor', 'grab');
    });

  ws.nodes.forEach(n => {
    d3.select(n.el).datum(n).style('cursor', 'grab').call(drag)
      .on('click',     (ev) => { ev.stopPropagation(); selectNode(ws, n.id); })
      .on('mouseover', ()   => hlNode(ws, n.id))
      .on('mouseout',  ()   => clearHl(ws));
  });

  /* ── Force simulation ─────────────────────────────────────────── */
  const mainView = ws.pane.querySelector('.main-view');
  const W = svgEl.clientWidth  || mainView?.clientWidth  || 900;
  const H = svgEl.clientHeight || mainView?.clientHeight || 600;
  const avgSize = ws.nodes.reduce((s, n) => s + Math.max(n.w, n.h), 0) / (ws.nodes.length || 1);

  if (ws.sim) ws.sim.stop();
  ws.sim = d3.forceSimulation(ws.nodes)
    .force('charge',    d3.forceManyBody().strength(ws.simParams.charge).distanceMax(600))
    .force('collision', d3.forceCollide().radius(n => Math.max(n.w, n.h) * 0.6 + ws.simParams.coll).strength(0.9))
    .force('link',      d3.forceLink(ws.edges).id((_, i) => i).distance(ws.simParams.link).strength(0.25))
    .force('cx',        d3.forceX(W / 2).strength(0.05))
    .force('cy',        d3.forceY(H / 2).strength(0.05))
    .alphaDecay(0.022)
    .velocityDecay(0.4)
    .on('tick', () => tick(ws))
    .on('end',  () => { updateBirdview(ws); });
  if (!ws.simRunning) ws.sim.stop();

  setTimeout(() => fitGraph(ws, true), 900);

  ws.tab.querySelector('.ws-dot').className =
    `ws-dot ${ws.nodes.length > 0 ? 'green' : 'empty'}`;
  if (ws.id === activeWsId) updateStatusBar(ws);

  buildTree(ws, data);
}

/* ── Tick ──────────────────────────────────────────────────────── */
function tick(ws) {
  ws.nodes.forEach(n => {
    if (!isFinite(n.x) || !isFinite(n.y)) return;
    if (n.tag === 'circle' || n.tag === 'ellipse') {
      n.el.setAttribute('cx', n.x + n.rx);
      n.el.setAttribute('cy', n.y + n.ry);
    } else if (n.tag === 'g') {
      n.el.setAttribute('transform', `translate(${n.x},${n.y})`);
    } else {
      n.el.setAttribute('x', n.x);
      n.el.setAttribute('y', n.y);
    }
  });

  /* forceLink mutates source/target from indices to node objects.
     Guard with typeof check — first tick may fire before mutation. */
  ws.edges.forEach(e => {
    const s = e.source, t = e.target;
    if (typeof s !== 'object' || typeof t !== 'object') return;
    if (!isFinite(s.x) || !isFinite(s.y) || !isFinite(t.x) || !isFinite(t.y)) return;
    const { x1, y1, x2, y2 } = _edgePts(s, t);
    e.el.setAttribute('x1', x1); e.el.setAttribute('y1', y1);
    e.el.setAttribute('x2', x2); e.el.setAttribute('y2', y2);
  });

  if (ws.sim && ws.sim.alpha() < 0.15) updateBirdview(ws);
}

/* ── Fit ───────────────────────────────────────────────────────── */
function fitGraph(ws, animate) {
  if (!ws.zoom || !ws.nodes.length) return;
  const W = ws.svgEl.clientWidth, H = ws.svgEl.clientHeight;
  if (!W || !H) return;
  const pad  = 60;
  const minX = Math.min(...ws.nodes.map(n => n.x));
  const maxX = Math.max(...ws.nodes.map(n => n.x + n.w));
  const minY = Math.min(...ws.nodes.map(n => n.y));
  const maxY = Math.max(...ws.nodes.map(n => n.y + n.h));
  const gW = maxX - minX || 1, gH = maxY - minY || 1;
  const s  = Math.min(0.95, Math.min((W - pad * 2) / gW, (H - pad * 2) / gH));
  const tx = (W - gW * s) / 2 - minX * s, ty = (H - gH * s) / 2 - minY * s;
  const target = d3.zoomIdentity.translate(tx, ty).scale(s);
  animate
    ? d3.select(ws.svgEl).transition().duration(480).ease(d3.easeCubicOut).call(ws.zoom.transform, target)
    : d3.select(ws.svgEl).call(ws.zoom.transform, target);
}

/* ── Selection ─────────────────────────────────────────────────── */
function selectNode(ws, id) {
  ws.selectedId = id;

  /* Nodes — highlight selected, restore others */
  ws.nodes.forEach(n => {
    const bg = n.el.querySelector('rect');
    if (!bg) return;
    if (!bg._origStroke) bg._origStroke = bg.getAttribute('stroke');
    bg.setAttribute('stroke', n.id === id ? '#00d9ff' : (bg._origStroke || ''));
  });

  /* Edges — highlight connected edges, dim the rest */
  ws.edges.forEach(e => {
    const s = e.source, t = e.target;
    if (typeof s !== 'object' || typeof t !== 'object') return;
    const connected = id && (s.id === id || t.id === id);
    e.el.classList.toggle('highlighted', !!connected);
    e.el.style.opacity = (!id || connected) ? '' : '0.2';
  });
  ws.pane.querySelectorAll('.tree-node').forEach(el =>
    el.classList.toggle('selected', el.dataset.id === id));
  if (id) showProperties(ws, id);
  else    clearProperties(ws);
  if (ws.id === activeWsId) {
    const sb = document.getElementById('sb-sel');
    if (id) { sb.style.display = 'flex'; document.getElementById('sb-sel-id').textContent = id; }
    else      sb.style.display = 'none';
  }
  updateBirdview(ws);
}

/* ── Hover highlight ────────────────────────────────────────────── */
function hlNode(ws, id) {
  const conn = new Set([id]);
  ws.edges.forEach(e => {
    const s = e.source, t = e.target;
    if (typeof s === 'object' && s.id === id) conn.add(t.id);
    if (typeof t === 'object' && t.id === id) conn.add(s.id);
  });
  ws.nodes.forEach(n => { n.el.style.opacity = conn.has(n.id) ? 1 : 0.2; });
  ws.edges.forEach(e => {
    const s = e.source, t = e.target;
    const hi = typeof s === 'object' && typeof t === 'object' &&
               (s.id === id || t.id === id);
    e.el.classList.toggle('highlighted', hi);
    e.el.style.opacity = hi ? 1 : 0.15;
  });
}

function clearHl(ws) {
  ws.nodes.forEach(n => { n.el.style.opacity = ''; });
  ws.edges.forEach(e => { e.el.classList.remove('highlighted'); e.el.style.opacity = ''; });
}

/* ── Fallback renderer (kept for API compat) ─────────────────── */
const _fallbackRenderer = {
  renderNode(g, d) {
    d.w = 120; d.h = 40;
    g.append('rect').attr('class', 'block-bg').attr('width', 120).attr('height', 40).attr('rx', 4);
    g.append('text').attr('x', 10).attr('y', 25)
      .attr('font-size', '11px').attr('font-family', 'JetBrains Mono,monospace')
      .attr('fill', '#dde1ec').text(d.id);
  },
};
