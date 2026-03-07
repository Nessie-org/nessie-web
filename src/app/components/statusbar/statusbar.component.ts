import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GraphService } from '../../services/graph.service';
import { LayoutService } from '../../services/layout.service';

@Component({
  selector: 'app-statusbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="statusbar">
      <div class="sb-left">
        <span class="dot" [class.on]="!!(graphService.graph$ | async)"></span>
        @if (graphService.graph$ | async; as g) {
          <span class="item accent">{{ g.name }}</span>
          <span class="sep">|</span>
          <span class="item">{{ g.nodes.length }} nodes</span>
          <span class="sep">|</span>
          <span class="item">{{ g.edges.length }} edges</span>
          <span class="sep">|</span>
          <span class="item">{{ g.directed ? 'Directed' : 'Undirected' }}</span>
        } @else {
          <span class="item dim">No graph loaded</span>
        }
      </div>
      <div class="sb-right">
        @if (layoutService.selectedNodeId$ | async; as id) {
          <span class="item accent">◆ {{ id }}</span>
          <span class="sep">|</span>
        }
        <span class="item dim">Nessie Graph Explorer</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; flex-shrink: 0; }
    .statusbar {
      display: flex; align-items: center; justify-content: space-between;
      height: var(--statusbar-height); background: var(--bg-darkest);
      border-top: 1px solid var(--border-dim);
      padding: 0 12px; font-family: var(--font-mono); font-size: 11px;
    }
    .sb-left, .sb-right { display: flex; align-items: center; gap: 6px; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted);
           &.on { background: var(--success); box-shadow: 0 0 5px var(--success); } }
    .item { color: var(--text-dim); }
    .item.accent { color: var(--accent); }
    .item.dim { color: var(--text-muted); }
    .sep { color: var(--border); }
  `]
})
export class StatusbarComponent {
  graphService  = inject(GraphService);
  layoutService = inject(LayoutService);
}
