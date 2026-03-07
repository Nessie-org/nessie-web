import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { LayoutService } from '../../services/layout.service';
import { GraphService, GraphNode, GraphEdge } from '../../services/graph.service';

interface PropertyRow {
  key: string;
  value: string;
  type: string;
}

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './properties-panel.component.html',
  styleUrls: ['./properties-panel.component.scss']
})
export class PropertiesPanelComponent implements OnDestroy {

  private layoutService = inject(LayoutService);
  private graphService  = inject(GraphService);

  selectedNode: GraphNode | null = null;
  outgoing: { edge: GraphEdge; target: GraphNode | undefined }[] = [];
  incoming: { edge: GraphEdge; source: GraphNode | undefined }[] = [];
  properties: PropertyRow[] = [];

  private sub = new Subscription();

  constructor() {
    this.sub.add(
      this.layoutService.selectedNodeId$.subscribe(id => this.loadNode(id))
    );
    this.sub.add(
      this.graphService.graph$.subscribe(() => {
        const id = this.selectedNode?.id ?? null;
        this.loadNode(id);
      })
    );
  }

  private loadNode(id: string | null): void {
    if (!id) { this.selectedNode = null; this.properties = []; this.outgoing = []; this.incoming = []; return; }
    const g = this.graphService.getActiveGraph();
    if (!g) return;
    this.selectedNode = g.nodes.find(n => n.id === id) ?? null;
    if (!this.selectedNode) return;

    this.properties = Object.entries(this.selectedNode.properties).map(([key, value]) => ({
      key,
      value: value instanceof Date ? value.toLocaleDateString() : String(value),
      type: value instanceof Date ? 'date' : typeof value,
    }));

    this.outgoing = g.edges
      .filter(e => e.source === id)
      .map(e => ({ edge: e, target: g.nodes.find(n => n.id === e.target) }));

    this.incoming = g.edges
      .filter(e => e.target === id)
      .map(e => ({ edge: e, source: g.nodes.find(n => n.id === e.source) }));
  }

  selectNode(id: string): void {
    this.layoutService.selectNode(id);
  }

  getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      number: '#f0b429', string: '#00c8f8', boolean: '#00e5a0',
      date: '#c8a0f8', object: '#ff8a50',
    };
    return colors[type] ?? 'var(--text-dim)';
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }
}
