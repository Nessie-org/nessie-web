import {
  Component, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GraphService, Graph } from '../../services/graph.service';
import { LayoutService } from '../../services/layout.service';

@Component({
  selector: 'app-bird-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bird-wrapper" #wrapper>
      <canvas #canvas class="bird-canvas" (click)="onCanvasClick($event)"></canvas>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; overflow: hidden; }
    .bird-wrapper { width: 100%; height: 100%; background: #060e1a; }
    .bird-canvas  { display: block; width: 100%; height: 100%; cursor: crosshair; }
  `]
})
export class BirdViewComponent implements AfterViewInit, OnDestroy {

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('wrapper', { static: true }) wrapperRef!: ElementRef<HTMLDivElement>;

  private graphService  = inject(GraphService);
  private layoutService = inject(LayoutService);

  private ctx!: CanvasRenderingContext2D;
  private graph: Graph | null = null;
  private selectedNodeId: string | null = null;
  private viewport = { panX: 0, panY: 0, scale: 1 };
  private subscriptions = new Subscription();

  // Cached transform for click mapping
  private birdScale = 1;
  private birdOffsetX = 0;
  private birdOffsetY = 0;
  private graphMinX = 0;
  private graphMinY = 0;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    new ResizeObserver(() => {
      canvas.width  = this.wrapperRef.nativeElement.clientWidth;
      canvas.height = this.wrapperRef.nativeElement.clientHeight;
      this.render();
    }).observe(this.wrapperRef.nativeElement);

    this.subscriptions.add(
      this.graphService.graph$.subscribe(g => { this.graph = g; this.render(); })
    );
    this.subscriptions.add(
      this.layoutService.selectedNodeId$.subscribe(id => { this.selectedNodeId = id; this.render(); })
    );
    this.subscriptions.add(
      this.layoutService.viewport$.subscribe(vp => { this.viewport = vp; this.render(); })
    );
  }

  render(): void {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;
    const W = canvas.width, H = canvas.height;
    if (!W || !H) return;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#060e1a';
    ctx.fillRect(0, 0, W, H);

    if (!this.graph || this.graph.nodes.length === 0) {
      ctx.fillStyle = 'rgba(42,106,170,0.2)';
      ctx.font = '11px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No graph', W / 2, H / 2);
      return;
    }

    const pad = 14;
    const xs = this.graph.nodes.map(n => n.x ?? 0);
    const ys = this.graph.nodes.map(n => n.y ?? 0);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const gw = maxX - minX || 1, gh = maxY - minY || 1;
    const s  = Math.min((W - pad * 2) / gw, (H - pad * 2) / gh);
    const ox = pad + (W - pad * 2 - gw * s) / 2;
    const oy = pad + (H - pad * 2 - gh * s) / 2;

    // Cache for click mapping
    this.birdScale = s;
    this.birdOffsetX = ox;
    this.birdOffsetY = oy;
    this.graphMinX = minX;
    this.graphMinY = minY;

    const toS = (x: number, y: number) => ({
      sx: ox + (x - minX) * s,
      sy: oy + (y - minY) * s,
    });

    // Edges
    ctx.strokeStyle = 'rgba(0,150,200,0.3)';
    ctx.lineWidth = 0.8;
    for (const e of this.graph.edges) {
      const src = this.graph.nodes.find(n => n.id === e.source);
      const tgt = this.graph.nodes.find(n => n.id === e.target);
      if (!src || !tgt || src.id === tgt.id) continue;
      const a = toS(src.x ?? 0, src.y ?? 0);
      const b = toS(tgt.x ?? 0, tgt.y ?? 0);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }

    // Nodes
    const nr = Math.max(3, Math.min(6, s * 10));
    for (const node of this.graph.nodes) {
      const { sx, sy } = toS(node.x ?? 0, node.y ?? 0);
      const isSel = node.id === this.selectedNodeId;
      if (isSel) {
        ctx.beginPath();
        ctx.arc(sx, sy, nr + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,200,248,0.2)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(sx, sy, nr, 0, Math.PI * 2);
      ctx.fillStyle   = isSel ? '#00c8f8' : '#0f4070';
      ctx.fill();
      ctx.strokeStyle = isSel ? '#00c8f8' : '#1e4a7a';
      ctx.lineWidth   = isSel ? 1.5 : 0.8;
      ctx.stroke();
    }

    // ── Viewport rectangle ──────────────────────
    this.drawViewport(ctx, W, H, toS, gw, gh, minX, minY);
  }

  private drawViewport(
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    toS: (x: number, y: number) => { sx: number; sy: number },
    gw: number, gh: number,
    minX: number, minY: number
  ): void {
    const { panX, panY, scale } = this.viewport;
    if (scale <= 0) return;

    // The canvas size we're approximating (use 800×600 as typical main view)
    // We'll use a reasonable estimate based on bird canvas size ratios
    const mainW = W / this.birdScale * gw / W * W * 2;
    const mainH = H / this.birdScale * gh / H * H * 2;

    // viewport in world coords
    const vMinX = -panX / scale;
    const vMinY = -panY / scale;
    const vMaxX = vMinX + W / (this.birdScale * scale) * gw;
    const vMaxY = vMinY + H / (this.birdScale * scale) * gh;

    const a = toS(vMinX, vMinY);
    const b = toS(vMaxX, vMaxY);

    ctx.strokeStyle = 'rgba(0,200,248,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(0,200,248,0.04)';
    ctx.fillRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy);
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.graph) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const wx = (mx - this.birdOffsetX) / this.birdScale + this.graphMinX;
    const wy = (my - this.birdOffsetY) / this.birdScale + this.graphMinY;

    const hit = this.graph.nodes.find(n => {
      const dx = (n.x ?? 0) - wx, dy = (n.y ?? 0) - wy;
      return Math.sqrt(dx * dx + dy * dy) < 30;
    });
    this.layoutService.selectNode(hit?.id ?? null);
  }

  ngOnDestroy(): void { this.subscriptions.unsubscribe(); }
}
