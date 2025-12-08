import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-achat-decision-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './achat-decision-modal.component.html'
})
export class AchatDecisionModalComponent {
  @Input() actionType: 'entry' | 'bon-retour' = 'entry';
  @Output() decision = new EventEmitter<'consult' | 'add'>();
  @Output() closed = new EventEmitter<void>();

  onConsult(): void {
    this.decision.emit('consult');
  }

  onAdd(): void {
    this.decision.emit('add');
  }

  onClose(): void {
    this.closed.emit();
  }
}

