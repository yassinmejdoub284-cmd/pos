import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { ClientsService } from '../core/services/clients.service';
import { Client } from '../core/models/client.model';
import { ProductsService } from '../core/services/products.service';
import { EnterpriseService } from '../core/services/enterprise.service';
import { Product } from '../core/models/product.model';

interface InvoiceItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isConfirmed: boolean;
}

@Component({
  selector: 'app-invoices',
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.css'],
  standalone: false
})
export class InvoicesComponent implements OnInit {
  invoices: any[] = [];
  loading = false;
  error = '';
  
  // Filters
  searchQuery = '';
  selectedStatus = '';
  selectedSource = '';
  startDate = '';
  endDate = '';
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 20;
  totalItems = 0;
  totalPages = 0;
  
  // Alert system
  showAlert = false;
  alertMessage = '';
  alertType: 'success' | 'error' | 'info' = 'info';

  // Invoice preview modal
  showInvoicePreviewModal = false;
  selectedInvoice: any = null;
  invoicePreviewHTML = '';

  // Client selection for invoice creation
  // Company selection comes first when adding
  showCompanySelection = false;
  companies: any[] = [];
  filteredCompanies: any[] = [];
  selectedCompany: any | null = null;
  companySearchQuery = '';
  loadingCompanies = false;

  showClientSelection = false;
  clients: Client[] = [];
  filteredClients: Client[] = [];
  selectedClient: Client | null = null;
  clientSearchQuery = '';
  clientFilterType: 'billing-only' | 'all' | 'depot-assigned' = 'billing-only';
  loadingClients = false;

  // Product selection for invoice creation
  showProductSelection = false;
  allProducts: Product[] = [];
  filteredProducts: Product[] = [];
  productCategories: string[] = ['Tous', 'Pâtisserie', 'Viennoiserie', 'Boulangerie', 'Boissons', 'Vrac', 'Pâtisserie Tunisienne', 'Jus et Smoothies'];
  selectedCategory: string = 'Tous';
  productSearchQuery = '';
  loadingProducts = false;

  // Invoice cart (like count items in inventory)
  invoiceItems: InvoiceItem[] = [];
  selectedInvoiceItem: InvoiceItem | null = null;
  selectedInvoiceItemIndex: number = -1;

  // Input handling (like inventory count)
  currentInput: string = '';
  pendingProduct: Product | null = null;

  // Invoice generation
  generatingInvoice = false;
  generatedInvoice: any = null;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private clientsService: ClientsService,
    private productsService: ProductsService,
    private enterpriseService: EnterpriseService
  ) {}

  ngOnInit(): void {
    // Check if we're in "add" mode
    this.route.queryParams.subscribe(params => {
      if (params['action'] === 'add') {
        if (params['clientId']) {
          // Client already selected, show product selection
          this.showProductSelection = true;
          this.loadProductsForSelection();
          this.loadSelectedClient(params['clientId']);
        } else if (params['companyId']) {
          // Company preselected, load it then show clients
          this.loadSelectedCompany(Number(params['companyId']));
          this.showClientSelection = true;
          this.loadClientsForSelection();
        } else {
          // Ask for company first
          this.showCompanySelection = true;
          this.loadCompaniesForSelection();
        }
      } else {
        this.loadInvoices();
      }
    });
  }

  loadInvoices(): void {
    this.loading = true;
    this.error = '';

    const params: any = {
      page: this.currentPage,
      limit: this.itemsPerPage
    };

    if (this.selectedStatus) params.status = this.selectedStatus;
    if (this.selectedSource) params.source = this.selectedSource;

    this.http.get(`${environment.apiUrl}/invoices`, { params }).subscribe({
      next: (response: any) => {
        this.invoices = response.invoices;
        this.totalItems = response.pagination.total;
        this.totalPages = response.pagination.pages;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading invoices:', error);
        this.error = 'Erreur lors du chargement des factures';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadInvoices();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.selectedSource = '';
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1;
    this.loadInvoices();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadInvoices();
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND'
    }).format(amount);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'DRAFT': return 'bg-yellow-100 text-yellow-800';
      case 'ISSUED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'DRAFT': return 'Brouillon';
      case 'ISSUED': return 'Émise';
      case 'CANCELLED': return 'Annulée';
      default: return status;
    }
  }

  getSourceText(source: string): string {
    switch (source) {
      case 'DAILY_EXTRACT': return 'Extrait journalier';
      case 'TICKET_REQUEST': return 'Demande ticket';
      default: return source;
    }
  }

  viewInvoice(invoice: any): void {
    // Show invoice preview in modal dialog
    this.openInvoicePreviewModal(invoice);
  }

  private openInvoicePreviewModal(invoice: any): void {
    // Validate invoice data before showing preview
    if (!invoice) {
      this.showAlertMessage('Erreur: Aucune facture sélectionnée', 'error');
      return;
    }

    if (!invoice.lines || !Array.isArray(invoice.lines) || invoice.lines.length === 0) {
      this.showAlertMessage('Erreur: Aucune ligne de facture trouvée', 'error');
      return;
    }

    try {
      this.selectedInvoice = invoice;
      this.invoicePreviewHTML = this.generateInvoiceHTML(invoice);
      this.showInvoicePreviewModal = true;
    } catch (error) {
      console.error('Error generating invoice preview:', error);
      this.showAlertMessage('Erreur lors de la génération de l\'aperçu', 'error');
    }
  }

  closeInvoicePreviewModal(): void {
    this.showInvoicePreviewModal = false;
    this.selectedInvoice = null;
    this.invoicePreviewHTML = '';
  }


  private generateInvoiceHTML(invoice: any): string {
    const now = new Date();
    const invoiceDate = invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('fr-FR') : 'N/A';
    const invoiceTime = invoice.createdAt ? new Date(invoice.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    
    // Calculate totals
    let totalHTVA = 0;
    let totalTVA = 0;
    let totalTTC = 0;

    // VAT breakdown by rate
    const vatBreakdown: { [key: number]: { baseHT: number; montantTVA: number } } = {};

    // Ensure lines exist and is an array
    const lines = invoice.lines || [];
    const linesHTML = lines.map((line: any) => {
      // Validate line data - use the correct field names from the backend
      const prixVenteTTC = Number(line.prixVenteTTC) || 0;
      const prixVenteHTVA = Number(line.prixVenteHTVA) || 0;
      const montantTVA = Number(line.montantTVA) || 0;
      const quantity = Number(line.quantity) || 0;
      const tvaPercent = Number(line.tvaPercent) || 0;
      const sousTotalTTC = Number(line.sousTotalTTC) || 0;
      
      const baseHT = quantity * prixVenteHTVA;
      const montantTVAForLine = quantity * montantTVA;
      
      totalHTVA += baseHT;
      totalTVA += montantTVAForLine;
      totalTTC += sousTotalTTC;

      // Add to VAT breakdown
      if (!vatBreakdown[tvaPercent]) {
        vatBreakdown[tvaPercent] = { baseHT: 0, montantTVA: 0 };
      }
      vatBreakdown[tvaPercent].baseHT += baseHT;
      vatBreakdown[tvaPercent].montantTVA += montantTVAForLine;

      return `
        <tr>
          <td>${line.product?.famille?.name || line.familleName || 'N/A'}</td>
          <td>${line.product?.designation_legale || line.legalDesignation || line.product?.name || line.productName || 'Produit inconnu'}</td>
          <td class="text-right">${quantity}</td>
          <td class="text-right">${prixVenteHTVA.toFixed(3)} dt</td>
          <td class="text-right">${tvaPercent}%</td>
          <td class="text-right">${montantTVAForLine.toFixed(3)} dt</td>
          <td class="text-right">${prixVenteTTC.toFixed(3)} dt</td>
          <td class="text-right">${sousTotalTTC.toFixed(3)} dt</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Facture ${invoice.invoiceNumber}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            color: #333;
            font-size: 12px;
          }
          .container { 
            max-width: 800px; 
            margin: 0 auto; 
            border: 1px solid #ddd;
            padding: 20px;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .company-info {
            flex: 1;
          }
          .invoice-info {
            text-align: right;
            flex: 1;
          }
          .title { 
            font-size: 24px; 
            font-weight: bold; 
            margin-bottom: 10px;
          }
          .subtitle {
            font-size: 18px;
            color: #666;
            margin-bottom: 20px;
          }
          .info-row {
            margin: 5px 0;
          }
          .label {
            font-weight: bold;
            display: inline-block;
            width: 120px;
          }
          .customer-section {
            margin: 20px 0;
            padding: 15px;
            background-color: #f9f9f9;
            border-left: 4px solid #007bff;
          }
          .customer-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #007bff;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
            font-weight: bold;
            text-align: center;
          }
          .text-right {
            text-align: right;
          }
          .totals {
            margin-top: 20px;
            text-align: right;
          }
          .total-row {
            margin: 5px 0;
            font-size: 14px;
          }
          .total-final {
            font-weight: bold;
            font-size: 16px;
            border-top: 2px solid #333;
            padding-top: 10px;
            margin-top: 10px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .container { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="company-info">
              <div class="title">PÂTISSERIE DELICE</div>
              <div class="info-row"><span class="label">Adresse:</span> 123 Rue de la Patisserie, Tunis, Tunisie</div>
              <div class="info-row"><span class="label">Téléphone:</span> +216 71 123 456</div>
              <div class="info-row"><span class="label">Email:</span> contact@patisseriedelice.tn</div>
              <div class="info-row"><span class="label">Matricule Fiscal:</span> 12345678/A/M/000</div>
            </div>
            <div class="invoice-info">
              <div class="subtitle">FACTURE</div>
              <div class="info-row"><span class="label">N° Facture:</span> ${invoice.invoiceNumber}</div>
              <div class="info-row"><span class="label">Date:</span> ${invoiceDate}</div>
              <div class="info-row"><span class="label">Heure:</span> ${invoiceTime}</div>
              <div class="info-row"><span class="label">Mode de paiement:</span> ${invoice.paymentMethod || 'Non spécifié'}</div>
            </div>
          </div>

          <div class="customer-section">
            <div class="customer-title">INFORMATIONS CLIENT</div>
            <div class="info-row"><span class="label">Nom:</span> ${invoice.client?.firstName || ''} ${invoice.client?.lastName || 'Client anonyme'}</div>
            <div class="info-row"><span class="label">Adresse:</span> ${invoice.client?.address || 'Non spécifiée'}</div>
            <div class="info-row"><span class="label">Téléphone:</span> ${invoice.client?.phone || 'Non spécifié'}</div>
            ${invoice.client?.matriculeFiscal ? `<div class="info-row"><span class="label">Matricule Fiscal:</span> ${invoice.client.matriculeFiscal}</div>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th>Famille</th>
                <th>Article</th>
                <th>Qté</th>
                <th>PV HTVA</th>
                <th>TVA %</th>
                <th>Montant TVA</th>
                <th>PV TTC</th>
                <th>Sous-total TTC</th>
              </tr>
            </thead>
            <tbody>
              ${linesHTML || '<tr><td colspan="8" class="text-center">Aucune ligne de facture trouvée</td></tr>'}
            </tbody>
          </table>

          <!-- Footer with two columns: VAT breakdown on left, totals on right -->
          <div style="display: flex; gap: 30px; margin-top: 30px;">
            <!-- Left column: VAT Breakdown -->
            <div style="flex: 1;">
              <h4 style="font-size: 14px; font-weight: bold; margin: 0 0 10px 0; text-align: left;">RÉCAPITULATIF TVA</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f5f5f5;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">Base HT</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">% TVA</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">Montant TVA</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.keys(vatBreakdown).map(rate => {
                    const rateNum = Number(rate);
                    const breakdown = vatBreakdown[rateNum];
                    return `
                      <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${breakdown.baseHT.toFixed(2)} dt</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${rateNum}%</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${breakdown.montantTVA.toFixed(2)} dt</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Right column: Totals -->
            <div style="flex: 1; text-align: right;">
              <h4 style="font-size: 14px; font-weight: bold; margin: 0 0 10px 0; text-align: right;">TOTAUX</h4>
              <div style="background-color: #f9f9f9; padding: 15px; border: 1px solid #ddd;">
                <div style="margin: 8px 0; font-size: 14px;">
                  <span style="font-weight: bold;">Total HTVA:</span> 
                  <span style="float: right; font-weight: bold;">${totalHTVA.toFixed(3)} dt</span>
                </div>
                <div style="margin: 8px 0; font-size: 14px;">
                  <span style="font-weight: bold;">Total TVA:</span> 
                  <span style="float: right; font-weight: bold;">${totalTVA.toFixed(3)} dt</span>
                </div>
                <div style="margin: 8px 0; font-size: 14px;">
                  <span style="font-weight: bold;">Remise:</span> 
                  <span style="float: right; font-weight: bold;">0,000 dt</span>
                </div>
                <div style="margin: 8px 0; font-size: 16px; border-top: 2px solid #333; padding-top: 8px;">
                  <span style="font-weight: bold;">Total TTC:</span> 
                  <span style="float: right; font-weight: bold;">${totalTTC.toFixed(3)} dt</span>
                </div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Merci pour votre achat!</p>
            <p>Cette facture a été générée le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  showAlertMessage(message: string, type: 'success' | 'error' | 'info'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.showAlert = true;
    
    setTimeout(() => {
      this.showAlert = false;
    }, 5000);
  }

  // Client selection methods
  // Company selection methods
  loadCompaniesForSelection(): void {
    this.loadingCompanies = true;
    this.error = '';

    this.enterpriseService.listCompanies().subscribe({
      next: (companies) => {
        this.companies = companies || [];
        this.filterCompanies();
        this.loadingCompanies = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des sociétés';
        this.loadingCompanies = false;
        console.error('Error loading companies:', error);
      }
    });
  }

  filterCompanies(): void {
    const query = this.companySearchQuery.trim().toLowerCase();
    this.filteredCompanies = !query
      ? [...this.companies]
      : this.companies.filter((c: any) =>
          (c.raisonSociale || '').toLowerCase().includes(query) ||
          (c.matriculeFiscal || '').toLowerCase().includes(query) ||
          (c.ville || '').toLowerCase().includes(query)
        );
  }

  onCompanySearchChange(): void {
    this.filterCompanies();
  }

  selectCompany(company: any): void {
    this.selectedCompany = company;
    this.showCompanySelection = false;
    // Move to client selection; keep URL param for deep-linking
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { action: 'add', companyId: company.id },
      queryParamsHandling: 'merge'
    });
    this.showClientSelection = true;
    this.loadClientsForSelection();
    this.showAlertMessage(`Société sélectionnée: ${company.raisonSociale}`, 'success');
  }

  cancelCompanySelection(): void {
    this.showCompanySelection = false;
    this.selectedCompany = null;
    this.companySearchQuery = '';
    this.router.navigate(['/invoices']);
  }

  loadSelectedCompany(companyId: number): void {
    this.enterpriseService.getCompany(companyId).subscribe({
      next: (company) => {
        this.selectedCompany = company;
      },
      error: () => {
        this.showAlertMessage('Erreur lors du chargement de la société', 'error');
      }
    });
  }

  // Client selection methods
  loadClientsForSelection(): void {
    this.loadingClients = true;
    this.error = '';

    // Load all active clients
    this.clientsService.getClients(1, 1000, undefined, '', true).subscribe({
      next: (response) => {
        this.clients = response.clients || [];
        this.filterClients();
        this.loadingClients = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des clients';
        this.loadingClients = false;
        console.error('Error loading clients:', error);
      }
    });
  }

  filterClients(): void {
    let filtered = [...this.clients];

    // Apply filter type
    switch (this.clientFilterType) {
      case 'billing-only':
        // Only clients assigned for invoicing (depotId = null)
        filtered = filtered.filter(client => client.depotId === null);
        break;
      case 'depot-assigned':
        // Only clients assigned to specific depots (depotId > 0)
        filtered = filtered.filter(client => client.depotId && client.depotId > 0);
        break;
      case 'all':
        // All clients (no filtering)
        break;
    }

    // Apply search query
    if (this.clientSearchQuery.trim()) {
      const query = this.clientSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(client => 
        client.firstName.toLowerCase().includes(query) ||
        client.lastName.toLowerCase().includes(query) ||
        client.code.toLowerCase().includes(query) ||
        (client.phone && client.phone.includes(query))
      );
    }

    this.filteredClients = filtered;
  }

  onClientFilterChange(): void {
    this.filterClients();
  }

  onClientSearchChange(): void {
    this.filterClients();
  }

  selectClient(client: Client): void {
    this.selectedClient = client;
    this.showClientSelection = false;
    this.showProductSelection = true;
    this.loadProductsForSelection();
    this.showAlertMessage(`Client sélectionné: ${client.firstName} ${client.lastName}`, 'success');
  }

  cancelClientSelection(): void {
    this.showClientSelection = false;
    this.selectedClient = null;
    this.clientSearchQuery = '';
    this.clientFilterType = 'billing-only';
    this.router.navigate(['/invoices']);
  }

  getClientTypeText(type: string): string {
    switch (type) {
      case 'INDIVIDUAL': return 'Particulier';
      case 'BUSINESS': return 'Entreprise';
      case 'WHOLESALE': return 'Gros';
      default: return type;
    }
  }

  getClientTypeColor(type: string): string {
    switch (type) {
      case 'INDIVIDUAL': return 'bg-blue-100 text-blue-800';
      case 'BUSINESS': return 'bg-green-100 text-green-800';
      case 'WHOLESALE': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getDepotInfo(client: Client): string {
    if (client.depotId === null) {
      return 'Facturation uniquement';
    } else if (client.depotId === -1) {
      return 'Tous les dépôts';
    } else if (client.depot) {
      return client.depot.name;
    } else {
      return 'Dépôt assigné';
    }
  }

  // Product selection methods
  loadProductsForSelection(): void {
    this.loadingProducts = true;
    this.error = '';

    this.productsService.getProducts().subscribe({
      next: (products) => {
        this.allProducts = products;
        this.filteredProducts = [...products];
        this.loadingProducts = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des produits';
        this.loadingProducts = false;
        console.error('Error loading products:', error);
      }
    });
  }

  loadSelectedClient(clientId: string): void {
    this.clientsService.getClient(parseInt(clientId, 10)).subscribe({
      next: (client) => {
        this.selectedClient = client;
      },
      error: (error) => {
        console.error('Error loading client:', error);
        this.showAlertMessage('Erreur lors du chargement du client', 'error');
      }
    });
  }

  selectProductCategory(category: string): void {
    this.selectedCategory = category;
    this.filterProducts();
  }

  filterProducts(): void {
    let filtered = [...this.allProducts];

    // Apply category filter
    if (this.selectedCategory !== 'Tous') {
      filtered = filtered.filter(product => 
        product.famille?.name === this.selectedCategory
      );
    }

    // Apply search query
    if (this.productSearchQuery.trim()) {
      const query = this.productSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.barcode?.toLowerCase().includes(query) ||
        product.famille?.name.toLowerCase().includes(query)
      );
    }

    this.filteredProducts = filtered;
  }

  onProductSearchChange(): void {
    this.filterProducts();
  }

  // Product selection (like inventory count)
  handleProductClick(product: Product): void {
    // Check if product already exists in invoice items
    const existingItem = this.invoiceItems.find(item => item.product.id === product.id);
    
    if (existingItem) {
      // Product exists - select it for quantity modification
      this.selectInvoiceItem(existingItem);
      this.pendingProduct = product;
      this.currentInput = existingItem.quantity.toString();
    } else {
      // New product - add to invoice items
      this.addProductToInvoice(product);
      this.pendingProduct = product;
      this.currentInput = '';
    }
  }

  addProductToInvoice(product: Product): void {
    const invoiceItem: InvoiceItem = {
      product: product,
      quantity: 0,
      unitPrice: product.prix_vente_TTC || 0,
      totalPrice: 0,
      isConfirmed: false
    };
    
    this.invoiceItems.push(invoiceItem);
  }

  selectInvoiceItem(item: InvoiceItem): void {
    const index = this.invoiceItems.indexOf(item);
    this.selectedInvoiceItem = item;
    this.selectedInvoiceItemIndex = index;
    this.pendingProduct = item.product;
    this.currentInput = item.quantity.toString();
  }

  // Input handling (like inventory count)
  addToInput(value: string): void {
    this.currentInput += value;
  }

  clearInput(): void {
    this.currentInput = '';
  }

  addDecimal(): void {
    if (!this.currentInput.includes('.')) {
      this.currentInput += '.';
    }
  }

  clearDisplay(): void {
    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
    }
  }

  enterValue(): void {
    if (this.pendingProduct) {
      const value = parseFloat(this.currentInput);
      
      if (isNaN(value) || value < 0) {
        this.error = 'Valeur invalide (minimum 0)';
        return;
      }
      
      // Update or add the invoice item
      const existingItem = this.invoiceItems.find(item => item.product.id === this.pendingProduct!.id);
      
      if (existingItem) {
        existingItem.quantity = value;
        existingItem.totalPrice = value * existingItem.unitPrice;
        existingItem.isConfirmed = true;
      } else {
        this.addProductToInvoice(this.pendingProduct);
        const newItem = this.invoiceItems[this.invoiceItems.length - 1];
        newItem.quantity = value;
        newItem.totalPrice = value * newItem.unitPrice;
        newItem.isConfirmed = true;
      }
      
      this.pendingProduct = null;
      this.currentInput = '';
    }
  }

  removeInvoiceItem(index: number): void {
    this.invoiceItems.splice(index, 1);
    if (this.selectedInvoiceItemIndex === index) {
      this.selectedInvoiceItem = null;
      this.selectedInvoiceItemIndex = -1;
      this.pendingProduct = null;
      this.currentInput = '';
    } else if (this.selectedInvoiceItemIndex > index) {
      this.selectedInvoiceItemIndex--;
    }
  }

  // Utility methods
  getTotalAmount(): number {
    return this.invoiceItems.reduce((total, item) => total + item.totalPrice, 0);
  }

  getProductCardClass(productId: number): string {
    const baseClass = 'product-button bg-white border border-gray-200 rounded-lg p-2 text-center transition-colors duration-150 cursor-pointer shadow-sm relative select-none';
    const isSelected = this.invoiceItems.some(item => item.product.id === productId);
    
    if (isSelected) {
      return baseClass + ' border-blue-500 bg-blue-50';
    } else {
      return baseClass;
    }
  }

  trackByProductId(index: number, product: Product): number {
    return product.id;
  }

  truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }


  // Navigation methods
  goBackToClientSelection(): void {
    this.showProductSelection = false;
    this.showClientSelection = true;
    this.invoiceItems = [];
    this.selectedInvoiceItem = null;
    this.selectedInvoiceItemIndex = -1;
    this.pendingProduct = null;
    this.currentInput = '';
  }

  cancelProductSelection(): void {
    this.showProductSelection = false;
    this.selectedClient = null;
    this.invoiceItems = [];
    this.selectedInvoiceItem = null;
    this.selectedInvoiceItemIndex = -1;
    this.pendingProduct = null;
    this.currentInput = '';
    this.router.navigate(['/invoices']);
  }

  // Math reference for template
  Math = Math;

  // Invoice generation methods
  generateInvoice(): void {
    if (!this.selectedClient || this.invoiceItems.length === 0) {
      this.showAlertMessage('Veuillez sélectionner un client et des produits', 'error');
      return;
    }

    this.generatingInvoice = true;
    this.error = '';

    // Prepare invoice data
    const invoiceData = {
      companyId: this.selectedCompany?.id ?? null,
      clientId: this.selectedClient.id,
      items: this.invoiceItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      })),
      totalAmount: this.getTotalAmount(),
      status: 'DRAFT'
    };

    // Generate invoice
    this.http.post(`${environment.apiUrl}/invoices`, invoiceData).subscribe({
      next: (response: any) => {
        this.generatedInvoice = response;
        this.generateInvoicePreview();
        this.generatingInvoice = false;
        this.showAlertMessage('Facture générée avec succès!', 'success');
      },
      error: (error) => {
        this.generatingInvoice = false;
        this.error = 'Erreur lors de la génération de la facture';
        console.error('Error generating invoice:', error);
        this.showAlertMessage('Erreur lors de la génération de la facture', 'error');
      }
    });
  }

  generateInvoicePreview(): void {
    if (!this.generatedInvoice || !this.selectedClient) return;

    // Use the existing professional invoice format
    this.invoicePreviewHTML = this.generateInvoiceHTML(this.generatedInvoice);
    this.showInvoicePreviewModal = true;
  }

  printInvoice(): void {
    if (!this.invoicePreviewHTML) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Facture - ${this.selectedClient?.firstName} ${this.selectedClient?.lastName}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
              .container { max-width: 800px; margin: 0 auto; }
              .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
              .company-info { flex: 1; }
              .invoice-info { text-align: right; flex: 1; }
              .title { font-size: 20px; font-weight: bold; margin-bottom: 8px; }
              .subtitle { font-size: 16px; color: #666; margin-bottom: 15px; }
              .info-row { margin: 3px 0; font-size: 11px; }
              .label { font-weight: bold; display: inline-block; width: 100px; }
              .customer-section { margin: 15px 0; padding: 12px; background-color: #f9f9f9; border-left: 4px solid #007bff; }
              .customer-title { font-weight: bold; margin-bottom: 8px; color: #007bff; font-size: 13px; }
              table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 11px; }
              th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
              th { background-color: #f5f5f5; font-weight: bold; text-align: center; font-size: 10px; }
              .text-right { text-align: right; }
              .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
              @media print { body { margin: 0; padding: 10px; } }
            </style>
          </head>
          <body>
            ${this.invoicePreviewHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }

  closeInvoicePreview(): void {
    this.showInvoicePreviewModal = false;
    this.invoicePreviewHTML = '';
    this.generatedInvoice = null;
  }
}
