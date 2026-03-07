import {
  Component, inject, ElementRef, ViewChild,
  AfterViewChecked, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TerminalService, TerminalLine } from '../../services/terminal.service';

@Component({
  selector: 'app-console-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './console-panel.component.html',
  styleUrls: ['./console-panel.component.scss']
})
export class ConsolePanelComponent implements AfterViewChecked, OnDestroy {

  @ViewChild('outputEl') outputRef!: ElementRef<HTMLDivElement>;
  @ViewChild('inputEl')  inputRef!: ElementRef<HTMLInputElement>;

  terminalService = inject(TerminalService);
  lines: TerminalLine[] = [];

  inputValue = '';
  private history: string[] = [];
  private historyIdx = -1;
  private sub = new Subscription();
  private shouldScroll = true;

  constructor() {
    this.sub.add(
      this.terminalService.lines$.subscribe(lines => {
        this.lines = lines;
        this.shouldScroll = true;
      })
    );
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.outputRef) {
      const el = this.outputRef.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const val = this.inputValue.trim();
      if (val) {
        this.history.unshift(val);
        this.historyIdx = -1;
        this.terminalService.execute(val);
      }
      this.inputValue = '';
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      if (this.historyIdx < this.history.length - 1) {
        this.historyIdx++;
        this.inputValue = this.history[this.historyIdx];
      }
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      if (this.historyIdx > 0) {
        this.historyIdx--;
        this.inputValue = this.history[this.historyIdx];
      } else if (this.historyIdx === 0) {
        this.historyIdx = -1;
        this.inputValue = '';
      }
      event.preventDefault();
    } else if (event.key === 'Tab') {
      // Basic autocomplete hints
      event.preventDefault();
      const cmds = ['help','clear','load demo','info','nodes','edges','node ','add node ','add edge ','remove node ','remove edge ','select ','deselect','newtab','rename ','tabs','fit','zoom '];
      const val = this.inputValue;
      const match = cmds.find(c => c.startsWith(val) && c !== val);
      if (match) this.inputValue = match;
    }
  }

  focusInput(): void {
    this.inputRef?.nativeElement.focus();
  }

  getLineClass(line: TerminalLine): string {
    return `line-${line.type}`;
  }

  formatTime(d?: Date): string {
    if (!d) return '';
    return d.toLocaleTimeString('en-US', { hour12: false });
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }
}
