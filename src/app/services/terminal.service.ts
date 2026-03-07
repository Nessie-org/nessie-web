import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GraphService } from './graph.service';
import { LayoutService } from './layout.service';

export interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'success' | 'info';
  text: string;
  timestamp?: Date;
}

const HELP_TEXT = `
Nessie Terminal — Graph Manipulation Commands
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Graph
  load demo              Load demo graph into active tab
  info                   Show graph info (nodes, edges, type)
  nodes                  List all nodes
  edges                  List all edges
  clear graph            Remove all nodes and edges

Nodes
  node <id>              Show node details
  add node <id> <label> [key=value ...]
  remove node <id>
  select <id>            Select node (syncs all panels)
  deselect               Clear selection

Edges
  add edge <id> <src> <tgt> [--label=text] [--undirected]
  remove edge <id>

Tabs
  newtab [name]          Open new graph tab
  rename [name]          Rename active tab
  tabs                   List open tabs

View
  fit                    Fit graph to screen
  zoom <factor>          Set zoom (e.g. zoom 1.5)

Other
  clear                  Clear terminal
  help                   Show this help
`.trim();

@Injectable({ providedIn: 'root' })
export class TerminalService {

  private graphService = inject(GraphService);
  private layoutService = inject(LayoutService);

  private _lines = new BehaviorSubject<TerminalLine[]>([
    { type: 'info', text: 'Nessie Terminal v0.1 — type "help" for commands' },
    { type: 'info', text: '─'.repeat(52) },
  ]);
  lines$ = this._lines.asObservable();

  // Emits commands that components need to act on (e.g., fit, zoom)
  private _commands = new BehaviorSubject<{ cmd: string; args: string[] } | null>(null);
  commands$ = this._commands.asObservable();

  execute(rawInput: string): void {
    const input = rawInput.trim();
    if (!input) return;

    this.addLine({ type: 'input', text: `> ${input}`, timestamp: new Date() });

    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
      this.dispatch(cmd, args, input);
    } catch (e: any) {
      this.addLine({ type: 'error', text: `Error: ${e.message}` });
    }
  }

  private dispatch(cmd: string, args: string[], raw: string): void {
    switch (cmd) {
      case 'help':    this.cmdHelp(); break;
      case 'clear':
        if (args[0] === 'graph') this.cmdClearGraph();
        else this.cmdClear();
        break;
      case 'load':    this.cmdLoad(args); break;
      case 'info':    this.cmdInfo(); break;
      case 'nodes':   this.cmdNodes(); break;
      case 'edges':   this.cmdEdges(); break;
      case 'node':    this.cmdNode(args); break;
      case 'add':     this.cmdAdd(args); break;
      case 'remove':  this.cmdRemove(args); break;
      case 'select':  this.cmdSelect(args); break;
      case 'deselect': this.cmdDeselect(); break;
      case 'newtab':  this.cmdNewTab(args); break;
      case 'rename':  this.cmdRename(args); break;
      case 'tabs':    this.cmdTabs(); break;
      case 'fit':     this._commands.next({ cmd: 'fit', args: [] }); this.ok('Fitting graph to screen'); break;
      case 'zoom':    this._commands.next({ cmd: 'zoom', args }); this.ok(`Zoom set to ${args[0] ?? '1'}`); break;
      default:        this.addLine({ type: 'error', text: `Unknown command: "${cmd}" — type "help" for list` });
    }
  }

  private cmdHelp(): void {
    HELP_TEXT.split('\n').forEach(line =>
      this.addLine({ type: 'output', text: line })
    );
  }

  private cmdClear(): void {
    this._lines.next([]);
  }

  private cmdClearGraph(): void {
    const g = this.graphService.getActiveGraph();
    if (!g) { this.err('No graph loaded'); return; }
    this.graphService.updateActiveGraph(graph => ({ ...graph, nodes: [], edges: [] }));
    this.ok('Graph cleared');
  }

  private cmdLoad(args: string[]): void {
    if (args[0] === 'demo') {
      const g = this.graphService.loadDemoGraph();
      this.ok(`Loaded demo graph: "${g.name}" — ${g.nodes.length} nodes, ${g.edges.length} edges`);
    } else {
      this.err('Usage: load demo');
    }
  }

  private cmdInfo(): void {
    const g = this.graphService.getActiveGraph();
    if (!g) { this.err('No graph loaded — try: load demo'); return; }
    this.out(`Name:     ${g.name}`);
    this.out(`ID:       ${g.id}`);
    this.out(`Nodes:    ${g.nodes.length}`);
    this.out(`Edges:    ${g.edges.length}`);
    this.out(`Directed: ${g.directed}`);
    this.out(`Acyclic:  ${g.acyclic}`);
  }

  private cmdNodes(): void {
    const g = this.graphService.getActiveGraph();
    if (!g) { this.err('No graph loaded'); return; }
    if (g.nodes.length === 0) { this.out('(no nodes)'); return; }
    this.out(`${'ID'.padEnd(8)} ${'Label'.padEnd(16)} Properties`);
    this.out('─'.repeat(52));
    g.nodes.forEach(n => {
      const props = Object.entries(n.properties).map(([k, v]) => `${k}=${v}`).join(', ');
      this.out(`${n.id.padEnd(8)} ${n.label.padEnd(16)} ${props}`);
    });
  }

  private cmdEdges(): void {
    const g = this.graphService.getActiveGraph();
    if (!g) { this.err('No graph loaded'); return; }
    if (g.edges.length === 0) { this.out('(no edges)'); return; }
    this.out(`${'ID'.padEnd(8)} ${'Source'.padEnd(8)} ${'Target'.padEnd(8)} Dir   Label`);
    this.out('─'.repeat(52));
    g.edges.forEach(e => {
      this.out(`${e.id.padEnd(8)} ${e.source.padEnd(8)} ${e.target.padEnd(8)} ${String(e.directed).padEnd(5)} ${e.label ?? ''}`);
    });
  }

  private cmdNode(args: string[]): void {
    if (!args[0]) { this.err('Usage: node <id>'); return; }
    const g = this.graphService.getActiveGraph();
    if (!g) { this.err('No graph loaded'); return; }
    const node = g.nodes.find(n => n.id === args[0]);
    if (!node) { this.err(`Node not found: ${args[0]}`); return; }
    this.out(`Node: ${node.id}`);
    this.out(`Label: ${node.label}`);
    this.out(`Position: (${node.x ?? 0}, ${node.y ?? 0})`);
    this.out('Properties:');
    Object.entries(node.properties).forEach(([k, v]) => this.out(`  ${k}: ${v}`));
    // Neighbors
    const out = g.edges.filter(e => e.source === node.id).map(e => e.target);
    const inc = g.edges.filter(e => e.target === node.id).map(e => e.source);
    if (out.length) this.out(`Outgoing → [${out.join(', ')}]`);
    if (inc.length) this.out(`Incoming ← [${inc.join(', ')}]`);
  }

  private cmdAdd(args: string[]): void {
    const type = args[0]?.toLowerCase();
    if (type === 'node') {
      const [, id, label, ...rest] = args;
      if (!id || !label) { this.err('Usage: add node <id> <label> [key=value ...]'); return; }
      const g = this.graphService.getActiveGraph();
      if (!g) { this.err('No graph loaded'); return; }
      if (g.nodes.find(n => n.id === id)) { this.err(`Node "${id}" already exists`); return; }
      const props: Record<string, any> = {};
      rest.forEach(kv => {
        const [k, v] = kv.split('=');
        if (k && v !== undefined) {
          const num = Number(v);
          props[k] = isNaN(num) ? v : num;
        }
      });
      // Auto-position
      const maxX = Math.max(...g.nodes.map(n => n.x ?? 0), 100);
      const maxY = Math.max(...g.nodes.map(n => n.y ?? 0), 100);
      this.graphService.addNode({ id, label, properties: props, x: maxX + 120, y: maxY / 2 + 100 });
      this.ok(`Added node: ${id} "${label}"`);
    } else if (type === 'edge') {
      const [, id, source, target, ...rest] = args;
      if (!id || !source || !target) { this.err('Usage: add edge <id> <src> <tgt> [--label=text] [--undirected]'); return; }
      const g = this.graphService.getActiveGraph();
      if (!g) { this.err('No graph loaded'); return; }
      if (!g.nodes.find(n => n.id === source)) { this.err(`Source node "${source}" not found`); return; }
      if (!g.nodes.find(n => n.id === target)) { this.err(`Target node "${target}" not found`); return; }
      const labelArg = rest.find(a => a.startsWith('--label='))?.split('=')?.[1];
      const directed = !rest.includes('--undirected');
      this.graphService.addEdge({ id, source, target, directed, label: labelArg });
      this.ok(`Added edge: ${id} ${source} ${directed ? '→' : '—'} ${target}${labelArg ? ` [${labelArg}]` : ''}`);
    } else {
      this.err('Usage: add node|edge ...');
    }
  }

  private cmdRemove(args: string[]): void {
    const type = args[0]?.toLowerCase();
    if (type === 'node') {
      if (!args[1]) { this.err('Usage: remove node <id>'); return; }
      const g = this.graphService.getActiveGraph();
      if (!g?.nodes.find(n => n.id === args[1])) { this.err(`Node not found: ${args[1]}`); return; }
      this.graphService.removeNode(args[1]);
      this.ok(`Removed node: ${args[1]}`);
    } else if (type === 'edge') {
      if (!args[1]) { this.err('Usage: remove edge <id>'); return; }
      this.graphService.removeEdge(args[1]);
      this.ok(`Removed edge: ${args[1]}`);
    } else {
      this.err('Usage: remove node|edge <id>');
    }
  }

  private cmdSelect(args: string[]): void {
    if (!args[0]) { this.err('Usage: select <nodeId>'); return; }
    const g = this.graphService.getActiveGraph();
    if (!g?.nodes.find(n => n.id === args[0])) { this.err(`Node not found: ${args[0]}`); return; }
    this.layoutService.selectNode(args[0]);
    this.ok(`Selected: ${args[0]}`);
  }

  private cmdDeselect(): void {
    this.layoutService.selectNode(null);
    this.ok('Selection cleared');
  }

  private cmdNewTab(args: string[]): void {
    const name = args.join(' ') || undefined;
    const tab = this.graphService.addTab(name);
    this.ok(`Opened new tab: "${tab.name}"`);
  }

  private cmdRename(args: string[]): void {
    if (!args[0]) { this.err('Usage: rename <new name>'); return; }
    const name = args.join(' ');
    const tabId = this.graphService.activeTabId;
    this.graphService.renameTab(tabId, name);
    this.ok(`Renamed tab to: "${name}"`);
  }

  private cmdTabs(): void {
    const tabs = this.graphService.tabs;
    const activeId = this.graphService.activeTabId;
    this.out(`${''.padEnd(2)}${'Name'.padEnd(20)} ${'Nodes'.padEnd(8)} Graph`);
    this.out('─'.repeat(52));
    tabs.forEach(t => {
      const active = t.id === activeId ? '▶ ' : '  ';
      const nodes = t.graph ? String(t.graph.nodes.length) : '—';
      const name = t.graph?.name ?? '(empty)';
      this.out(`${active}${t.name.padEnd(20)} ${nodes.padEnd(8)} ${name}`);
    });
  }

  private out(text: string): void  { this.addLine({ type: 'output', text }); }
  private ok(text: string): void   { this.addLine({ type: 'success', text }); }
  private err(text: string): void  { this.addLine({ type: 'error', text }); }

  private addLine(line: TerminalLine): void {
    this._lines.next([...this._lines.value, line]);
  }
}
