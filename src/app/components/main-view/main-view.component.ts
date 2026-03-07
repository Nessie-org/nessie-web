import {
  Component, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, inject, ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GraphService, Graph, GraphNode, GraphEdge, GraphTab } from '../../services/graph.service';
import { LayoutService } from '../../services/layout.service';
import { TerminalService } from '../../services/terminal.service';

@Component({
  selector: 'app-main-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './main-view.component.html',
  styleUrls: ['./main-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class MainViewComponent implements AfterViewInit, OnDestroy {

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('wrapper', { static: true }) wrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('renameInput') renameInputRef?: ElementRef<HTMLInputElement>;

  graphService  = inject(GraphService);
  layoutService = inject(LayoutService);
  terminalService = inject(TerminalService);
  private cdr   = inject(ChangeDetectorRef);

  private ctx!: CanvasRenderingContext2D;
  private graph: Graph | null = null;
  private subscriptions = new Subscription();

  // Pan & Zoom
  panX = 0; panY = 0; scale = 1;
  protected isPanning = false;
  private panStart = { x: 0, y: 0 };
  private panOrigin = { x: 0, y: 0 };
  private isDraggingNode = false;
  private dragNodeId: string | null = null;

  // Hover / Selection
  hoveredNodeId: string | null = null;
  selectedNodeId: string | null = null;

  // View mode
  viewMode: 'simple' | 'block' = 'simple';

  // Tabs state (local copy for rendering)
  tabs: GraphTab[] = [];
  activeTabId: string = '';
  renameValue = '';

  ngAfterViewInit(): void {
    this.setupCanvas();

    this.subscriptions.add(
      this.graphService.tabs$.subscribe(tabs => {
        this.tabs = tabs;
        this.cdr.markForCheck();
      })
    );
    this.subscriptions.add(
      this.graphService.activeTabId$.subscribe(id => {
        this.activeTabId = id;
        // Restore viewport for this tab
        const tab = this.graphService.tabs.find(t => t.id === id);
        if (tab) {
          this.panX = tab.viewport.panX;
          this.panY = tab.viewport.panY;
          this.scale = tab.viewport.scale;
        }
        this.cdr.markForCheck();
      })
    );
    this.subscriptions.add(
      this.graphService.graph$.subscribe(graph => {
        this.graph = graph;
        if (graph) this.fitToScreen();
        this.render();
      })
    );
    this.subscriptions.add(
      this.layoutService.selectedNodeId$.subscribe(id => {
        this.selectedNodeId = id;
        this.render();
      })
    );

    // Listen for terminal fit/zoom commands
    this.subscriptions.add(
      this.terminalService.commands$.subscribe(cmd => {
        if (!cmd) return;
        if (cmd.cmd === 'fit') { this.fitToScreen(); this.render(); }
        if (cmd.cmd === 'zoom') {
          const f = parseFloat(cmd.args[0]);
          if (!isNaN(f)) { this.scale = f; this.render(); }
        }
      })
    );

    new ResizeObserver(() => { this.resizeCanvas(); this.render(); })
      .observe(this.wrapperRef.nativeElement);
  }

  private setupCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    this.render();
  }

  resizeCanvas(): void {
    const w = this.wrapperRef.nativeElement;
    const c = this.canvasRef.nativeElement;
    c.width = w.clientWidth;
    c.height = w.clientHeight;
  }

  fitToScreen(): void {
    if (!this.graph || this.graph.nodes.length === 0) return;
    const canvas = this.canvasRef.nativeElement;
    const pad = 60;
    const xs = this.graph.nodes.map(n => n.x ?? 0);
    const ys = this.graph.nodes.map(n => n.y ?? 0);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const gw = maxX - minX || 1, gh = maxY - minY || 1;
    this.scale = Math.min((canvas.width - pad * 2) / gw, (canvas.height - pad * 2) / gh, 2);
    this.panX = (canvas.width - gw * this.scale) / 2 - minX * this.scale;
    this.panY = (canvas.height - gh * this.scale) / 2 - minY * this.scale;
    this.saveViewport();
  }

  private saveViewport(): void {
    this.graphService.saveViewport(this.panX, this.panY, this.scale);
    this.layoutService.updateViewport(this.panX, this.panY, this.scale);
  }

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  render(): void {
    if (!this.ctx) return;
    const c = this.canvasRef.nativeElement;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, c.width, c.height);
    this.drawGrid(ctx, c.width, c.height);

    if (!this.graph) {
      this.drawEmptyState(ctx, c.width, c.height);
      return;
    }

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.scale, this.scale);

    for (const edge of this.graph.edges) this.drawEdge(ctx, edge);
    for (const node of this.graph.nodes) this.drawNode(ctx, node);

    ctx.restore();
  }

  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.strokeStyle = 'rgba(30, 74, 122, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = (this.panX % 40 + 40) % 40; x < w; x += 40) {
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    for (let y = (this.panY % 40 + 40) % 40; y < h; y += 40) {
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  private drawEmptyState(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 200, 248, 0.15)';
    ctx.font = '56px serif';
    ctx.fillText('⬡', w / 2, h / 2 - 30);
    ctx.fillStyle = 'rgba(42, 106, 170, 0.4)';
    ctx.font = '14px Rajdhani, sans-serif';
    ctx.fillText('No graph loaded', w / 2, h / 2 + 20);
    ctx.fillStyle = 'rgba(42, 106, 170, 0.25)';
    ctx.font = '12px Rajdhani, sans-serif';
    ctx.fillText('File › Load Demo Graph  or  type "load demo" in terminal', w / 2, h / 2 + 42);
  }

  private drawEdge(ctx: CanvasRenderingContext2D, edge: GraphEdge): void {
    const src = this.graph!.nodes.find(n => n.id === edge.source);
    const tgt = this.graph!.nodes.find(n => n.id === edge.target);
    if (!src || !tgt) return;
    const sx = src.x ?? 0, sy = src.y ?? 0;
    const tx = tgt.x ?? 0, ty = tgt.y ?? 0;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 180, 220, 0.4)';
    ctx.lineWidth = 1.5;
    if (edge.source === edge.target) {
      ctx.arc(sx + 32, sy - 32, 22, 0, Math.PI * 2);
    } else {
      ctx.moveTo(sx, sy); ctx.lineTo(tx, ty);
    }
    ctx.stroke();

    if (edge.directed && edge.source !== edge.target) this.drawArrow(ctx, sx, sy, tx, ty);

    if (edge.label) {
      const mx = (sx + tx) / 2, my = (sy + ty) / 2;
      ctx.fillStyle = 'rgba(0, 180, 220, 0.6)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(edge.label, mx, my - 6);
    }
  }

  private drawArrow(ctx: CanvasRenderingContext2D, sx: number, sy: number, tx: number, ty: number): void {
    const r = 22, len = 10, ang = 0.45;
    const a = Math.atan2(ty - sy, tx - sx);
    const ex = tx - r * Math.cos(a), ey = ty - r * Math.sin(a);
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0, 180, 220, 0.6)';
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - len * Math.cos(a - ang), ey - len * Math.sin(a - ang));
    ctx.lineTo(ex - len * Math.cos(a + ang), ey - len * Math.sin(a + ang));
    ctx.closePath();
    ctx.fill();
  }

  private drawNode(ctx: CanvasRenderingContext2D, node: GraphNode): void {
    const x = node.x ?? 0, y = node.y ?? 0, r = 22;
    const isSel = node.id === this.selectedNodeId;
    const isHov = node.id === this.hoveredNodeId;

    if (isSel || isHov) {
      ctx.beginPath();
      ctx.arc(x, y, r + 8, 0, Math.PI * 2);
      ctx.fillStyle = isSel ? 'rgba(0,200,248,0.18)' : 'rgba(0,200,248,0.09)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, r);
    if (isSel)      { g.addColorStop(0, '#1a6090'); g.addColorStop(1, '#0a3060'); }
    else if (isHov) { g.addColorStop(0, '#155070'); g.addColorStop(1, '#082040'); }
    else            { g.addColorStop(0, '#0f3050'); g.addColorStop(1, '#061828'); }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = isSel ? '#00c8f8' : isHov ? '#0099cc' : '#1e4a7a';
    ctx.lineWidth = isSel ? 2.5 : 1.5;
    ctx.stroke();

    ctx.fillStyle = isSel ? '#00c8f8' : '#8ab4d4';
    ctx.font = `${isSel ? 600 : 400} 11px Rajdhani, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label, x, y);
    ctx.fillStyle = 'rgba(138,180,212,0.4)';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText(node.id, x, y + r + 10);
  }

  // ═══════════════════════════════════════════
  // MOUSE EVENTS
  // ═══════════════════════════════════════════
  onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    const { wx, wy } = this.toWorld(event);
    const hit = this.getNodeAt(wx, wy);
    if (hit && event.altKey) {
      // Alt+drag = move node
      this.isDraggingNode = true;
      this.dragNodeId = hit.id;
    } else {
      this.isPanning = true;
      this.panStart = { x: event.clientX, y: event.clientY };
      this.panOrigin = { x: this.panX, y: this.panY };
    }
  }

  onMouseMove(event: MouseEvent): void {
    const { wx, wy } = this.toWorld(event);

    if (this.isDraggingNode && this.dragNodeId && this.graph) {
      this.graphService.updateActiveGraph(g => ({
        ...g,
        nodes: g.nodes.map(n => n.id === this.dragNodeId ? { ...n, x: wx, y: wy } : n)
      }));
      this.render();
      this.saveViewport();
      return;
    }

    if (this.isPanning) {
      this.panX = this.panOrigin.x + (event.clientX - this.panStart.x);
      this.panY = this.panOrigin.y + (event.clientY - this.panStart.y);
      this.render();
      this.saveViewport();
      return;
    }

    const hovered = this.getNodeAt(wx, wy);
    const newId = hovered?.id ?? null;
    if (newId !== this.hoveredNodeId) {
      this.hoveredNodeId = newId;
      this.render();
    }
  }

  onMouseUp(event: MouseEvent): void {
    if (this.isDraggingNode) {
      this.isDraggingNode = false;
      this.dragNodeId = null;
      return;
    }
    if (this.isPanning) {
      const dx = Math.abs(event.clientX - this.panStart.x);
      const dy = Math.abs(event.clientY - this.panStart.y);
      if (dx < 4 && dy < 4) {
        const { wx, wy } = this.toWorld(event);
        const hit = this.getNodeAt(wx, wy);
        this.layoutService.selectNode(hit?.id ?? null);
      }
      this.isPanning = false;
    }
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mx = event.clientX - rect.left, my = event.clientY - rect.top;
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    this.panX = mx - (mx - this.panX) * delta;
    this.panY = my - (my - this.panY) * delta;
    this.scale = Math.max(0.05, Math.min(10, this.scale * delta));
    this.render();
    this.saveViewport();
  }

  private toWorld(event: MouseEvent): { wx: number; wy: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return {
      wx: (event.clientX - rect.left - this.panX) / this.scale,
      wy: (event.clientY - rect.top  - this.panY) / this.scale,
    };
  }

  private getNodeAt(wx: number, wy: number): GraphNode | null {
    if (!this.graph) return null;
    return this.graph.nodes.find(n => {
      const dx = (n.x ?? 0) - wx, dy = (n.y ?? 0) - wy;
      return Math.sqrt(dx * dx + dy * dy) < 24;
    }) ?? null;
  }

  // ═══════════════════════════════════════════
  // TAB MANAGEMENT
  // ═══════════════════════════════════════════
  selectTab(id: string): void {
    this.graphService.setActiveTab(id);
  }

  addTab(): void {
    this.graphService.addTab();
  }

  closeTab(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.graphService.closeTab(id);
  }

  startRename(tab: GraphTab, event: MouseEvent): void {
    event.stopPropagation();
    this.renameValue = tab.name;
    this.graphService.setTabRenaming(tab.id, true);
    setTimeout(() => this.renameInputRef?.nativeElement.select(), 0);
  }

  commitRename(tab: GraphTab): void {
    this.graphService.renameTab(tab.id, this.renameValue);
  }

  cancelRename(tab: GraphTab): void {
    this.graphService.setTabRenaming(tab.id, false);
  }

  onRenameKey(event: KeyboardEvent, tab: GraphTab): void {
    if (event.key === 'Enter') this.commitRename(tab);
    if (event.key === 'Escape') this.cancelRename(tab);
  }

  setViewMode(mode: 'simple' | 'block'): void {
    this.viewMode = mode;
    this.render();
  }

  loadDemo(): void {
    this.graphService.loadDemoGraph();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
