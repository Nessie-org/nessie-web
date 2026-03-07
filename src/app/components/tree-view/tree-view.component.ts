import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GraphService, Graph, GraphNode } from '../../services/graph.service';
import { LayoutService } from '../../services/layout.service';

export interface TreeNode {
  graphNode: GraphNode;
  children: TreeNode[];
  expanded: boolean;
  depth: number;
  isRecursive?: boolean;
}

@Component({
  selector: 'app-tree-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tree-view.component.html',
  styleUrls: ['./tree-view.component.scss']
})
export class TreeViewComponent implements OnDestroy {
  graphService  = inject(GraphService);
  layoutService = inject(LayoutService);

  treeRoot: TreeNode | null = null;
  selectedNodeId: string | null = null;

  private subscriptions = new Subscription();

  constructor() {
    this.subscriptions.add(
      this.graphService.graph$.subscribe(graph => this.buildTree(graph))
    );
    this.subscriptions.add(
      this.layoutService.selectedNodeId$.subscribe(id => {
        this.selectedNodeId = id;
        if (id) this.expandToNode(id);
      })
    );
  }

  private buildTree(graph: Graph | null): void {
    if (!graph || graph.nodes.length === 0) { this.treeRoot = null; return; }
    const hasIncoming = new Set(graph.edges.map(e => e.target));
    const rootNode = graph.nodes.find(n => !hasIncoming.has(n.id)) ?? graph.nodes[0];
    this.treeRoot = this.buildTreeNode(rootNode, graph, new Set(), 0);
  }

  private buildTreeNode(node: GraphNode, graph: Graph, visited: Set<string>, depth: number): TreeNode {
    const isRecursive = visited.has(node.id);
    const treeNode: TreeNode = { graphNode: node, children: [], expanded: depth < 2, depth, isRecursive };
    if (!isRecursive) {
      visited.add(node.id);
      treeNode.children = graph.edges
        .filter(e => e.source === node.id)
        .map(e => graph.nodes.find(n => n.id === e.target))
        .filter(Boolean)
        .map(n => this.buildTreeNode(n!, graph, new Set(visited), depth + 1)) as TreeNode[];
    }
    return treeNode;
  }

  private expandToNode(nodeId: string): void {
    if (!this.treeRoot) return;
    this.expandPath(this.treeRoot, nodeId);
  }

  private expandPath(node: TreeNode, targetId: string): boolean {
    if (node.graphNode.id === targetId) return true;
    for (const child of node.children) {
      if (this.expandPath(child, targetId)) {
        node.expanded = true;
        return true;
      }
    }
    return false;
  }

  toggleNode(node: TreeNode): void { node.expanded = !node.expanded; }

  selectNode(node: TreeNode): void { this.layoutService.selectNode(node.graphNode.id); }

  getNodeIcon(node: TreeNode): string {
    if (node.isRecursive) return '↺';
    if (node.children.length === 0) return '◆';
    return node.expanded ? '▼' : '▶';
  }

  formatProps(node: GraphNode): string {
    return Object.entries(node.properties)
      .map(([k, v]) => `${k}: ${v instanceof Date ? v.toLocaleDateString() : v}`)
      .join('\n');
  }

  ngOnDestroy(): void { this.subscriptions.unsubscribe(); }
}
