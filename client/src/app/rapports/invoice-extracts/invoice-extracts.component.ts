import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { PDFParserService, PDFParseResult, TempInvoiceDraft, ColumnMapping } from '../../core/services/pdf-parser.service';
import { Observable } from 'rxjs';

export interface InvoiceExtract {
  date: string;
  invoices: InvoiceSummary[];
  totalInvoiced: number;
  totalQuantity: number;
}

export interface InvoiceSummary {
  id: number;
  invoiceNumber: string;
  customerName: string;
  totalTTC: number;
  lines: InvoiceLine[];
  createdAt: string;
  isImported?: boolean; // Flag to identify imported invoices
  isTemporary?: boolean; // Flag to identify temporary drafts
  status?: 'Draft' | 'Numbered' | 'Needs Number';
  sourceFilename?: string;
}

export interface InvoiceLine {
  productId: number;
  productName: string;
  familleName: string;
  quantity: number;
  prixVenteTTC: number;
  sousTotalTTC: number;
}

export interface PDFFile {
  file: File;
  status: 'waiting' | 'parsing' | 'mapped' | 'draft-created' | 'error';
  parseResult?: PDFParseResult;
  error?: string;
  draftId?: string;
}

export interface ColumnMappingDialogResult {
  columnMapping: ColumnMapping;
  customerInfo: {
    customerId?: number;
    customerName: string;
    customerAddress?: string;
    customerMatricule?: string;
  };
  invoiceDate: string;
  notes?: string;
}

@Component({
  selector: 'app-invoice-extracts',
  templateUrl: './invoice-extracts.component.html',
  standalone: false
})
export class InvoiceExtractsComponent implements OnInit {
  invoiceExtracts: InvoiceExtract[] = [];
  selectedExtract: InvoiceExtract | null = null;
  loading = false;
  showArchives = false;
  loadingArchives = false;
  currentLoadedDays = 0;
  maxDaysToLoad = 30;
  viewMode: 'grid' | 'list' = 'grid';
  isImporting = false;

  // PDF workflow properties
  tempDrafts: TempInvoiceDraft[] = [];
  uploadedFiles: PDFFile[] = [];
  customers: any[] = [];
  showDragDrop = true;
  isDragOver: boolean = false;

  constructor(
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private pdfParserService: PDFParserService
  ) {}

  ngOnInit() {
    this.loadInvoices();
    this.loadCustomers();
    // Initialize with empty data since we're focusing on PDF workflow
    this.invoiceExtracts = [];
    this.loading = false;
  }

  loadInvoiceExtracts() {
    // This method is kept for compatibility but doesn't load real data
    // The component now focuses on PDF workflow and temporary drafts
    this.loading = false;
  }

  private getInvoiceExtracts(days: number) {
    // Return empty observable since this endpoint doesn't exist
    return new Observable<InvoiceExtract[]>(observer => {
      observer.next([]);
      observer.complete();
    });
  }

  selectExtract(extract: InvoiceExtract) {
    this.selectedExtract = extract;
  }

  goBack() {
    this.router.navigate(['/rapports']);
  }

  canLoadMoreArchives(): boolean {
    return !this.loadingArchives && this.currentLoadedDays < this.maxDaysToLoad;
  }

  showMoreArchives() {
    if (this.loadingArchives || this.currentLoadedDays >= this.maxDaysToLoad) {
      return;
    }

    this.loadingArchives = true;
    const additionalDays = 5;
    const newTotalDays = this.currentLoadedDays + additionalDays;
    
    this.getInvoiceExtracts(newTotalDays).subscribe({
      next: (extracts) => {
        this.invoiceExtracts = extracts;
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

  getTotalInvoices(): number {
    // Count temporary drafts instead of invoice extracts
    return this.tempDrafts.length;
  }

  getTotalInvoiced(): number {
    // Sum up totals from temporary drafts
    return this.tempDrafts.reduce((total, draft) => total + draft.totals.totalTTC, 0);
  }

  getTotalQuantities(): number {
    // Sum up quantities from temporary drafts
    return this.tempDrafts.reduce((total, draft) => total + draft.lines.reduce((sum, line) => sum + line.quantity, 0), 0);
  }

  toggleViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }


  private handlePDFImport(file: File): void {
    // Mock PDF import - simulate processing
    console.log('Importing PDF:', file.name);
    this.isImporting = true;
    
    // Simulate processing delay
    setTimeout(() => {
      // Create a mock invoice from the PDF
      const mockInvoice = this.createMockInvoiceFromPDF(file);
      
      // Add to today's date or create today's date if it doesn't exist
      this.addMockInvoiceToExtracts(mockInvoice);
      
      this.isImporting = false;
    }, 1500); // 1.5 second delay to simulate processing
  }

  private createMockInvoiceFromPDF(file: File): InvoiceSummary {
    // Generate a mock invoice number
    const invoiceNumber = `FAC-${String(Math.floor(Math.random() * 900) + 100)}`;
    
    // Mock customer name from filename
    const customerName = file.name.replace('.pdf', '').replace(/[_-]/g, ' ');
    
    // Mock invoice lines
    const mockLines: InvoiceLine[] = [
      {
        productId: 1,
        productName: 'Produit Importé',
        familleName: 'Import',
        quantity: Math.floor(Math.random() * 5) + 1,
        prixVenteTTC: 25.50,
        sousTotalTTC: 25.50 * (Math.floor(Math.random() * 5) + 1)
      },
      {
        productId: 2,
        productName: 'Article PDF',
        familleName: 'Document',
        quantity: Math.floor(Math.random() * 3) + 1,
        prixVenteTTC: 15.75,
        sousTotalTTC: 15.75 * (Math.floor(Math.random() * 3) + 1)
      }
    ];

    const totalTTC = mockLines.reduce((sum, line) => sum + line.sousTotalTTC, 0);

    return {
      id: Date.now(), // Use timestamp as mock ID
      invoiceNumber,
      customerName,
      totalTTC,
      lines: mockLines,
      createdAt: new Date().toISOString(),
      isImported: true // Mark as imported
    };
  }

  private addMockInvoiceToExtracts(invoice: InvoiceSummary): void {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
    // Find today's extract or create it
    let todayExtract = this.invoiceExtracts.find(extract => extract.date === todayString);
    
    if (!todayExtract) {
      // Create new extract for today
      todayExtract = {
        date: todayString,
        invoices: [],
        totalInvoiced: 0,
        totalQuantity: 0
      };
      this.invoiceExtracts.unshift(todayExtract); // Add to beginning
    }
    
    // Add the new invoice
    todayExtract.invoices.unshift(invoice); // Add to beginning of invoices
    
    // Update totals
    todayExtract.totalInvoiced += invoice.totalTTC;
    todayExtract.totalQuantity += invoice.lines.reduce((sum, line) => sum + line.quantity, 0);
    
    // Show success message (you could add a toast notification here)
    console.log('PDF imported successfully:', invoice.invoiceNumber);
    
    // Optional: Show a temporary success indicator
    this.showImportSuccess(invoice.invoiceNumber);
  }

  private showImportSuccess(invoiceNumber: string): void {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    successDiv.textContent = `PDF importé: ${invoiceNumber}`;
    
    document.body.appendChild(successDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (document.body.contains(successDiv)) {
        document.body.removeChild(successDiv);
      }
    }, 3000);
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
        <title>Extraits Facturés - ${this.formatDate(this.selectedExtract.date)}</title>
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
          <h1>EXTRaits FACTURÉS</h1>
          <h2>${this.formatDate(this.selectedExtract.date)}</h2>
        </div>
    `;

    // Invoices and their lines
    this.selectedExtract.invoices.forEach(invoice => {
      content += `
        <div class="invoice-section">
          <div class="invoice-header">
            <h3>Facture ${invoice.invoiceNumber}</h3>
            <p>Client: ${invoice.customerName}</p>
            <p>Total: ${this.formatCurrency(invoice.totalTTC)}</p>
          </div>
          <table class="invoice-table">
            <thead>
              <tr>
                <th class="col-product">Produit</th>
                <th class="col-family">Famille</th>
                <th class="col-qty">Qté</th>
                <th class="col-price">Prix Unitaire</th>
                <th class="col-total">Total</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      invoice.lines.forEach(line => {
        content += `
              <tr>
                <td class="col-product">${line.productName}</td>
                <td class="col-family">${line.familleName}</td>
                <td class="col-qty">${line.quantity}</td>
                <td class="col-price">${this.formatCurrency(line.prixVenteTTC)}</td>
                <td class="col-total">${this.formatCurrency(line.sousTotalTTC)}</td>
              </tr>
        `;
      });
      
      content += `
            </tbody>
          </table>
        </div>
      `;
    });

    // Summary
    content += `
        <div class="summary-section">
          <table class="summary-table">
            <tbody>
              <tr>
                <td class="summary-label">Total Facturé</td>
                <td class="summary-value">${this.formatCurrency(this.selectedExtract.totalInvoiced)}</td>
              </tr>
              <tr>
                <td class="summary-label">Total Quantités</td>
                <td class="summary-value">${this.selectedExtract.totalQuantity}</td>
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
        .invoice-section { margin-bottom: 20px; }
        .invoice-header { background-color: #f5f5f5; padding: 10px; margin-bottom: 10px; }
        .invoice-header h3 { font-size: 14px; font-weight: bold; margin: 0; }
        .invoice-header p { font-size: 12px; margin: 2px 0; }
        .invoice-table { width: 100%; border-collapse: collapse; margin: 5px 0; border: 1px solid #333; }
        .invoice-table th, .invoice-table td { padding: 3px 2px; text-align: left; border: 1px solid #333; }
        .invoice-table th { background-color: #f5f5f5; font-weight: bold; font-size: 10px; }
        .invoice-table td { font-size: 9px; }
        .col-product { width: 30%; }
        .col-family { width: 20%; }
        .col-qty { width: 10%; text-align: center; }
        .col-price { width: 20%; text-align: right; }
        .col-total { width: 20%; text-align: right; }
        .summary-section { margin-top: 20px; }
        .summary-table { width: 100%; border-collapse: collapse; border: 1px solid #333; }
        .summary-table td { padding: 3px 5px; border: 1px solid #333; font-size: 10px; }
        .summary-label { font-weight: bold; width: 60%; }
        .summary-value { text-align: right; width: 40%; font-weight: bold; }
      `;
    } else {
      return `
        @page { size: 80mm auto; margin: 0; }
        .receipt-container { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; font-size: 12px; line-height: 1.2; }
        .header { text-align: center; margin-bottom: 8px; }
        .header h1 { font-size: 12px; font-weight: bold; margin: 0; }
        .header h2 { font-size: 10px; margin: 2px 0; }
        .invoice-section { margin-bottom: 10px; }
        .invoice-header { background-color: #f0f0f0; padding: 5px; margin-bottom: 5px; }
        .invoice-header h3 { font-size: 10px; font-weight: bold; margin: 0; }
        .invoice-header p { font-size: 8px; margin: 1px 0; }
        .invoice-table { width: 100%; border-collapse: collapse; margin: 3px 0; font-size: 8px; border: 1px solid #000; }
        .invoice-table th, .invoice-table td { padding: 1px 1px; text-align: left; border: 1px solid #000; }
        .invoice-table th { background-color: #f0f0f0; font-weight: bold; font-size: 8px; }
        .invoice-table td { font-size: 7px; }
        .col-product { width: 30%; }
        .col-family { width: 20%; }
        .col-qty { width: 10%; text-align: center; }
        .col-price { width: 20%; text-align: right; }
        .col-total { width: 20%; text-align: right; }
        .summary-section { margin-top: 10px; }
        .summary-table { width: 100%; border-collapse: collapse; border: 1px solid #000; }
        .summary-table td { padding: 1px 2px; border: 1px solid #000; font-size: 8px; }
        .summary-label { font-weight: bold; width: 60%; }
        .summary-value { text-align: right; width: 40%; font-weight: bold; }
      `;
    }
  }

  // PDF Workflow Methods
  loadInvoices() {
    this.loading = true;
    const token = this.authService.getToken();
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Load invoices from the depot
    this.http.get<any>(`${environment.apiUrl}/invoices`, { headers })
      .subscribe({
        next: (response) => {
          const invoices = response.invoices || response;
          // Convert invoices to the format expected by the component
          this.tempDrafts = invoices.map((invoice: any) => ({
            id: invoice.id.toString(),
            invoiceNumber: invoice.invoiceNumber || `FAC-${invoice.id}`,
            customerId: invoice.clientId,
            customerName: invoice.customerName || invoice.client?.firstName + ' ' + invoice.client?.lastName || 'Client inconnu',
            customerAddress: invoice.customerAddress || invoice.client?.address || '',
            customerMatricule: invoice.customerMatricule || invoice.client?.code || '',
            date: invoice.issueDate ? invoice.issueDate.split('T')[0] : new Date().toISOString().split('T')[0],
            notes: invoice.notes || '',
            lines: invoice.lines?.map((ligne: any) => ({
              productId: ligne.productId,
              productName: ligne.productName || ligne.product?.name || 'Produit inconnu',
              familleName: ligne.familleName || ligne.product?.famille?.name || 'Général',
              legalDesignation: ligne.legalDesignation || ligne.product?.designation_legale || ligne.productName || 'Produit inconnu',
              quantity: parseFloat(ligne.quantity) || 0,
              prixVenteHTVA: parseFloat(ligne.prixVenteHTVA) || 0,
              prixVenteTTC: parseFloat(ligne.prixVenteTTC) || 0,
              tvaPercent: parseFloat(ligne.tvaPercent) || 19,
              montantTVA: parseFloat(ligne.montantTVA) || 0,
              sousTotalTTC: parseFloat(ligne.sousTotalTTC) || 0
            })) || [],
            totals: {
              subtotalHTVA: parseFloat(invoice.subtotalHTVA) || 0,
              totalTVA: parseFloat(invoice.totalTVA) || 0,
              totalTTC: parseFloat(invoice.totalTTC) || 0
            },
            status: invoice.isTemporary ? 'Draft' : (invoice.status === 'ISSUED' ? 'Numbered' : 'Draft'),
            sourceFilename: invoice.notes?.includes('Importé depuis PDF:') ? 
              invoice.notes.replace('Importé depuis PDF: ', '') : 
              (invoice.source === 'PDF_IMPORT' ? 'PDF Import' : 'Système'),
            createdAt: invoice.createdAt || new Date().toISOString(),
            isTemporary: invoice.isTemporary || false
          }));
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading invoices:', error);
          this.tempDrafts = [];
          this.loading = false;
        }
      });
  }

  loadTempDrafts() {
    // This method is kept for compatibility but now calls loadInvoices
    this.loadInvoices();
  }

  loadCustomers() {
    this.pdfParserService.getCustomers().then(customers => {
      this.customers = customers;
    }).catch(error => {
      console.error('Error loading customers:', error);
    });
  }

  // Drag and Drop handlers
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(Array.from(files));
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
  }

  private handleFiles(files: File[]) {
    files.forEach(file => {
      const validation = this.pdfParserService.validatePDFFile(file);
      if (!validation.valid) {
        this.showError(validation.error || 'Fichier invalide');
        return;
      }

      const pdfFile: PDFFile = {
        file,
        status: 'waiting'
      };

      this.uploadedFiles.push(pdfFile);
      this.parsePDF(pdfFile);
    });
  }

  private async parsePDF(pdfFile: PDFFile) {
    pdfFile.status = 'parsing';
    
    try {
      const result = await this.pdfParserService.parsePDF(pdfFile.file);
      pdfFile.parseResult = result;
      
      if (result.success && result.data) {
        pdfFile.status = 'mapped';
      } else {
        pdfFile.status = 'error';
        pdfFile.error = result.error || 'Erreur lors du parsing';
      }
    } catch (error) {
      pdfFile.status = 'error';
      pdfFile.error = 'Erreur lors du parsing du PDF';
      console.error('PDF parsing error:', error);
    }
  }

  openMappingDialog(pdfFile: PDFFile) {
    if (!pdfFile.parseResult?.data) return;

    // For now, create a simple mapping and proceed
    // In a full implementation, you'd open a modal dialog
    const columnMapping: ColumnMapping = {};
    const headers = pdfFile.parseResult.data.headers;
    
    // Auto-map common columns
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase();
      if (lowerHeader.includes('article') || lowerHeader.includes('produit')) {
        columnMapping[header] = 'Article';
      } else if (lowerHeader.includes('quantité') || lowerHeader.includes('qty')) {
        columnMapping[header] = 'Quantité';
      } else if (lowerHeader.includes('ttc') || lowerHeader.includes('total')) {
        columnMapping[header] = 'PV TTC';
      } else if (lowerHeader.includes('htva') || lowerHeader.includes('ht')) {
        columnMapping[header] = 'PV HTVA';
      } else if (lowerHeader.includes('tva')) {
        columnMapping[header] = 'TVA %';
      } else if (lowerHeader.includes('famille')) {
        columnMapping[header] = 'Famille';
      } else if (lowerHeader.includes('désignation') || lowerHeader.includes('designation')) {
        columnMapping[header] = 'Désignation légale';
      }
    });

    // Use first customer as default
    const defaultCustomer = this.customers[0] || { name: 'Client par défaut' };
    
    const mappingResult = {
      columnMapping,
      customerInfo: {
        customerId: defaultCustomer.id,
        customerName: defaultCustomer.name || defaultCustomer.nom || 'Client par défaut',
        customerAddress: defaultCustomer.address || defaultCustomer.adresse || '',
        customerMatricule: defaultCustomer.matricule || ''
      },
      invoiceDate: new Date().toISOString().split('T')[0],
      notes: `Importé depuis ${pdfFile.file.name}`
    };

    this.createTempDraft(pdfFile, mappingResult);
  }

  private async createTempDraft(pdfFile: PDFFile, mappingResult: ColumnMappingDialogResult) {
    if (!pdfFile.parseResult?.data) return;

    try {
      // Process the PDF data with column mapping
      const mappedData = {
        ...pdfFile.parseResult.data,
        headers: pdfFile.parseResult.data.headers.map(header => 
          mappingResult.columnMapping[header] || header
        )
      };

      const draft = await this.pdfParserService.createTempInvoiceDraft(
        mappedData,
        mappingResult.customerInfo,
        mappingResult.invoiceDate,
        pdfFile.file.name,
        mappingResult.notes
      );

      pdfFile.status = 'draft-created';
      pdfFile.draftId = draft.id;
      
      // Add to temp drafts list
      this.tempDrafts.unshift(draft);
      
      this.showSuccess(`Brouillon créé: ${draft.invoiceNumber}`);
      
    } catch (error) {
      pdfFile.status = 'error';
      pdfFile.error = 'Erreur lors de la création du brouillon';
      this.showError('Erreur lors de la création du brouillon');
      console.error('Draft creation error:', error);
    }
  }

  removeFile(pdfFile: PDFFile) {
    const index = this.uploadedFiles.indexOf(pdfFile);
    if (index > -1) {
      this.uploadedFiles.splice(index, 1);
    }
  }

  async deleteTempDraft(draft: TempInvoiceDraft) {
    if (!confirm(`Supprimer le brouillon ${draft.invoiceNumber} ?`)) {
      return;
    }

    try {
      const success = await this.pdfParserService.deleteTempInvoiceDraft(draft.id);
      if (success) {
        const index = this.tempDrafts.indexOf(draft);
        if (index > -1) {
          this.tempDrafts.splice(index, 1);
        }
        this.showSuccess('Brouillon supprimé');
      } else {
        this.showError('Erreur lors de la suppression');
      }
    } catch (error) {
      this.showError('Erreur lors de la suppression');
      console.error('Delete draft error:', error);
    }
  }

  openDraft(draftId: string) {
    // Find the draft by ID
    const draft = this.tempDrafts.find(d => d.id === draftId);
    if (draft) {
      console.log('Opening draft:', draft);
      this.showDraftModal(draft);
    }
  }

  showDraftModal(draft: TempInvoiceDraft) {
    // Create a modal dialog to display the draft as A4 format
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    
    // Store reference to component methods for use in onclick handlers
    (window as any).handleEditDraft = (draftId: string) => this.handleEditDraft(draftId);
    (window as any).handleFinalizeDraft = (draftId: string) => this.handleFinalizeDraft(draftId);
    
    modal.innerHTML = `
      <div class="bg-white shadow-2xl w-[210mm] h-[297mm] max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Invoice Header -->
        <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold">FACTURE</h1>
              <p class="text-blue-100 text-sm">${draft.invoiceNumber}</p>
            </div>
            <button class="text-white/80 hover:text-white transition-colors" onclick="this.closest('.fixed').remove()">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Invoice Content -->
        <div class="flex-1 p-6 overflow-y-auto">
          <!-- Company & Customer Info -->
          <div class="grid grid-cols-2 gap-8 mb-8">
            <!-- Company Info -->
            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Émetteur</h3>
              <div class="text-sm text-gray-700">
                <p class="font-medium">Patisserie Tunisienne</p>
                <p>123 Rue de la République</p>
                <p>1000 Tunis, Tunisie</p>
                <p class="mt-2">Tél: +216 71 123 456</p>
                <p>Email: contact@patisserie.tn</p>
              </div>
            </div>
            
            <!-- Customer Info -->
            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Client</h3>
              <div class="text-sm text-gray-700">
                <p class="font-medium">${draft.customerName}</p>
                ${draft.customerAddress ? `<p>${draft.customerAddress}</p>` : ''}
                ${draft.customerMatricule ? `<p>Matricule: ${draft.customerMatricule}</p>` : ''}
                <p class="mt-2 text-gray-500">Date: ${new Date(draft.date).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </div>

          <!-- Invoice Lines -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Détail des Articles</h3>
            <div class="border border-gray-200 rounded-lg overflow-hidden">
              <table class="min-w-full">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">Article</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">Désignation</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">Qté</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">Prix HT</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">TVA</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total TTC</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  ${draft.lines.map(line => `
                    <tr class="hover:bg-gray-50">
                      <td class="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                        <div>
                          <div class="font-medium">${line.productName}</div>
                          ${line.familleName ? `<div class="text-xs text-gray-500">${line.familleName}</div>` : ''}
                        </div>
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-700 border-r border-gray-200">${line.legalDesignation}</td>
                      <td class="px-4 py-3 text-sm text-gray-900 text-center border-r border-gray-200">${line.quantity}</td>
                      <td class="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-200">${line.prixVenteHTVA.toFixed(2)} TND</td>
                      <td class="px-4 py-3 text-sm text-gray-900 text-center border-r border-gray-200">${line.tvaPercent}%</td>
                      <td class="px-4 py-3 text-sm font-medium text-gray-900 text-right">${line.sousTotalTTC.toFixed(2)} TND</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Totals -->
          <div class="flex justify-end mb-6">
            <div class="w-80">
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div class="space-y-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600">Sous-total HT:</span>
                    <span class="font-medium">${draft.totals.subtotalHTVA.toFixed(2)} TND</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600">TVA (19%):</span>
                    <span class="font-medium">${draft.totals.totalTVA.toFixed(2)} TND</span>
                  </div>
                  <div class="border-t border-gray-300 pt-2">
                    <div class="flex justify-between text-base font-semibold">
                      <span>Total TTC:</span>
                      <span class="text-blue-600">${draft.totals.totalTTC.toFixed(2)} TND</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Notes -->
          ${draft.notes ? `
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p class="text-sm text-gray-700">${draft.notes}</p>
            </div>
          </div>
          ` : ''}

          <!-- Footer Info -->
          <div class="border-t border-gray-200 pt-4 text-xs text-gray-500">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p><strong>Fichier source:</strong> ${draft.sourceFilename}</p>
                <p><strong>Statut:</strong> <span class="px-2 py-1 rounded-full text-xs font-medium ${this.getDraftStatusColor(draft.status)}">${this.getDraftStatusLabel(draft.status)}</span></p>
              </div>
              <div class="text-right">
                <p><strong>Créé le:</strong> ${new Date(draft.createdAt).toLocaleString('fr-FR')}</p>
                <p><strong>Brouillon temporaire</strong></p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="border-t border-gray-200 bg-gray-50 p-4">
          <div class="flex items-center justify-end space-x-3">
            <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors" onclick="this.closest('.fixed').remove()">
              Fermer
            </button>
            <button class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors" onclick="handleEditDraft('${draft.id}')">
              Modifier
            </button>
            <button class="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors" onclick="handleFinalizeDraft('${draft.id}')">
              Finaliser
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  handleEditDraft(draftId: string) {
    const draft = this.tempDrafts.find(d => d.id === draftId);
    if (draft) {
      // Show confirmation dialog
      if (confirm(`Voulez-vous modifier le brouillon ${draft.invoiceNumber} ?`)) {
        // For now, show a simple edit form
        this.showEditModal(draft);
      }
    }
  }

  showEditModal(draft: TempInvoiceDraft) {
    // Create a simple edit modal
    const editModal = document.createElement('div');
    editModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    editModal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div class="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Modifier le brouillon: ${draft.invoiceNumber}</h3>
          <button class="text-gray-400 hover:text-gray-600" onclick="this.closest('.fixed').remove()">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Nom du Client</label>
              <input type="text" value="${draft.customerName}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Date de Facture</label>
              <input type="date" value="${draft.date}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">${draft.notes || ''}</textarea>
            </div>
            
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p class="text-sm text-yellow-800">
                <strong>Note:</strong> La modification des articles individuels sera disponible dans une version future.
                Pour l'instant, vous pouvez modifier les informations générales du brouillon.
              </p>
            </div>
          </div>
        </div>
        
        <div class="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors" onclick="this.closest('.fixed').remove()">
            Annuler
          </button>
          <button class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors" onclick="alert('Sauvegarde des modifications...'); this.closest('.fixed').remove();">
            Sauvegarder
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(editModal);
    
    // Close modal when clicking outside
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        editModal.remove();
      }
    });
  }

  async handleFinalizeDraft(draftId: string) {
    const draft = this.tempDrafts.find(d => d.id === draftId);
    if (draft) {
      // Show confirmation dialog
      if (confirm(`Voulez-vous finaliser le brouillon ${draft.invoiceNumber} ?\n\nCette action convertira le brouillon en facture définitive.`)) {
        try {
          // Show loading state
          this.showSuccess('Finalisation en cours...');
          
          // Call the backend to finalize the draft
          const success = await this.finalizeTempDraft(draftId);
          
          if (success) {
            // Remove from temp drafts list
            const index = this.tempDrafts.findIndex(d => d.id === draftId);
            if (index > -1) {
              this.tempDrafts.splice(index, 1);
            }
            
            this.showSuccess(`Brouillon ${draft.invoiceNumber} finalisé avec succès!`);
            
            // Close the modal after successful finalization
            const modal = document.querySelector('.fixed.inset-0.bg-black\\/50');
            if (modal) {
              modal.remove();
            }
          } else {
            this.showError('Erreur lors de la finalisation du brouillon');
          }
        } catch (error) {
          this.showError('Erreur lors de la finalisation du brouillon');
          console.error('Finalization error:', error);
        }
      }
    }
  }

  private async finalizeTempDraft(draftId: string): Promise<boolean> {
    const token = this.authService.getToken();
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await this.http.post(`${environment.apiUrl}/invoices/finalize-draft`, 
        { draftId }, 
        { headers }
      ).toPromise();
      
      return response ? true : false;
    } catch (error) {
      console.error('Error finalizing draft:', error);
      return false;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'waiting': return 'bg-gray-100 text-gray-800';
      case 'parsing': return 'bg-blue-100 text-blue-800';
      case 'mapped': return 'bg-yellow-100 text-yellow-800';
      case 'draft-created': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'waiting': return 'En attente';
      case 'parsing': return 'Analyse...';
      case 'mapped': return 'Prêt';
      case 'draft-created': return 'Brouillon créé';
      case 'error': return 'Erreur';
      default: return 'Inconnu';
    }
  }

  getDraftStatusColor(status: string): string {
    switch (status) {
      case 'Draft': return 'bg-yellow-100 text-yellow-800';
      case 'Numbered': return 'bg-green-100 text-green-800';
      case 'Needs Number': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getDraftStatusLabel(status: string): string {
    switch (status) {
      case 'Draft': return 'Brouillon';
      case 'Numbered': return 'Numéroté';
      case 'Needs Number': return 'Besoin numéro';
      default: return 'Inconnu';
    }
  }

  getRowCount(pdfFile: PDFFile): number {
    return pdfFile.parseResult?.data?.rows?.length || 0;
  }

  getHeaderCount(pdfFile: PDFFile): number {
    return pdfFile.parseResult?.data?.headers?.length || 0;
  }

  private showSuccess(message: string) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (document.body.contains(successDiv)) {
        document.body.removeChild(successDiv);
      }
    }, 3000);
  }

  private showError(message: string) {
    // Create a temporary error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(errorDiv)) {
        document.body.removeChild(errorDiv);
      }
    }, 5000);
  }

  // Import method for PDF files
  importPDF(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.multiple = true;
    input.style.display = 'none';
    
    input.onchange = (event: any) => {
      const files = Array.from(event.target.files);
      if (files.length > 0) {
        this.handleFiles(files as File[]);
      }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }
}
