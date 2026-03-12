/* ══════════════════════════════════════════════════════════════
   console.js — Per-workspace console panel.
   Messages and inputs come from the server.
   User input is sent back to the server (TODO).
   ══════════════════════════════════════════════════════════════ */
'use strict';

/* ── Wire console controls ───────────────────────────────────── */
function wireConsoleControls(ws) {
  const ci = ws.pane.querySelector('.con-input');
  const history = []; let histIdx = -1;
  ws._conHistory = history; // exposed so loadServerConsoleMessages can prepopulate

  ci.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const v = ci.value.trim(); if (!v) return;
      history.unshift(v); histIdx = -1; ci.value = '';
      conLog(ws, `nessie:~$ ${v}`, 'input');
      // TODO: send command to server
      alert(`TODO: Send command to server — ${v}`);
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
  ws.conOutput.addEventListener('click', () => ci.focus());
}

/* ── Append a plain log line ─────────────────────────────────── */
function conLog(ws, msg, type = 'info', ts = null) {
  const el = document.createElement('div');
  el.className = `con-line ${type}`;
  const tsStr = ts || new Date().toTimeString().slice(0, 8);
  el.innerHTML = `<span class="con-ts">${tsStr}</span><span class="con-msg">${msg}</span>`;
  ws.conOutput.appendChild(el);
  ws.conOutput.scrollTop = ws.conOutput.scrollHeight;
}

/* ── Append an input prompt row (click → populate console input) */
function conInput(ws, m) {
  const el = document.createElement('div');
  el.className = 'con-line con-input-row';
  const ts = m.timestamp || new Date().toTimeString().slice(0, 8);

  el.innerHTML = `
    <span class="con-ts">${ts}</span>
    <span class="con-prompt-arrow">▶</span>
    <span class="con-input-label">${m.message}</span>`;

  el.title = 'Click to populate input';
  el.addEventListener('click', () => {
    const ci = ws.pane.querySelector('.con-input');
    ci.value = m.message;
    ci.focus();
  });

  ws.conOutput.appendChild(el);
  ws.conOutput.scrollTop = ws.conOutput.scrollHeight;
}

/* ── Load server-provided console messages ───────────────────── */
function loadServerConsoleMessages(ws, graphData) {
  (graphData.console_messages || []).forEach(m => {
    if (m.type === 'input') {
      conInput(ws, m);
      // unshift so arrow-up shows the last INPUT first
      if (ws._conHistory) ws._conHistory.unshift(m.message);
    } else {
      conLog(ws, m.message, m.type || 'info', m.timestamp);
    }
  });
}
