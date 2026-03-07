import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type NodeValueType = number | string | Date | boolean;

export interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, NodeValueType>;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  directed: boolean;
  weight?: number;
}

export interface Graph {
  id: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  directed: boolean;
  acyclic: boolean;
}

export interface GraphTab {
  id: string;
  name: string;
  graph: Graph | null;
  isRenaming: boolean;
  viewport: { panX: number; panY: number; scale: number };
}

@Injectable({ providedIn: 'root' })
export class GraphService {

  private _tabs = new BehaviorSubject<GraphTab[]>([
    { id: 'tab-1', name: 'Graph 1', graph: null, isRenaming: false, viewport: { panX: 0, panY: 0, scale: 1 } }
  ]);
  tabs$ = this._tabs.asObservable();

  private _activeTabId = new BehaviorSubject<string>('tab-1');
  activeTabId$ = this._activeTabId.asObservable();

  // Emits whenever the active graph changes
  private _graph = new BehaviorSubject<Graph | null>(null);
  graph$ = this._graph.asObservable();

  constructor() {
    this._activeTabId.subscribe(id => {
      const tab = this._tabs.value.find(t => t.id === id);
      this._graph.next(tab?.graph ?? null);
    });
    this._tabs.subscribe(tabs => {
      const active = tabs.find(t => t.id === this._activeTabId.value);
      this._graph.next(active?.graph ?? null);
    });
  }

  get tabs(): GraphTab[] { return this._tabs.value; }
  get activeTabId(): string { return this._activeTabId.value; }
  get activeTab(): GraphTab | null {
    return this._tabs.value.find(t => t.id === this._activeTabId.value) ?? null;
  }
  getActiveGraph(): Graph | null { return this.activeTab?.graph ?? null; }
  getGraph(): Graph | null { return this.getActiveGraph(); }

  setActiveTab(tabId: string): void {
    const tab = this._tabs.value.find(t => t.id === tabId);
    if (tab) {
      this._activeTabId.next(tabId);
      this._graph.next(tab.graph);
    }
  }

  addTab(name?: string): GraphTab {
    const id = `tab-${Date.now()}`;
    const tabName = name ?? `Graph ${this._tabs.value.length + 1}`;
    const newTab: GraphTab = { id, name: tabName, graph: null, isRenaming: false, viewport: { panX: 0, panY: 0, scale: 1 } };
    this._tabs.next([...this._tabs.value, newTab]);
    this.setActiveTab(id);
    return newTab;
  }

  closeTab(tabId: string): void {
    const tabs = this._tabs.value;
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    this._tabs.next(newTabs);
    if (this._activeTabId.value === tabId) {
      this.setActiveTab(newTabs[Math.max(0, idx - 1)].id);
    }
  }

  renameTab(tabId: string, name: string): void {
    this._tabs.next(this._tabs.value.map(t =>
      t.id === tabId ? { ...t, name: name.trim() || t.name, isRenaming: false } : t
    ));
  }

  setTabRenaming(tabId: string, isRenaming: boolean): void {
    this._tabs.next(this._tabs.value.map(t =>
      t.id === tabId ? { ...t, isRenaming } : t
    ));
  }

  saveViewport(panX: number, panY: number, scale: number): void {
    const tabId = this._activeTabId.value;
    this._tabs.next(this._tabs.value.map(t =>
      t.id === tabId ? { ...t, viewport: { panX, panY, scale } } : t
    ));
  }

  setGraph(graph: Graph, tabId?: string): void {
    const id = tabId ?? this._activeTabId.value;
    this._tabs.next(this._tabs.value.map(t =>
      t.id === id ? { ...t, graph } : t
    ));
    if (id === this._activeTabId.value) {
      this._graph.next(graph);
    }
  }

  updateActiveGraph(updater: (g: Graph) => Graph): void {
    const tab = this.activeTab;
    if (!tab?.graph) return;
    this.setGraph(updater(tab.graph), tab.id);
  }

  addNode(node: GraphNode): void {
    this.updateActiveGraph(g => ({ ...g, nodes: [...g.nodes, node] }));
  }

  removeNode(nodeId: string): void {
    this.updateActiveGraph(g => ({
      ...g,
      nodes: g.nodes.filter(n => n.id !== nodeId),
      edges: g.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    }));
  }

  addEdge(edge: GraphEdge): void {
    this.updateActiveGraph(g => ({ ...g, edges: [...g.edges, edge] }));
  }

  removeEdge(edgeId: string): void {
    this.updateActiveGraph(g => ({ ...g, edges: g.edges.filter(e => e.id !== edgeId) }));
  }

  loadDemoGraph(tabId?: string): Graph {
    const demo: Graph = {
      id: 'demo-' + Date.now(),
      name: 'Demo Graph',
      directed: true,
      acyclic: false,
      nodes: [
        { id: 'n1', label: 'Node A', properties: { type: 'root',  value: 42,      since: new Date('2023-01-01') }, x: 400, y: 200 },
        { id: 'n2', label: 'Node B', properties: { type: 'child', value: 3.14 },                                   x: 200, y: 380 },
        { id: 'n3', label: 'Node C', properties: { type: 'child', value: 'hello' },                                x: 600, y: 380 },
        { id: 'n4', label: 'Node D', properties: { type: 'leaf',  value: 99 },                                     x: 100, y: 560 },
        { id: 'n5', label: 'Node E', properties: { type: 'leaf',  value: 7 },                                      x: 300, y: 560 },
        { id: 'n6', label: 'Node F', properties: { type: 'leaf',  value: 'world' },                                x: 700, y: 560 },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', directed: true },
        { id: 'e2', source: 'n1', target: 'n3', directed: true },
        { id: 'e3', source: 'n2', target: 'n4', directed: true },
        { id: 'e4', source: 'n2', target: 'n5', directed: true },
        { id: 'e5', source: 'n3', target: 'n6', directed: true },
        { id: 'e6', source: 'n4', target: 'n1', directed: true, label: 'cycle' },
      ]
    };
    this.setGraph(demo, tabId ?? this._activeTabId.value);
    return demo;
  }
}
