import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductsService } from '../../../core/services/products.service';
import { AuthService } from '../../../core/services/auth.service';

interface TransferHistoryItem {
  id: number;
  date: Date;
  sourceProduct: {
    id: number | null;
    name: string;
    famille: any;
    quantity: number;
    unite: string | null;
  };
  targetProduct: {
    id: number;
    name: string;
    famille: any;
    quantity: number;
    unite: string;
    isVrac: boolean;
  };
  conversionRatio: number;
  depot: {
    name: string;
    code: string;
  };
  user: {
    firstName: string;
    lastName: string;
    username: string;
  };
  reference: string | null;
}

@Component({
  selector: 'app-transfer-history',
  templateUrl: './transfer-history.component.html',
  standalone: false
})
export class TransferHistoryComponent implements OnInit {
  transferHistory: TransferHistoryItem[] = [];
  loading = false;
  error = '';
  currentPage = 1;
  pageSize = 50;
  totalItems = 0;
  totalPages = 0;
  startDate: string = '';
  endDate: string = '';

  constructor(
    private productsService: ProductsService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadTransferHistory();
  }

  loadTransferHistory(): void {
    this.loading = true;
    this.error = '';

    const userDepotId = this.authService.currentUser()?.depotId || 0;
    const visitingDepotIdStr = sessionStorage.getItem('visitingDepotId');
    const currentDepotId = visitingDepotIdStr ? parseInt(visitingDepotIdStr) : (userDepotId || 1);

    // Validate depotId
    if (!currentDepotId || currentDepotId <= 0) {
      this.error = 'Dépôt invalide. Veuillez sélectionner un dépôt.';
      this.loading = false;
      return;
    }

    const params: any = {
      depotId: currentDepotId,
      page: this.currentPage,
      limit: this.pageSize
    };

    if (this.startDate) {
      params.startDate = this.startDate;
    }
    if (this.endDate) {
      params.endDate = this.endDate;
    }



    this.productsService.getTransferHistory(params).subscribe({
      next: (response) => {

        this.transferHistory = response.data || [];
        this.totalItems = response.pagination?.total || 0;
        this.totalPages = response.pagination?.totalPages || 0;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading transfer history:', err);
        this.error = err.error?.error || err.error?.details || 'Erreur lors du chargement de l\'historique des transferts';
        this.loading = false;
      }
    });
  }

  onDateFilterChange(): void {
    this.currentPage = 1;
    this.loadTransferHistory();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadTransferHistory();
  }

  goBack(): void {
    this.router.navigate(['/stock/transfer-vers-vrag']);
  }

  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

