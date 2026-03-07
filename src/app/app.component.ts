import {
  Component, OnDestroy, AfterViewInit,
  ViewChild, ElementRef,
  ApplicationRef, createComponent, EnvironmentInjector, ComponentRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import {
  GoldenLayout, LayoutConfig, ComponentItemConfig,
  ComponentContainer, RowOrColumnItemConfig, StackItemConfig, ItemType
} from 'golden-layout';

import { LayoutService } from './services/layout.service';
import { GraphService } from './services/graph.service';
import { MenubarComponent } from './components/menubar/menubar.component';
import { StatusbarComponent } from './components/statusbar/statusbar.component';
import { MainViewComponent } from './components/main-view/main-view.component';
import { TreeViewComponent } from './components/tree-view/tree-view.component';
import { BirdViewComponent } from './components/bird-view/bird-view.component';
import { ConsolePanelComponent } from './components/console-panel/console-panel.component';
import { PropertiesPanelComponent } from './components/properties-panel/properties-panel.component';
import { FiltersPanelComponent } from './components/filters-panel/filters-panel.component';

export const GL_COMPONENT = {
  MAIN_VIEW:  'MainView',
  TREE_VIEW:  'TreeView',
  BIRD_VIEW:  'BirdView',
  CONSOLE:    'Console',
  PROPERTIES: 'Properties',
  FILTERS:    'Filters',
} as const;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MenubarComponent, StatusbarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit, OnDestroy {

  @ViewChild('glContainer', { static: true }) glContainerRef!: ElementRef<HTMLDivElement>;

  private goldenLayout!: GoldenLayout;
  private componentRefs = new Map<ComponentContainer, ComponentRef<any>>();
  private subscriptions = new Subscription();

  private appRef      = inject(ApplicationRef);
  private envInjector = inject(EnvironmentInjector);
  layoutService       = inject(LayoutService);
  graphService        = inject(GraphService);

  ngAfterViewInit(): void {
    this.initGoldenLayout();
  }

  private initGoldenLayout(): void {
    const config: LayoutConfig = {
      settings: {
        showPopoutIcon: true,       // ← allows floating/detach
        showMaximiseIcon: true,
        showCloseIcon: true,
        responsiveMode: 'always',
        popoutWholeStack: false,
      },
      dimensions: {
        borderWidth: 4,
        headerHeight: 30,
      },
      root: {
        type: ItemType.column,
        content: [
          // ── TOP ROW ────────────────────────────────────────
          {
            type: ItemType.row,
            size: '72%',
            content: [
              // LEFT COLUMN: Tree + Bird stacked
              {
                type: ItemType.column,
                size: '22%',
                content: [
                  {
                    type: ItemType.stack,
                    size: '60%',
                    content: [{
                      type: ItemType.component,
                      componentType: GL_COMPONENT.TREE_VIEW,
                      title: '🌲 Tree View',
                      isClosable: true,
                    } as ComponentItemConfig]
                  } as StackItemConfig,
                  {
                    type: ItemType.stack,
                    size: '40%',
                    content: [{
                      type: ItemType.component,
                      componentType: GL_COMPONENT.BIRD_VIEW,
                      title: '🐦 Bird View',
                      isClosable: true,
                    } as ComponentItemConfig]
                  } as StackItemConfig,
                ]
              } as RowOrColumnItemConfig,

              // CENTER: Main View
              {
                type: ItemType.stack,
                size: '58%',
                content: [{
                  type: ItemType.component,
                  componentType: GL_COMPONENT.MAIN_VIEW,
                  title: '◈ Main View',
                  isClosable: false,
                } as ComponentItemConfig]
              } as StackItemConfig,

              // RIGHT: Properties
              {
                type: ItemType.stack,
                size: '20%',
                content: [{
                  type: ItemType.component,
                  componentType: GL_COMPONENT.PROPERTIES,
                  title: '⊞ Properties',
                  isClosable: true,
                } as ComponentItemConfig]
              } as StackItemConfig,
            ]
          } as RowOrColumnItemConfig,

          // ── BOTTOM: Terminal + Filters tabs ────────────────
          {
            type: ItemType.stack,
            size: '28%',
            content: [
              {
                type: ItemType.component,
                componentType: GL_COMPONENT.CONSOLE,
                title: '> Terminal',
                isClosable: true,
              } as ComponentItemConfig,
              {
                type: ItemType.component,
                componentType: GL_COMPONENT.FILTERS,
                title: '⚗ Filters',
                isClosable: true,
              } as ComponentItemConfig,
            ]
          } as StackItemConfig,
        ]
      } as RowOrColumnItemConfig
    };

    this.goldenLayout = new GoldenLayout(this.glContainerRef.nativeElement);

    const register = (name: string, cls: any) => {
      this.goldenLayout.registerComponentFactoryFunction(name,
        (container) => this.mount(cls, container));
    };

    register(GL_COMPONENT.MAIN_VIEW,  MainViewComponent);
    register(GL_COMPONENT.TREE_VIEW,  TreeViewComponent);
    register(GL_COMPONENT.BIRD_VIEW,  BirdViewComponent);
    register(GL_COMPONENT.CONSOLE,    ConsolePanelComponent);
    register(GL_COMPONENT.PROPERTIES, PropertiesPanelComponent);
    register(GL_COMPONENT.FILTERS,    FiltersPanelComponent);

    this.goldenLayout.loadLayout(config);

    new ResizeObserver(() => this.goldenLayout.updateRootSize())
      .observe(this.glContainerRef.nativeElement);
  }

  private mount(componentClass: any, container: ComponentContainer): void {
    const ref = createComponent(componentClass, { environmentInjector: this.envInjector });
    this.appRef.attachView(ref.hostView);
    container.element.appendChild(ref.location.nativeElement);
    this.componentRefs.set(container, ref);
    container.on('destroy', () => {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
      this.componentRefs.delete(container);
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.goldenLayout?.destroy();
    this.componentRefs.forEach(r => r.destroy());
  }
}
