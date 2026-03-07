import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type PanelId = 'treeView' | 'birdView' | 'mainView' | 'console' | 'properties' | 'filters';

export interface PanelState {
  treeView: boolean;
  birdView: boolean;
  mainView: boolean;
  console: boolean;
  properties: boolean;
  filters: boolean;
}

export interface ViewportState {
  panX: number;
  panY: number;
  scale: number;
}

@Injectable({ providedIn: 'root' })
export class LayoutService {

  private _panelState = new BehaviorSubject<PanelState>({
    treeView: true, birdView: true, mainView: true,
    console: true, properties: true, filters: true
  });
  panelState$ = this._panelState.asObservable();

  // Selected node (cross-panel sync)
  private _selectedNodeId = new BehaviorSubject<string | null>(null);
  selectedNodeId$ = this._selectedNodeId.asObservable();

  // Viewport state for bird view sync
  private _viewport = new BehaviorSubject<ViewportState>({ panX: 0, panY: 0, scale: 1 });
  viewport$ = this._viewport.asObservable();

  // Active bottom tab: 'terminal' | 'filters'
  private _bottomTab = new BehaviorSubject<'terminal' | 'filters'>('terminal');
  bottomTab$ = this._bottomTab.asObservable();

  togglePanel(panelId: PanelId): void {
    const c = this._panelState.value;
    this._panelState.next({ ...c, [panelId]: !c[panelId] });
  }

  isPanelVisible(panelId: PanelId): boolean {
    return this._panelState.value[panelId];
  }

  selectNode(nodeId: string | null): void {
    this._selectedNodeId.next(nodeId);
  }

  updateViewport(panX: number, panY: number, scale: number): void {
    this._viewport.next({ panX, panY, scale });
  }

  setBottomTab(tab: 'terminal' | 'filters'): void {
    this._bottomTab.next(tab);
  }
}
