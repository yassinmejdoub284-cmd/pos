import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SalesService } from '../../core/services/sales.service';
import { Sale } from '../../core/models/sale.model';

@Component({
  selector: 'app-ticket-dialog',
  templateUrl: './ticket-dialog.component.html',
  standalone: true,
  imports: [CommonModule]
})
export class TicketDialogComponent implements OnInit, OnChanges {
  @Input() saleId: number | null = null;
  @Input() isVisible: boolean = false;
  @Output() close = new EventEmitter<void>();

  sale: Sale | null = null;
  loading = false;
  error: string | null = null;

  constructor(private salesService: SalesService) {}

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  ngOnInit(): void {
    if (this.saleId && this.isVisible) {
      this.loadSaleDetails();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['saleId'] || changes['isVisible']) {
      if (this.saleId && this.isVisible) {
        this.loadSaleDetails();
      }
    }
  }

  loadSaleDetails(): void {
    if (!this.saleId) return;

    this.loading = true;
    this.error = null;
    this.sale = null;

    this.salesService.getSale(this.saleId).subscribe({
      next: (sale) => {
        this.sale = sale;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sale details:', error);
        this.error = 'Erreur lors du chargement des détails du ticket';
        this.loading = false;
      }
    });
  }

  closeDialog(): void {
    this.close.emit();
  }

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleString('fr-FR');
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'PENDING': 'En attente',
      'COMPLETED': 'Terminé',
      'CANCELLED': 'Annulé',
      'TEMPORARY': 'Temporaire',
      'GIFT': 'Cadeau'
    };
    return statusMap[status] || status;
  }

  getPaymentTypeText(paymentType: string): string {
    const typeMap: { [key: string]: string } = {
      'COMPTANT': 'Comptant',
      'CREDIT': 'Crédit'
    };
    return typeMap[paymentType] || paymentType;
  }
}
