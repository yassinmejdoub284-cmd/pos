import { Component, OnInit } from '@angular/core';
import { SalesService } from '../core/services/sales.service';
import { Sale } from '../core/models/sale.model';

@Component({
  selector: 'app-approvals',
  templateUrl: './approvals.component.html',
  standalone: false
})
export class ApprovalsComponent implements OnInit {
  loading = false;
  error = '';
  allGifts: Sale[] = [];
  pendingGifts: Sale[] = [];
  approvedGifts: Sale[] = [];
  selectedTab: 'PENDING_ADMIN' | 'CADEAU' = 'PENDING_ADMIN';
  searchQuery = '';
  startDate = '';
  endDate = '';
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' = 'info';

  constructor(private salesService: SalesService) {}

  ngOnInit(): void {
    this.loadGifts();
  }

  loadGifts(): void {
    this.loading = true;
    this.error = '';
    this.salesService.getSales().subscribe({
      next: (sales) => {
        const gifts = sales.filter(s => s.status === 'PENDING_ADMIN' || s.status === 'CADEAU');
        this.allGifts = gifts;
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.error = "Erreur lors du chargement des demandes de cadeaux";
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    let gifts = this.allGifts;
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      gifts = gifts.filter(s => (s.notes || '').toLowerCase().includes(q) || `${s.id}`.includes(q));
    }
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      gifts = gifts.filter(s => {
        const d = new Date(s.createdAt as unknown as string);
        return d >= start && d <= end;
      });
    }
    this.pendingGifts = gifts.filter(s => s.status === 'PENDING_ADMIN');
    this.approvedGifts = gifts.filter(s => s.status === 'CADEAU');
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.startDate = '';
    this.endDate = '';
    this.applyFilters();
  }

  approve(sale: Sale): void {
    this.salesService.approveGiftSale(sale.id).subscribe({
      next: () => {
        this.showAlertMessage('Cadeau approuvé avec succès', 'success');
        this.loadGifts();
      },
      error: () => {
        this.showAlertMessage("Erreur lors de l'approbation du cadeau", 'error');
      }
    });
  }

  reject(sale: Sale): void {
    this.salesService.rejectGiftSale(sale.id).subscribe({
      next: () => {
        this.showAlertMessage('Cadeau rejeté avec succès', 'success');
        this.loadGifts();
      },
      error: () => {
        this.showAlertMessage('Erreur lors du rejet du cadeau', 'error');
      }
    });
  }

  showAlertMessage(message: string, type: 'success' | 'error' | 'info'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    setTimeout(() => { this.showAlert = false; }, 3000);
  }
} 