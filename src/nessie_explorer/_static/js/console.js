/* ══════════════════════════════════════════════════════════════
   console.js — Per-workspace console panel.
   Provides: conLog, handleConsoleInput, wireConsoleControls.
   ══════════════════════════════════════════════════════════════ */
'use strict';

/* ── Wire input + history for one workspace ────────────────── */
function wireConsoleControls(ws) {
  const ci = ws.pane.querySelector('.con-input');
  const history = []; let histIdx = -1;

  ci.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const v = ci.value.trim(); if (!v) return;
      history.unshift(v); histIdx = -1; ci.value = '';
      handleConsoleInput(ws, v);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx < history.length - 1) ci.value = history[++histIdx];
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      ci.value = histIdx > 0 ? history[--histIdx] : (histIdx = -1, '');
    }
  });
  /* Click anywhere on output → focus input */
  ws.conOutput.addEventListener('click', () => ci.focus());
}

/* ── Append a log line ──────────────────────────────────────── */
function conLog(ws, msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `con-line ${type}`;
  const ts = new Date().toTimeString().slice(0, 8);
  el.innerHTML = `<span class="con-ts">${ts}</span><span class="con-msg">${msg}</span>`;
  ws.conOutput.appendChild(el);
  ws.conOutput.scrollTop = ws.conOutput.scrollHeight;
}

/* ── Process a command string ───────────────────────────────── */
function handleConsoleInput(ws, raw) {
  conLog(ws, `nessie:~$ ${raw}`, 'input');
  const cmd = raw.trim().toLowerCase();

  /* zoom <k> */
  if (/^zoom\s+[\d.]+$/.test(cmd)) {
    const k = parseFloat(cmd.split(/\s+/)[1]);
    if (ws.zoom) d3.select(ws.svgEl).transition().duration(300).call(ws.zoom.scaleBy, k);
    conLog(ws, `Zoom ×${k}`, 'ok');
    return;
  }
  /* select <id> */
  if (/^select\s+\S/.test(cmd)) {
    const id = raw.trim().slice(7).trim();
    ws.nodes.find(n => n.id === id)
      ? selectNode(ws, id)
      : conLog(ws, `Node not found: ${id}`, 'warn');
    return;
  }
  /* filter <attr> <op> <val> */
  if (/^filter\s+\S/.test(cmd)) {
    // TODO: send filter to backend
    alert(`TODO: Apply filter — ${raw.trim().slice(7).trim()}`);
    return;
  }

  /* Named commands */
  const CMDS = {
    'help': () => [
      ['fit',           'Fit graph to screen'],
      ['zoom &lt;k&gt;',      'Multiply zoom (e.g. zoom 1.5)'],
      ['select &lt;id&gt;',   'Select node by id'],
      ['filter &lt;expr&gt;', 'Add filter (e.g. filter weight > 7)'],
      ['clear filters', 'Remove all filters'],
      ['reset sim',     'Reset simulation to defaults'],
      ['clear storage', 'Wipe localStorage and reload defaults'],
    ].forEach(([c, d]) =>
      conLog(ws, `&nbsp;&nbsp;<span style="color:var(--text-1)">${c}</span>&nbsp;—&nbsp;${d}`, 'info')
    ),
    'fit':           () => { fitGraph(ws, true); conLog(ws, 'Fit to screen.', 'ok'); },
    'clear filters': () => alert('TODO: Clear all filters'),
    'reset sim':     () => resetSim(ws),
    'clear storage': () => {
      localStorage.removeItem(LS_KEY);
      conLog(ws, 'Storage cleared. Refresh to reset to defaults.', 'ok');
    },
  };

  CMDS[cmd] ? CMDS[cmd]() : conLog(ws, `Unknown: "${cmd}". Type 'help'.`, 'warn');
}
