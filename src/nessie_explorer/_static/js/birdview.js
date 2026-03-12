/* ══════════════════════════════════════════════════════════════
   birdview.js — Right sidebar: canvas minimap.
   ══════════════════════════════════════════════════════════════ */
'use strict';

function wireBirdviewControls(ws) {
  const p      = ws.pane;
  const bvWrap = p.querySelector('.bv-wrap');

  p.querySelector('.bv-canvas').addEventListener('click', e => {
    if (!ws.zoom || !ws.nodes.length || !ws._bv) return;
    const rect = bvWrap.getBoundingClientRect();
    panToMinimap(ws, e.clientX - rect.left, e.clientY - rect.top);
  });

  const ro = new ResizeObserver(() => {
    if (ws.nodes.length) updateBirdview(ws);
  });
  ro.observe(bvWrap);
  if (ws.svgEl) ro.observe(ws.svgEl);
}

function updateBirdview(ws) {
  const canvas = ws.bvCanvas;
  const wrap   = canvas.parentElement;
  const ctx    = canvas.getContext('2d');
  const W = wrap.clientWidth, H = wrap.clientHeight;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  if (!ws.nodes.length) return;

  /* Use n.w / n.h (our node format) */
  const validNodes = ws.nodes.filter(n => isFinite(n.x) && isFinite(n.y));
  if (!validNodes.length) return;

  const P    = 10;
  const minX = Math.min(...validNodes.map(n => n.x));
  const maxX = Math.max(...validNodes.map(n => n.x + n.w));
  const minY = Math.min(...validNodes.map(n => n.y));
  const maxY = Math.max(...validNodes.map(n => n.y + n.h));
  const gW   = Math.max(1, maxX - minX), gH = Math.max(1, maxY - minY);
  const s    = Math.min((W - P*2) / gW, (H - P*2) / gH);
  const ox   = P + (W - P*2 - gW*s) / 2;
  const oy   = P + (H - P*2 - gH*s) / 2;
  ws._bv = { s, ox, oy, minX, minY };

  const bx = x => ox + (x - minX) * s;
  const by = y => oy + (y - minY) * s;

  /* Edges */
  ctx.strokeStyle = 'rgba(50,54,63,.9)'; ctx.lineWidth = .8;
  ws.edges.forEach(e => {
    const src = e.source, tgt = e.target;
    if (typeof src !== 'object' || typeof tgt !== 'object') return;
    if (!isFinite(src.x) || !isFinite(tgt.x)) return;
    ctx.beginPath();
    ctx.moveTo(bx(_ncx(src)), by(_ncy(src)));
    ctx.lineTo(bx(_ncx(tgt)), by(_ncy(tgt)));
    ctx.stroke();
  });

  /* Nodes */
  validNodes.forEach(n => {
    const nx = bx(n.x), ny = by(n.y);
    const nw = Math.max(4, n.w * s), nh = Math.max(3, n.h * s);
    ctx.fillStyle   = n.id === ws.selectedId ? 'rgba(0,217,255,.1)' : '#181b22';
    ctx.strokeStyle = n.id === ws.selectedId ? '#00d9ff'            : '#32363f';
    ctx.lineWidth   = n.id === ws.selectedId ? 1.2 : .7;
    rrRect(ctx, nx, ny, nw, nh, 1);
    ctx.fill(); ctx.stroke();
  });

  /* Viewport rectangle */
  if (!ws.svgEl) return;
  const svgW = ws.svgEl.clientWidth  || 900;
  const svgH = ws.svgEl.clientHeight || 600;
  const t    = ws.transform || d3.zoomIdentity;
  if (!isFinite(t.x) || !isFinite(t.y) || !isFinite(t.k) || t.k === 0) return;
  const vpX = (-t.x / t.k - minX) * s + ox;
  const vpY = (-t.y / t.k - minY) * s + oy;
  const vpW = (svgW / t.k) * s;
  const vpH = (svgH / t.k) * s;
  ctx.strokeStyle = 'rgba(0,217,255,.7)'; ctx.fillStyle = 'rgba(0,217,255,.04)';
  ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  rrRect(ctx, vpX, vpY, Math.max(6, vpW), Math.max(6, vpH), 2);
  ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
}

function rrRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath();
}

function panToMinimap(ws, mx, my) {
  if (!ws._bv || !ws.svgEl || !ws.zoom) return;
  const { s, ox, oy, minX, minY } = ws._bv;
  if (!isFinite(s) || s === 0) return;
  const gx   = (mx - ox) / s + minX;
  const gy   = (my - oy) / s + minY;
  const svgW = ws.svgEl.clientWidth  || 900;
  const svgH = ws.svgEl.clientHeight || 600;
  const k    = (ws.transform || d3.zoomIdentity).k;
  if (!isFinite(gx) || !isFinite(gy) || !isFinite(k)) return;
  const target = d3.zoomIdentity
    .translate(svgW / 2 - gx * k, svgH / 2 - gy * k)
    .scale(k);
  d3.select(ws.svgEl).transition().duration(300).call(ws.zoom.transform, target);
}
