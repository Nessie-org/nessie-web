import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutService, PanelId } from '../../services/layout.service';
import { GraphService } from '../../services/graph.service';

interface MenuItem { label: string; items: MenuAction[]; }
interface MenuAction {
  type: 'action' | 'separator' | 'toggle';
  label?: string;
  shortcut?: string;
  panelId?: PanelId;
  action?: () => void;
}

@Component({
  selector: 'app-menubar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menubar.component.html',
  styleUrls: ['./menubar.component.scss']
})
export class MenubarComponent implements OnInit {

  layoutService = inject(LayoutService);
  graphService  = inject(GraphService);

  activeMenu: string | null = null;
  menus: MenuItem[] = [];

  ngOnInit(): void {
    this.menus = [
      {
        label: 'File',
        items: [
          { type: 'action', label: 'Load Demo Graph',   shortcut: 'Ctrl+D', action: () => { this.graphService.loadDemoGraph(); this.close(); } },
          { type: 'action', label: 'New Tab',           shortcut: 'Ctrl+T', action: () => { this.graphService.addTab(); this.close(); } },
          { type: 'separator' },
          { type: 'action', label: 'Export Active Graph as JSON', action: () => this.exportGraph() },
        ]
      },
      {
        label: 'View',
        items: [
          { type: 'toggle', label: 'Tree View',    shortcut: 'Ctrl+1', panelId: 'treeView' },
          { type: 'toggle', label: 'Bird View',    shortcut: 'Ctrl+2', panelId: 'birdView' },
          { type: 'toggle', label: 'Properties',  shortcut: 'Ctrl+3', panelId: 'properties' },
          { type: 'separator' },
          { type: 'toggle', label: 'Terminal',    shortcut: 'Ctrl+`', panelId: 'console' },
          { type: 'toggle', label: 'Filters',                          panelId: 'filters' },
          { type: 'separator' },
          { type: 'action', label: 'Reset Layout', action: () => window.location.reload() },
        ]
      },
      {
        label: 'Graph',
        items: [
          { type: 'action', label: 'Fit to Screen',   shortcut: 'Ctrl+Shift+F', action: () => { } },
          { type: 'separator' },
          { type: 'action', label: 'Simple Visualizer', action: () => { } },
          { type: 'action', label: 'Block Visualizer',  action: () => { } },
        ]
      },
      {
        label: 'Help',
        items: [
          { type: 'action', label: 'Terminal Commands', action: () => { this.close(); } },
          { type: 'action', label: 'About Nessie v0.1.0', action: () => { this.close(); } },
        ]
      }
    ];
  }

  toggle(label: string): void {
    this.activeMenu = this.activeMenu === label ? null : label;
  }

  close(): void { this.activeMenu = null; }

  exec(item: MenuAction): void {
    if (item.type === 'toggle' && item.panelId) {
      this.layoutService.togglePanel(item.panelId);
    } else if (item.type === 'action' && item.action) {
      item.action();
    }
    this.close();
  }

  private exportGraph(): void {
    const graph = this.graphService.getActiveGraph();
    if (graph) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' }));
      a.download = `${graph.name.replace(/\s+/g, '_')}.json`;
      a.click();
    }
    this.close();
  }
}
