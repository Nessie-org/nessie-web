import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GraphService } from '../../services/graph.service';
import { LayoutService } from '../../services/layout.service';

export interface FilterConfig {
  nodeLabelContains: string;
  nodeIdContains: string;
  propertyKey: string;
  propertyValue: string;
  showOnlyConnected: boolean;
  maxDepth: number | null;
  edgeLabelContains: string;
}

@Component({
  selector: 'app-filters-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filters-panel.component.html',
  styleUrls: ['./filters-panel.component.scss']
})
export class FiltersPanelComponent implements OnDestroy {

  private graphService  = inject(GraphService);
  private layoutService = inject(LayoutService);

  filters: FilterConfig = {
    nodeLabelContains: '',
    nodeIdContains: '',
    propertyKey: '',
    propertyValue: '',
    showOnlyConnected: false,
    maxDepth: null,
    edgeLabelContains: '',
  };

  matchingNodes = 0;
  totalNodes = 0;
  matchingEdges = 0;
  totalEdges = 0;

  private sub = new Subscription();

  constructor() {
    this.sub.add(
      this.graphService.graph$.subscribe(() => this.applyFilters())
    );
  }

  applyFilters(): void {
    const g = this.graphService.getActiveGraph();
    if (!g) { this.matchingNodes = 0; this.totalNodes = 0; this.matchingEdges = 0; this.totalEdges = 0; return; }

    this.totalNodes = g.nodes.length;
    this.totalEdges = g.edges.length;

    const f = this.filters;

    const nodeMatch = (node: typeof g.nodes[0]) => {
      if (f.nodeLabelContains && !node.label.toLowerCase().includes(f.nodeLabelContains.toLowerCase())) return false;
      if (f.nodeIdContains && !node.id.toLowerCase().includes(f.nodeIdContains.toLowerCase())) return false;
      if (f.propertyKey) {
        const val = node.properties[f.propertyKey];
        if (val === undefined) return false;
        if (f.propertyValue && !String(val).toLowerCase().includes(f.propertyValue.toLowerCase())) return false;
      }
      return true;
    };

    this.matchingNodes = g.nodes.filter(nodeMatch).length;
    this.matchingEdges = f.edgeLabelContains
      ? g.edges.filter(e => (e.label ?? '').toLowerCase().includes(f.edgeLabelContains.toLowerCase())).length
      : g.edges.length;
  }

  resetFilters(): void {
    this.filters = {
      nodeLabelContains: '', nodeIdContains: '', propertyKey: '',
      propertyValue: '', showOnlyConnected: false, maxDepth: null, edgeLabelContains: '',
    };
    this.applyFilters();
  }

  get hasActiveFilters(): boolean {
    const f = this.filters;
    return !!(f.nodeLabelContains || f.nodeIdContains || f.propertyKey ||
              f.propertyValue || f.showOnlyConnected || f.maxDepth !== null || f.edgeLabelContains);
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }
}
