import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { StockDocument } from '../../core/models/stock-document.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <!-- Header -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-lg border border-slate-200/50">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"></path>
              </svg>
            </div>
            <div>
              <h1 class="text-2xl font-bold text-slate-800">Documents Stock</h1>
              <p class="text-slate-600 font-medium">Traçabilité & historique des mouvements</p>
            </div>
          </div>
          <a routerLink="/stock"
            class="bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg flex items-center gap-2"
            title="Retour Stock">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"></path>
            </svg>
            Retour
          </a>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-lg border border-slate-200/50">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Type de document</label>
            <select [(ngModel)]="selectedType" (change)="loadDocuments()" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Tous les types</option>
              <option value="BON_ENTREE_DEPOT">Bon d'entrée</option>
              <option value="BON_EXPEDITION">Bon d'expédition</option>
              <option value="BON_TRANSFERT">Bon de transfert</option>
              <option value="BON_ENTREE_MAGASIN">Bon d'entrée magasin</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <select [(ngModel)]="selectedStatus" (change)="loadDocuments()" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Tous les statuts</option>
              <option value="PREPARED">Préparé</option>
              <option value="SENT">Envoyé</option>
              <option value="RECEIVED">Reçu</option>
              <option value="CANCELLED">Annulé</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Date de début</label>
            <input [(ngModel)]="dateFrom" (change)="loadDocuments()" type="date" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Date de fin</label>
            <input [(ngModel)]="dateTo" (change)="loadDocuments()" type="date" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          </div>
        </div>
      </div>

      <!-- Documents List -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold text-slate-800">Documents ({{ totalDocuments() }})</h2>
            <div *ngIf="loading" class="text-blue-600 text-sm">Chargement...</div>
          </div>

          <div *ngIf="loading && documents().length === 0" class="text-center py-16">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p class="text-gray-600 mt-4">Chargement des documents...</p>
          </div>

          <div *ngIf="!loading && documents().length === 0" class="text-center py-16">
            <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Aucun document trouvé</h3>
            <p class="text-gray-600">Aucun document ne correspond aux critères sélectionnés.</p>
          </div>

          <div *ngIf="documents().length > 0" class="space-y-4">
            <div *ngFor="let doc of documents()" [id]="'document-' + doc.id" class="border border-gray-200 rounded-lg p-4 transition-shadow duration-200">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <span [class]="getTypeBadgeClass(doc.type)" class="px-3 py-1 rounded-full text-xs font-medium">
                      {{ getTypeLabel(doc.type) }}
                    </span>
                    <span [class]="getStatusBadgeClass(doc.status)" class="px-3 py-1 rounded-full text-xs font-medium">
                      {{ getStatusLabel(doc.status) }}
                    </span>
                  </div>
                  
                  <h3 class="text-lg font-semibold text-gray-900 mb-1">{{ doc.numero }}</h3>
                  
                  <div class="text-sm text-gray-600 space-y-1">
                    <div *ngIf="doc.emetteur">
                      <span class="font-medium">De:</span> {{ doc.emetteur.name }}
                    </div>
                    <div *ngIf="doc.destinataire">
                      <span class="font-medium">Vers:</span> {{ doc.destinataire.name }}
                    </div>
                    <div>
                      <span class="font-medium">Créé le:</span> {{ formatDate(doc.createdAt) }}
                    </div>
                    <div *ngIf="doc.items && doc.items.length > 0">
                      <span class="font-medium">Articles:</span> {{ doc.items.length }} produit{{ doc.items.length > 1 ? 's' : '' }}
                    </div>
                  </div>
                  
                  <div *ngIf="doc.notes" class="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                    <span class="font-medium">Notes:</span> {{ doc.notes }}
                  </div>
                </div>
                
                <div class="flex flex-col gap-2 ml-4">
                  <button (click)="viewDocument(doc)" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors duration-200">
                    Voir détails
                  </button>
                  <button *ngIf="canValidate(doc)" (click)="validateDocument(doc)" class="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium transition-colors duration-200">
                    Valider
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div *ngIf="totalPages() > 1" class="mt-6 flex justify-center">
            <div class="flex gap-2">
              <button (click)="previousPage()" [disabled]="currentPage() === 1" 
                      class="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                Précédent
              </button>
              <span class="px-3 py-2 text-sm text-gray-600">
                Page {{ currentPage() }} sur {{ totalPages() }}
              </span>
              <button (click)="nextPage()" [disabled]="currentPage() === totalPages()" 
                      class="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                Suivant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Document Details Dialog -->
    <div *ngIf="showDocumentDetails && selectedDocument()" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-bold">Détails du Document</h2>
              <p class="text-purple-100 mt-1">{{ selectedDocument()?.numero }} - {{ getTypeLabel(selectedDocument()?.type || '') }}</p>
            </div>
            <div class="flex gap-2">
              <button (click)="printDocument()" 
                      class="bg-white/20 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                </svg>
                Imprimer
              </button>
              <button (click)="closeDocumentDetails()" class="text-white transition-colors" title="Fermer">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Content -->
        <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <!-- Document Info -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="bg-gray-50 rounded-lg p-4">
              <h3 class="font-semibold text-gray-800 mb-3">Informations Générales</h3>
              <div class="space-y-2 text-sm">
                <div><span class="font-medium">Numéro:</span> {{ selectedDocument()?.numero }}</div>
                <div><span class="font-medium">Type:</span> {{ getTypeLabel(selectedDocument()?.type || '') }}</div>
                <div><span class="font-medium">Statut:</span> 
                  <span [class]="getStatusBadgeClass(selectedDocument()?.status || '')" class="px-2 py-1 rounded-full text-xs font-medium">
                    {{ getStatusLabel(selectedDocument()?.status || '') }}
                  </span>
                </div>
                <div><span class="font-medium">Date de création:</span> {{ formatDate(selectedDocument()?.createdAt || '') }}</div>
              </div>
            </div>

            <div class="bg-gray-50 rounded-lg p-4">
              <h3 class="font-semibold text-gray-800 mb-3">Parties</h3>
              <div class="space-y-2 text-sm">
                <div *ngIf="selectedDocument()?.emetteur">
                  <span class="font-medium">De:</span> {{ selectedDocument()?.emetteur?.name }}
                </div>
                <div *ngIf="selectedDocument()?.destinataire">
                  <span class="font-medium">Vers:</span> {{ selectedDocument()?.destinataire?.name }}
                </div>
                <div *ngIf="getSupplierName(selectedDocument())">
                  <span class="font-medium">Fournisseur:</span> {{ getSupplierName(selectedDocument()) }}
                </div>
                <div *ngIf="selectedDocument()?.supplier?.taxNumber">
                  <span class="font-medium">M.F:</span> {{ selectedDocument()?.supplier?.taxNumber }}
                </div>
                <div *ngIf="selectedDocument()?.notes && !selectedDocument()?.notes?.includes('Supplier:')">
                  <span class="font-medium">Notes:</span> {{ selectedDocument()?.notes }}
                </div>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div class="bg-gray-50 px-4 py-3 border-b">
              <h3 class="font-semibold text-gray-800">Articles ({{ selectedDocument()?.items?.length || 0 }})</h3>
            </div>
            
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-gray-100">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantité</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prix d'achat</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr *ngFor="let item of selectedDocument()?.items; index as i">
                    <td class="px-4 py-3 text-sm text-gray-900">{{ i + 1 }}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">
                      <div class="font-medium">{{ item.product?.name || 'Produit #' + item.productId }}</div>
                      <div *ngIf="item.batch" class="text-xs text-gray-500">Lot: {{ item.batch }}</div>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-900 text-right">{{ safeToFixed(item.quantity) }}</td>
                    <td class="px-4 py-3 text-sm text-gray-900 text-right">{{ safeToFixed(item.purchasePrice || item.product?.prix_achat || 0) }} dt</td>
                    <td class="px-4 py-3 text-sm font-medium text-gray-900 text-right">{{ safeToFixed(item.quantity * (item.purchasePrice || item.product?.prix_achat || 0)) }} dt</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Totals -->
            <div class="bg-gray-50 px-4 py-3 border-t">
              <div class="flex justify-end">
                <div class="text-right space-y-1">
                  <div class="text-sm text-gray-600">
                    <span class="font-medium">Quantité totale:</span> 
                    {{ safeToFixed(selectedDocumentTotalQuantity()) }}
                  </div>
                  <div class="text-lg font-bold text-gray-900">
                    <span class="font-medium">Montant total:</span> 
                    {{ safeToFixed(selectedDocumentTotalAmount()) }} dt
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DocumentsComponent implements OnInit {
  documents = signal<StockDocument[]>([]);
  loading = false;
  error = '';
  
  // Filters
  selectedType = '';
  selectedStatus = '';
  dateFrom = '';
  dateTo = '';
  
  // Pagination
  currentPage = signal(1);
  totalDocuments = signal(0);
  pageSize = 20;
  
  totalPages = computed(() => Math.ceil(this.totalDocuments() / this.pageSize));

  // Document details
  showDocumentDetails = false;
  selectedDocument = signal<StockDocument | null>(null);
  companySettings: any = null;

  // Computed properties for totals
  selectedDocumentTotalQuantity = computed(() => {
    const doc = this.selectedDocument();
    if (!doc?.items || !Array.isArray(doc.items)) return 0;
    const total = doc.items.reduce((sum, item) => {
      // Handle both string and number types from database
      let quantity: number;
      if (typeof item.quantity === 'string') {
        quantity = parseFloat(item.quantity) || 0;
      } else {
        quantity = Number(item.quantity) || 0;
      }
      return sum + quantity;
    }, 0);
    return total;
  });

  selectedDocumentTotalAmount = computed(() => {
    const doc = this.selectedDocument();
    if (!doc?.items || !Array.isArray(doc.items)) return 0;
    const total = doc.items.reduce((sum, item) => {
      // Handle both string and number types from database
      let quantity: number;
      if (typeof item.quantity === 'string') {
        quantity = parseFloat(item.quantity) || 0;
      } else {
        quantity = Number(item.quantity) || 0;
      }
      
      let price: number;
      const purchasePrice = item.purchasePrice || item.product?.prix_achat || 0;
      if (typeof purchasePrice === 'string') {
        price = parseFloat(purchasePrice) || 0;
      } else {
        price = Number(purchasePrice) || 0;
      }
      
      return sum + (quantity * price);
    }, 0);
    return total;
  });

  constructor(
    private stockDocsService: StockDocumentsService, 
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  // Helper method to safely format numbers
  safeToFixed(value: number | string | null | undefined, decimals: number = 3): string {
    let num: number;
    if (typeof value === 'string') {
      num = parseFloat(value) || 0;
    } else {
      num = Number(value) || 0;
    }
    return num.toFixed(decimals);
  }

  getSupplierName(doc: StockDocument | null): string | null {
    if (!doc) return null;
    
    // First try to get supplier name from the supplier object
    if (doc.supplier?.name) {
      return doc.supplier.name;
    }
    
    // Fallback to parsing from notes
    if (doc.notes && doc.notes.includes('Supplier:')) {
      const supplierMatch = doc.notes.match(/Supplier:(\d+)/);
      if (supplierMatch) {
        return `Fournisseur #${supplierMatch[1]}`;
      }
    }
    
    return null;
  }

  ngOnInit(): void {
    this.loadDocuments();
    this.loadCompanySettings();
    
    // Check for highlight parameter
    this.route.queryParams.subscribe(params => {
      if (params['highlight']) {
        // Scroll to the highlighted document after loading
        setTimeout(() => {
          this.scrollToDocument(params['highlight']);
        }, 1000);
      }
    });
  }

  scrollToDocument(documentId: string): void {
    const element = document.getElementById(`document-${documentId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a temporary highlight effect
      element.classList.add('bg-yellow-100', 'border-yellow-300');
      setTimeout(() => {
        element.classList.remove('bg-yellow-100', 'border-yellow-300');
      }, 3000);
    }
  }

  loadCompanySettings(): void {
    this.http.get(`${environment.apiUrl}/settings`).subscribe({
      next: (settings) => {
        this.companySettings = settings;
      },
      error: (err) => {
        console.error('Error loading company settings:', err);
      }
    });
  }

  loadDocuments(): void {
    this.loading = true;
    this.error = '';
    
    this.stockDocsService.getDocuments(
      this.currentPage(),
      this.pageSize,
      this.selectedType || undefined,
      this.selectedStatus || undefined,
      undefined, // depotId
      this.dateFrom || undefined,
      this.dateTo || undefined
    ).subscribe({
      next: (response) => {
        this.loading = false;
        this.documents.set(response.data || []);
        this.totalDocuments.set(response.total || 0);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Erreur lors du chargement des documents';
      }
    });
  }

  getTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'BON_ENTREE_DEPOT': 'Bon d\'entrée',
      'BON_EXPEDITION': 'Bon d\'expédition',
      'BON_TRANSFERT': 'Bon de transfert',
      'BON_ENTREE_MAGASIN': 'Bon d\'entrée magasin'
    };
    return labels[type] || type;
  }

  getTypeBadgeClass(type: string): string {
    const classes: { [key: string]: string } = {
      'BON_ENTREE_DEPOT': 'bg-emerald-100 text-emerald-800',
      'BON_EXPEDITION': 'bg-blue-100 text-blue-800',
      'BON_TRANSFERT': 'bg-purple-100 text-purple-800',
      'BON_ENTREE_MAGASIN': 'bg-orange-100 text-orange-800'
    };
    return classes[type] || 'bg-gray-100 text-gray-800';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'PREPARED': 'Préparé',
      'SENT': 'Envoyé',
      'RECEIVED': 'Reçu',
      'CANCELLED': 'Annulé'
    };
    return labels[status] || status;
  }

  getStatusBadgeClass(status: string): string {
    const classes: { [key: string]: string } = {
      'PREPARED': 'bg-yellow-100 text-yellow-800',
      'SENT': 'bg-blue-100 text-blue-800',
      'RECEIVED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-red-100 text-red-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  canValidate(doc: StockDocument): boolean {
    return doc.status === 'PREPARED' || doc.status === 'SENT';
  }

  viewDocument(doc: StockDocument): void {
    this.loading = true;
    this.error = '';
    
    this.stockDocsService.getDocument(doc.id).subscribe({
      next: (fullDocument) => {
        this.loading = false;
        this.selectedDocument.set(fullDocument);
        this.showDocumentDetails = true;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Erreur lors du chargement des détails du document';
      }
    });
  }

  closeDocumentDetails(): void {
    this.showDocumentDetails = false;
    this.selectedDocument.set(null);
  }

  printDocument(): void {
    const doc = this.selectedDocument();
    if (!doc) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const documentContent = this.generateDocumentHTML(doc);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bon d'entrée ${doc.numero}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .company-info { margin-bottom: 20px; }
            .document-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th, .items-table td { border: 1px solid #000; padding: 8px; text-align: left; }
            .items-table th { background-color: #f0f0f0; }
            .totals { text-align: right; margin-top: 20px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
            .signature-box { width: 200px; text-align: center; }
            .signature-line { border-bottom: 1px solid #000; height: 40px; margin-bottom: 5px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          ${documentContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
  }

  generateDocumentHTML(doc: StockDocument | null): string {
    if (!doc) return '';
    
    const totalAmount = doc.items?.reduce((sum, item) => {
      const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) || 0 : Number(item.quantity) || 0;
      const purchasePrice = item.purchasePrice || item.product?.prix_achat || 0;
      const price = typeof purchasePrice === 'string' ? parseFloat(purchasePrice) || 0 : Number(purchasePrice) || 0;
      return sum + (quantity * price);
    }, 0) || 0;

    // Get company settings
    const companyName = this.companySettings?.companyName || 'PATISSERIE TUNISIENNE';
    const address = this.companySettings?.companyAddress || '[Adresse de l\'entreprise]';
    const phone = this.companySettings?.companyPhone || '[Téléphone]';
    const email = this.companySettings?.companyEmail || '[Email]';
    const rc = this.companySettings?.companyRC || '[Registre de commerce]';
    const mf = this.companySettings?.companyMF || '[Matricule fiscal]';

    // Get supplier name and matricule fiscal from supplier object, notes, or emetteur
    let supplierName = 'N/A';
    let supplierMatricule = '';
    if (doc.supplier?.name) {
      supplierName = doc.supplier.name;
      supplierMatricule = doc.supplier.taxNumber || '';
    } else if (doc.notes && doc.notes.includes('Supplier:')) {
      const supplierMatch = doc.notes.match(/Supplier:(\d+)/);
      if (supplierMatch) {
        supplierName = `Fournisseur #${supplierMatch[1]}`;
      }
    } else if (doc.emetteur?.name) {
      supplierName = doc.emetteur.name;
    }

    return `
      <div class="header">
        <h1>BON D'ENTRÉE</h1>
        <h2>N° ${doc.numero}</h2>
      </div>

      <div class="company-info">
        <h3>${companyName}</h3>
        <p>Adresse: ${address}</p>
        <p>Tél: ${phone} | Email: ${email}</p>
        <p>R.C: ${rc} | M.F: ${mf}</p>
      </div>

      <div class="document-info">
        <div>
          <p><strong>Date:</strong> ${this.formatDate(doc.createdAt)}</p>
          <p><strong>Dépôt:</strong> ${doc.destinataire?.name || 'N/A'}</p>
        </div>
        <div>
          <p><strong>Fournisseur:</strong> ${supplierName}</p>
          ${supplierMatricule ? `<p><strong>M.F:</strong> ${supplierMatricule}</p>` : ''}
          <p><strong>Statut:</strong> ${this.getStatusLabel(doc.status)}</p>
        </div>
      </div>

      ${doc.notes ? `<p><strong>Notes:</strong> ${doc.notes}</p>` : ''}

      <table class="items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Produit</th>
            <th>Quantité</th>
            <th>Prix d'achat</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${doc.items?.map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.product?.designation_legale || item.product?.name || `Produit #${item.productId}`}</td>
              <td>${this.safeToFixed(item.quantity)}</td>
              <td>${this.safeToFixed(item.purchasePrice || item.product?.prix_achat || 0)} dt</td>
              <td>${this.safeToFixed(item.quantity * (item.purchasePrice || item.product?.prix_achat || 0))} dt</td>
            </tr>
          `).join('') || ''}
        </tbody>
      </table>

      <div class="totals">
        <p><strong>Montant total:</strong> ${this.safeToFixed(totalAmount)} dt</p>
      </div>

      <div class="signatures">
        <div class="signature-box">
          <p>Fournisseur</p>
          <div class="signature-line"></div>
          <p>Signature</p>
        </div>
        <div class="signature-box">
          <p>Réceptionnaire</p>
          <div class="signature-line"></div>
          <p>Signature</p>
        </div>
      </div>
    `;
  }

  validateDocument(doc: StockDocument): void {
    // TODO: Implement document validation
    console.log('Validate document:', doc);
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
      this.loadDocuments();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
      this.loadDocuments();
    }
  }
} 