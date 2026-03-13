/* ══════════════════════════════════════════════════════════════
   console.js — Per-workspace console panel.
   Messages come from the server; user commands go back as
   cli_execute actions.
   ══════════════════════════════════════════════════════════════ */
'use strict';

/* ── Wire console controls ───────────────────────────────────── */
function wireConsoleControls(ws) {
	const ci = ws.pane.querySelector('.con-input');
	const history = [];
	let histIdx = -1;
	ws._conHistory = history;

	ci.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			const v = ci.value.trim();
			if (!v) return;
			histIdx = -1;
			ci.value = '';
			conLog(ws, `nessie:~$ ${v}`, 'input');
			// BACK INTEGRATION
			backendAction('cli_execute', { command: v });
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (histIdx < history.length - 1) ci.value = history[++histIdx];
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			ci.value = histIdx > 0 ? history[--histIdx] : ((histIdx = -1), '');
		}
	});

	/* Clear console button */
	const clearBtn = ws.pane.querySelector('.con-clear');
	if (clearBtn) {
		clearBtn.addEventListener('click', () => {
			// BACK INTEGRATION
			backendAction('clear_console', {});
		});
	}

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
	(graphData.console_messages || []).forEach((m) => {
		if (m.type === 'input') {
			conInput(ws, m);
			if (ws._conHistory) ws._conHistory.unshift(m.message);
		} else {
			conLog(ws, m.message, m.type || 'info', m.timestamp);
		}
	});
}
