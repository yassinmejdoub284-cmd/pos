import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DailyExtractService, DailyExtract, FamilySummary, ProductSummary, DailyExtractDetail, ExpenseSummary } from '../../core/services/daily-extract.service';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SettingsService, AppSettings } from '../../core/services/settings.service';
import jsPDF from 'jspdf';

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
  appSettings: AppSettings | null = null;

  // Invoice generation properties
  showInvoiceModal = false;
  creatingInvoice = false;
  invoiceData = {
    invoiceNumber: '',
    customerName: '',
    customerAddress: '',
    customerMatricule: '',
    notes: ''
  };
  invoiceLines: any[] = [];
  invoiceTotals = {
    subtotalHTVA: 0,
    totalTVA: 0,
    totalTTC: 0
  };

  constructor(
    private router: Router,
    private dailyExtractService: DailyExtractService,
    private authService: AuthService,
    private http: HttpClient,
    private settingsService: SettingsService
  ) {}

  ngOnInit() {
    // Load settings first to get historyRetentionDays; fallback handled inside
    this.settingsService.getSettings().subscribe({
      next: (s) => {
        this.appSettings = s;
        const days = Number((s as any).historyRetentionDays || 30);
        this.maxDaysToLoad = Math.max(1, days);
        this.loadDailyExtracts(days);
      },
      error: () => {
        this.maxDaysToLoad = 30;
        this.loadDailyExtracts(30);
      }
    });
  }

  loadDailyExtracts(daysOverride?: number) {
    this.loading = true;
    // Determine days to load based on settings, fallback to previous behavior
    const daysFromSettings = Number(daysOverride || (this.appSettings as any)?.historyRetentionDays || 30);
    const daysToLoad = daysFromSettings > 0 ? daysFromSettings : (this.isUserAdmin() ? 10 : 5);
    this.currentLoadedDays = daysToLoad;
    
    this.dailyExtractService.getLastNDaysExtracts(daysToLoad).subscribe({
      next: (extracts) => {
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

    // Families and Products - Real HTML table format
    this.selectedExtract.families.forEach(family => {
      content += `
        <div class="family-section">
          <div class="family-name">${family.name}</div>
          <table class="family-table">
            <thead>
              <tr>
                <th class="col-article">Article</th>
                <th class="col-qty">Qty</th>
                <th class="col-price">Unit Price</th>
                <th class="col-total">Total</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      family.products.forEach(product => {
        const unitPrice = product.quantity > 0 ? product.revenue / product.quantity : 0;
        content += `
              <tr>
                <td class="col-article">${product.name}</td>
                <td class="col-qty">${product.quantity}</td>
                <td class="col-price">${this.formatCurrency(unitPrice)}</td>
                <td class="col-total">${this.formatCurrency(product.revenue)}</td>
              </tr>
        `;
      });
      
      content += `
              <tr class="family-total-row">
                <td class="col-article"><strong>Total ${family.name}</strong></td>
                <td class="col-qty"></td>
                <td class="col-price"></td>
                <td class="col-total"><strong>${this.formatCurrency(family.totalRevenue)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    });

    // Summary - Table format
    content += `
        <div class="summary-section">
          <table class="summary-table">
            <tbody>
              <tr>
                <td class="summary-label">Totale Remise</td>
                <td class="summary-value">${this.formatCurrency(this.selectedExtract.totalDiscount)}</td>
              </tr>
              <tr>
                <td class="summary-label">Totale Recette</td>
                <td class="summary-value">${this.formatCurrency(this.selectedExtract.totalRevenue)}</td>
              </tr>
              <tr>
                <td class="summary-label">Totale Caisse (Solde Débit)</td>
                <td class="summary-value">${this.formatCurrency(this.selectedExtract.soldeDebit)}</td>
              </tr>
    `;

    // Expenses section
    if (this.selectedExtract.expenses.length > 0) {
      content += `
              <tr>
                <td class="summary-label">Dépense</td>
                <td class="summary-value"></td>
              </tr>
      `;
      this.selectedExtract.expenses.forEach(expense => {
        content += `
              <tr>
                <td class="expense-label">--- ${expense.description}</td>
                <td class="expense-value">${this.formatCurrency(expense.amount)}</td>
              </tr>
        `;
      });
    }

    content += `
              <tr>
                <td class="summary-label">Totale Caisse</td>
                <td class="summary-value">${this.formatCurrency(this.selectedExtract.totalCaisse)}</td>
              </tr>
              <tr>
                <td class="summary-label">Retrait</td>
                <td class="summary-value">${this.formatCurrency(this.selectedExtract.withdrawal)}</td>
              </tr>
              <tr>
                <td class="summary-label">Totale Reste Caisse</td>
                <td class="summary-value">${this.formatCurrency(this.selectedExtract.remainingCash)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    return content;
  }

  private getPrintStyles(format: 'A4' | '80mm'): string {
    if (format === 'A4') {
      return `
        @page { size: A4; margin: 10mm; }
        .a4-container { font-family: Arial, sans-serif; max-width: 210mm; margin: 0 auto; line-height: 1.4; }
        .header { text-align: center; margin-bottom: 15px; }
        .header h1 { font-size: 20px; font-weight: bold; margin: 0; }
        .header h2 { font-size: 16px; margin: 3px 0; }
        .family-section { margin-bottom: 15px; }
        .family-name { font-size: 14px; font-weight: bold; margin: 10px 0 8px 0; }
        .family-table { width: 100%; border-collapse: collapse; margin: 5px 0; border: 1px solid #333; }
        .family-table th, .family-table td { padding: 3px 2px; text-align: left; border: 1px solid #333; }
        .family-table th { background-color: #f5f5f5; font-weight: bold; font-size: 10px; }
        .family-table td { font-size: 9px; }
        .col-article { width: 40%; }
        .col-qty { width: 15%; text-align: center; }
        .col-price { width: 20%; text-align: right; }
        .col-total { width: 25%; text-align: right; }
        .family-total-row { font-weight: bold; background-color: #f9f9f9; }
        .family-total-row td { border-top: 1px solid #333; }
        .summary-section { margin-top: 20px; }
        .summary-table { width: 100%; border-collapse: collapse; border: 1px solid #333; }
        .summary-table td { padding: 3px 5px; border: 1px solid #333; font-size: 10px; }
        .summary-label { font-weight: bold; width: 60%; }
        .summary-value { text-align: right; width: 40%; font-weight: bold; }
        .expense-label { font-size: 9px; padding-left: 10px; }
        .expense-value { text-align: right; font-size: 9px; }
      `;
    } else {
      return `
        @page { size: 80mm auto; margin: 0; }
        .receipt-container { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; font-size: 12px; line-height: 1.2; }
        .header { text-align: center; margin-bottom: 8px; }
        .header h1 { font-size: 12px; font-weight: bold; margin: 0; }
        .header h2 { font-size: 10px; margin: 2px 0; }
        .family-section { margin-bottom: 8px; }
        .family-name { font-size: 10px; font-weight: bold; margin: 6px 0 4px 0; }
        .family-table { width: 100%; border-collapse: collapse; margin: 3px 0; font-size: 8px; border: 1px solid #000; }
        .family-table th, .family-table td { padding: 1px 1px; text-align: left; border: 1px solid #000; }
        .family-table th { background-color: #f0f0f0; font-weight: bold; font-size: 8px; }
        .family-table td { font-size: 7px; }
        .col-article { width: 40%; }
        .col-qty { width: 15%; text-align: center; }
        .col-price { width: 20%; text-align: right; }
        .col-total { width: 25%; text-align: right; }
        .family-total-row { font-weight: bold; background-color: #f0f0f0; }
        .family-total-row td { border-top: 1px solid #000; }
        .summary-section { margin-top: 10px; }
        .summary-table { width: 100%; border-collapse: collapse; border: 1px solid #000; }
        .summary-table td { padding: 1px 2px; border: 1px solid #000; font-size: 8px; }
        .summary-label { font-weight: bold; width: 60%; }
        .summary-value { text-align: right; width: 40%; font-weight: bold; }
        .expense-label { font-size: 7px; padding-left: 5px; }
        .expense-value { text-align: right; font-size: 7px; }
      `;
    }
  }

  // Invoice generation methods
  generateInvoice(): void {
    if (!this.selectedExtract) return;

    // Initialize invoice data
    this.invoiceData = {
      invoiceNumber: '',
      customerName: '',
      customerAddress: '',
      customerMatricule: '',
      notes: ''
    };

    // Prepare invoice lines from extract data
    this.invoiceLines = [];
    this.selectedExtract.families.forEach(family => {
      family.products.forEach(product => {
        if (product.quantity > 0) {
          const unitPrice = product.revenue / product.quantity;
          const tvaPercent = 19; // Default TVA rate, should be fetched from product
          const prixHTVA = unitPrice / (1 + tvaPercent / 100);
          const montantTVA = unitPrice - prixHTVA;

          this.invoiceLines.push({
            productId: product.id,
            familleName: family.name,
            productName: product.name,
            legalDesignation: product.designation_legale || product.name,
            unite: 'pcs',
            quantity: product.quantity,
            prixVenteTTC: unitPrice,
            prixVenteHTVA: Math.round(prixHTVA * 100) / 100,
            tvaPercent: tvaPercent,
            montantTVA: Math.round(montantTVA * 100) / 100,
            sousTotalTTC: product.revenue
          });
        }
      });
    });

    this.updateInvoiceTotals();
    this.showInvoiceModal = true;
    
    // Automatically get the next invoice number when modal opens
    this.getNextInvoiceNumber();
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.invoiceLines = [];
    this.invoiceData = {
      invoiceNumber: '',
      customerName: '',
      customerAddress: '',
      customerMatricule: '',
      notes: ''
    };
  }

  getNextInvoiceNumber(): void {
    const token = this.authService.getToken();
    const timestamp = new Date().getTime();
    this.http.get(`${environment.apiUrl}/invoices/next-number?t=${timestamp}`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    }).subscribe({
      next: (response: any) => {
        this.invoiceData.invoiceNumber = response.nextInvoiceNumber;
      },
      error: (error) => {
        console.error('Error getting next invoice number:', error);
        this.invoiceData.invoiceNumber = 'FAC-001';
      }
    });
  }

  updateInvoiceTotals(): void {
    let subtotalHTVA = 0;
    let totalTVA = 0;
    let totalTTC = 0;

    this.invoiceLines.forEach(line => {
      const sousTotalTTC = line.quantity * line.prixVenteTTC;
      const sousTotalHTVA = line.quantity * line.prixVenteHTVA;
      const sousTotalTVA = line.quantity * line.montantTVA;

      subtotalHTVA += sousTotalHTVA;
      totalTVA += sousTotalTVA;
      totalTTC += sousTotalTTC;

      line.sousTotalTTC = sousTotalTTC;
    });

    this.invoiceTotals = {
      subtotalHTVA: Math.round(subtotalHTVA * 100) / 100,
      totalTVA: Math.round(totalTVA * 100) / 100,
      totalTTC: Math.round(totalTTC * 100) / 100
    };
  }

  createInvoice(): void {
    if (!this.selectedExtract) return;

    this.creatingInvoice = true;

    const invoicePayload = {
      date: this.selectedExtract.date,
      invoiceNumber: this.invoiceData.invoiceNumber,
      customerInfo: {
        name: this.invoiceData.customerName,
        address: this.invoiceData.customerAddress,
        matricule: this.invoiceData.customerMatricule
      },
      lines: this.invoiceLines.map(line => ({
        productId: line.productId,
        quantity: line.quantity,
        prixVenteTTC: line.prixVenteTTC
      })),
      notes: this.invoiceData.notes
    };

    const token = this.authService.getToken();
    console.log('Creating invoice with payload:', invoicePayload);
    console.log('API URL:', `${environment.apiUrl}/invoices/from-extract`);
    
    this.http.post(`${environment.apiUrl}/invoices/from-extract`, invoicePayload, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    }).subscribe({
      next: (response: any) => {
        console.log('Invoice created successfully:', response);
        this.creatingInvoice = false;
        this.closeInvoiceModal();
        alert('Facture créée avec succès!');
        // Optionally navigate to invoice details or show success message
      },
      error: (error) => {
        this.creatingInvoice = false;
        console.error('Error creating invoice:', error);
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          error: error.error
        });
        if (error.error?.error) {
          alert(`Erreur: ${error.error.error}`);
        } else {
          alert('Erreur lors de la création de la facture');
        }
      }
    });
  }

  exportToPDF(): void {
    if (!this.selectedExtract) return;

    // Create a new PDF document
    const doc = new jsPDF();
    
    // Set up the PDF content
    this.generatePDFContent(doc);
    
    // Generate filename with date
    const dateStr = this.selectedExtract.date.replace(/-/g, '');
    const filename = `extrait-journalier-${dateStr}.pdf`;
    
    // Save the PDF
    doc.save(filename);

    // Show success message
    alert('Extrait exporté en PDF! Vous pouvez maintenant l\'importer dans "Document Manager" pour créer un brouillon de facture.');
  }


  private generatePDFContent(doc: jsPDF): void {
    if (!this.selectedExtract) return;

    let yPosition = 20;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('EXTRait JOURNALIÈRE', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${this.selectedExtract.date}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Table headers - using simple text format that can be parsed
    const headers = ['Date', 'Famille', 'Article', 'Désignation légale', 'Quantité', 'PV HTVA', 'TVA %', 'PV TTC'];
    
    // Create a simple table format that the backend can parse
    // Use multiple spaces to separate columns for better parsing
    let tableText = headers.join('  ') + '\n';
    let totalHT = 0;
    let totalTVA = 0;
    let totalTTC = 0;
    
    // Add data rows
    this.selectedExtract.families.forEach(family => {
      family.products.forEach(product => {
        if (product.quantity > 0) {
          const unitPrice = product.revenue / product.quantity;
          const tvaPercent = 19;
          const prixHTVA = unitPrice / (1 + tvaPercent / 100);
          const prixTTC = unitPrice;
          
          const rowData = [
            this.selectedExtract!.date,
            family.name,
            product.name,
            product.designation_legale || product.name,
            product.quantity.toString(),
            prixHTVA.toFixed(2),
            tvaPercent.toString(),
            prixTTC.toFixed(2)
          ];
          
          tableText += rowData.join('  ') + '\n';
          
          totalHT += prixHTVA * product.quantity;
          totalTVA += (prixTTC - prixHTVA) * product.quantity;
          totalTTC += prixTTC * product.quantity;
        }
      });
    });
    
    // Add totals
    tableText += '\n';
    tableText += `Total HT: ${totalHT.toFixed(2)} TND\n`;
    tableText += `Total TVA: ${totalTVA.toFixed(2)} TND\n`;
    tableText += `Total TTC: ${totalTTC.toFixed(2)} TND\n`;
    
    // Add the table text to the PDF
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    // Split text into lines and add to PDF
    const lines = tableText.split('\n');
    lines.forEach((line, index) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      // Make headers bold
      if (index === 0) {
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      
      doc.text(line, margin, yPosition);
      yPosition += 6;
    });
  }
}
