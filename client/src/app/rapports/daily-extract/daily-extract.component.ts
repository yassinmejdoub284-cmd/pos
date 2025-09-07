import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DailyExtractService, DailyExtract, FamilySummary, ProductSummary, DailyExtractDetail, ExpenseSummary } from '../../core/services/daily-extract.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-daily-extract',
  templateUrl: './daily-extract.component.html',
  standalone: false
})
export class DailyExtractComponent implements OnInit {
  dailyExtracts: DailyExtract[] = [];
  selectedExtract: DailyExtractDetail | null = null;
  loading = false;
  showArchives = false;
  loadingArchives = false;
  currentLoadedDays = 0;
  maxDaysToLoad = 30; // Maximum days to prevent infinite loading

  constructor(
    private router: Router,
    private dailyExtractService: DailyExtractService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadDailyExtracts();
  }

  loadDailyExtracts() {
    this.loading = true;
    
    // Check if user is admin to determine how many days to load
    const isAdmin = this.isUserAdmin();
    const daysToLoad = isAdmin ? 10 : 5;
    this.currentLoadedDays = daysToLoad;
    
    this.dailyExtractService.getLastNDaysExtracts(daysToLoad).subscribe({
      next: (extracts) => {
        console.log('Received extracts:', extracts);
        this.dailyExtracts = extracts;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading daily extracts:', error);
        this.loading = false;
      }
    });
  }

  private isUserAdmin(): boolean {
    const currentUser = this.authService.currentUser();
    return currentUser?.role === 'ADMIN';
  }

  canLoadMoreArchives(): boolean {
    return !this.loadingArchives && this.currentLoadedDays < this.maxDaysToLoad;
  }

  selectExtract(extract: DailyExtract) {
    if (!extract.hasData) {
      return;
    }

    this.loading = true;
    this.dailyExtractService.getExtractDetail(extract.date).subscribe({
      next: (detail) => {
        this.selectedExtract = detail;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading extract detail:', error);
        this.loading = false;
      }
    });
  }

  goBack() {
    this.router.navigate(['/rapports']);
  }

  showMoreArchives() {
    if (this.loadingArchives || this.currentLoadedDays >= this.maxDaysToLoad) {
      return;
    }

    this.loadingArchives = true;
    const additionalDays = 5;
    const newTotalDays = this.currentLoadedDays + additionalDays;
    
    // Load additional days
    this.dailyExtractService.getLastNDaysExtracts(newTotalDays).subscribe({
      next: (extracts) => {
        console.log('Received additional extracts:', extracts);
        this.dailyExtracts = extracts;
        this.currentLoadedDays = newTotalDays;
        this.loadingArchives = false;
        this.showArchives = true;
      },
      error: (error) => {
        console.error('Error loading additional archives:', error);
        this.loadingArchives = false;
      }
    });
  }

  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateString);
        return dateString;
      }
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return dateString;
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  }

  getTodayDate(): string {
    const today = new Date();
    return today.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  printExtract(format: 'A4' | '80mm'): void {
    if (!this.selectedExtract) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = this.generatePrintContent(format);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Extrait Journalière - ${this.formatDate(this.selectedExtract.date)}</title>
        <style>
          ${this.getPrintStyles(format)}
        </style>
      </head>
      <body>
        ${printContent}
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }

  private generatePrintContent(format: 'A4' | '80mm'): string {
    if (!this.selectedExtract) return '';

    const isA4 = format === 'A4';
    const containerClass = isA4 ? 'a4-container' : 'receipt-container';
    
    let content = `
      <div class="${containerClass}">
        <div class="header">
          <h1>EXTRait JOURNALIÈRE</h1>
          <h2>${this.formatDate(this.selectedExtract.date)}</h2>
        </div>
    `;

    // Families and Products - Simple format as requested
    this.selectedExtract.families.forEach(family => {
      content += `
        <div class="family-section">
          <div class="family-name">${family.name}</div>
      `;
      
      family.products.forEach(product => {
        content += `
          <div class="product-line">
            <div class="product-name">${product.name}</div>
            <div class="product-details">${product.quantity} x ${this.formatCurrency(product.revenue / product.quantity)} = ${this.formatCurrency(product.revenue)}</div>
          </div>
        `;
      });
      
      content += `
          <div class="family-separator">========</div>
          <div class="family-total">Total ${family.name}: ${this.formatCurrency(family.totalRevenue)}</div>
        </div>
      `;
    });

    // Summary - Simple format as requested
    content += `
        <div class="summary-section">
          <div class="summary-line">Totale Remise</div>
          <div class="summary-line">${this.formatCurrency(this.selectedExtract.totalDiscount)}</div>
          
          <div class="summary-line">Totale Recette</div>
          <div class="summary-line">${this.formatCurrency(this.selectedExtract.totalRevenue)}</div>
          
          <div class="summary-line">Totale Caisse (Solde Débit)</div>
          <div class="summary-line">${this.formatCurrency(this.selectedExtract.soldeDebit)}</div>
          
          <div class="expenses-section">
            <div class="expenses-title">Dépense</div>
    `;

    this.selectedExtract.expenses.forEach(expense => {
      content += `
        <div class="expense-line">--- ${expense.description}</div>
      `;
    });

    content += `
          </div>
          
          <div class="final-summary">
            <div class="summary-line">Totale Caisse</div>
            <div class="summary-line">${this.formatCurrency(this.selectedExtract.totalCaisse)}</div>
            
            <div class="summary-line">Retrait</div>
            <div class="summary-line">${this.formatCurrency(this.selectedExtract.withdrawal)}</div>
            
            <div class="summary-line">Totale Reste Caisse</div>
            <div class="summary-line">${this.formatCurrency(this.selectedExtract.remainingCash)}</div>
          </div>
        </div>
      </div>
    `;

    return content;
  }

  private getPrintStyles(format: 'A4' | '80mm'): string {
    if (format === 'A4') {
      return `
        @page { size: A4; margin: 20mm; }
        .a4-container { font-family: Arial, sans-serif; max-width: 210mm; margin: 0 auto; line-height: 1.4; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 24px; font-weight: bold; margin: 0; }
        .header h2 { font-size: 18px; margin: 5px 0; }
        .family-section { margin-bottom: 20px; }
        .family-name { font-size: 16px; font-weight: bold; margin: 15px 0 10px 0; }
        .product-line { margin: 8px 0; }
        .product-name { font-size: 14px; margin-bottom: 2px; }
        .product-details { font-size: 12px; color: #666; margin-left: 10px; }
        .family-separator { text-align: center; margin: 10px 0; font-weight: bold; }
        .family-total { font-size: 14px; font-weight: bold; margin: 10px 0; }
        .summary-section { margin-top: 30px; }
        .summary-line { margin: 8px 0; font-size: 14px; }
        .expenses-section { margin: 20px 0; }
        .expenses-title { font-size: 14px; font-weight: bold; margin: 10px 0; }
        .expense-line { margin: 3px 0; font-size: 12px; margin-left: 10px; }
        .final-summary { margin-top: 20px; }
      `;
    } else {
      return `
        @page { size: 80mm auto; margin: 0; }
        .receipt-container { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; font-size: 12px; line-height: 1.2; }
        .header { text-align: center; margin-bottom: 10px; }
        .header h1 { font-size: 14px; font-weight: bold; margin: 0; }
        .header h2 { font-size: 12px; margin: 2px 0; }
        .family-section { margin-bottom: 10px; }
        .family-name { font-size: 12px; font-weight: bold; margin: 8px 0 5px 0; }
        .product-line { margin: 4px 0; }
        .product-name { font-size: 11px; margin-bottom: 1px; }
        .product-details { font-size: 10px; margin-left: 5px; }
        .family-separator { text-align: center; margin: 5px 0; font-weight: bold; }
        .family-total { font-size: 11px; font-weight: bold; margin: 5px 0; }
        .summary-section { margin-top: 15px; }
        .summary-line { margin: 4px 0; font-size: 11px; }
        .expenses-section { margin: 10px 0; }
        .expenses-title { font-size: 11px; font-weight: bold; margin: 5px 0; }
        .expense-line { margin: 2px 0; font-size: 10px; margin-left: 5px; }
        .final-summary { margin-top: 10px; }
      `;
    }
  }
}
