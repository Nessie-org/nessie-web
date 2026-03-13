/* ══════════════════════════════════════════════════════════════
   resize.js — Drag-to-resize panel handles.

   Modes:
     'col'       — left column (drag right = wider)
     'col-right' — right column (drag left = wider)
     'row'       — bottom pane height (drag up = taller)
   ══════════════════════════════════════════════════════════════ */
'use strict';

function setupResizeHandle(handle, target, mode, min, max) {
  if (!handle || !target) return;

  const overlay = document.getElementById('drag-overlay');
  let startX, startY, startSize;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    handle.classList.add('dragging');
    overlay.classList.add('active');
    overlay.style.cursor = mode === 'row' ? 'row-resize' : 'col-resize';

    if (mode === 'row') { startY = e.clientY; startSize = target.offsetHeight; }
    else                { startX = e.clientX; startSize = target.offsetWidth;  }

    function onMove(ev) {
      let size;
      if (mode === 'row') {
        size = Math.max(min, Math.min(max, startSize - (ev.clientY - startY)));
        target.style.height     = size + 'px';
      } else if (mode === 'col-right') {
        size = Math.max(min, Math.min(max, startSize - (ev.clientX - startX)));
        target.style.width      = size + 'px';
      } else {
        size = Math.max(min, Math.min(max, startSize + (ev.clientX - startX)));
        target.style.width      = size + 'px';
      }
      target.style.flexBasis  = size + 'px';
      target.style.flexGrow   = '0';
      target.style.flexShrink = '0';
    }

    function onUp() {
      handle.classList.remove('dragging');
      overlay.classList.remove('active');
      overlay.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      /* Redraw birdview after resize */
      const ws = activeWs();
      if (ws && ws.nodes.length) setTimeout(() => updateBirdview(ws), 0);
      debouncedSave();
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  });
}
