import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { DepotsService } from '../../core/services/depots.service';
import { ProductsService } from '../../core/services/products.service';
import { Depot } from '../../core/models/depot.model';
import { Product, ProductFamily } from '../../core/models/product.model';
import { StockDocument } from '../../core/models/stock-document.model';

@Component({
  selector: 'app-branch-inventory',
  templateUrl: './branch-inventory.component.html',
  styleUrls: ['./branch-inventory.component.css'],
  standalone: false
})
export class BranchInventoryComponent implements OnInit {
  depotType: string = '';
  currentDepot: Depot | null = null;
  availableDepots: Depot[] = [];
  families: ProductFamily[] = [];
  products: Product[] = [];
  inventory: any[] = [];
  form: FormGroup;
  loading = false;
  error = '';
  success = '';

  // Interactive product search
  showProductSearch = false;
  searchStep = 1;
  selectedFamily: ProductFamily | null = null;
  selectedProduct: Product | null = null;
  productQuantity = 1;

  // Pending transfers from MAIN
  pendingTransfers: StockDocument[] = [];
  selectedTransfer: StockDocument | null = null;
  showTransferDetails = false;
  approvingTransfer = false;

  // UI state
  showCurrentInventory = false;
  showNotification = false;
  notificationMessage = '';
  notificationType: 'success' | 'error' | 'info' = 'info';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private stockDocumentsService: StockDocumentsService,
    private depotsService: DepotsService,
    private productsService: ProductsService
  ) {
    this.form = this.fb.group({
      emetteurId: [{value: '', disabled: true}, Validators.required],
      destinataireId: ['', Validators.required],
      notes: [''],
      items: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const depotId = params.get('depotId');
      if (depotId) {
        this.loadData(parseInt(depotId, 10));
      }
    });
  }

  loadData(depotId: number): void {
    this.loading = true;
    
    Promise.all([
      this.depotsService.get(depotId).toPromise(),
      this.depotsService.list().toPromise(),
      this.productsService.getFamilles().toPromise(),
      this.productsService.getProducts().toPromise(),
      this.stockDocumentsService.getInventory(depotId).toPromise(),
      this.loadPendingTransfers(depotId)
    ]).then(([currentDepot, depots, families, products, inventory]) => {
      if (currentDepot) {
        this.currentDepot = currentDepot;
        this.depotType = currentDepot.type;
        this.form.get('emetteurId')?.setValue(currentDepot.id);
      }
      if (depots) {
        this.availableDepots = depots.filter(d => d.isActive);
        // Auto-select first SHOP depot as destination
        const firstShop = this.getDestinations()[0];
        if (firstShop) {
          this.form.get('destinataireId')?.setValue(firstShop.id);
        }
      }
      if (families) this.families = families;
      if (products) this.products = products;
      if (inventory) this.inventory = inventory;
      this.loading = false;
    }).catch(() => {
      this.error = 'Erreur lors du chargement des données';
      this.loading = false;
    });
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  getDestinations(): Depot[] {
    return this.availableDepots.filter(d => d.type === 'SHOP');
  }

  getInventoryForProduct(productId: number): number {
    const item = this.inventory.find(i => i.productId === productId);
    return item ? item.quantity : 0;
  }

  onSubmit(): void {
    if (this.form.valid && this.items.length > 0) {
      this.loading = true;
      this.error = '';
      this.success = '';

      const formData = this.form.getRawValue();
      
      console.log('Sending transfer data:', formData);
      
      this.stockDocumentsService.createTransfer(
        formData.emetteurId,
        formData.destinataireId,
        formData.items,
        formData.notes
      ).subscribe({
        next: (document: any) => {
          this.loading = false;
          this.showNotificationMessage('✅ Transfert envoyé avec succès ! En attente de confirmation par le magasin.', 'success');
          this.form.reset();
          this.items.clear();
          this.form.get('emetteurId')?.setValue(this.currentDepot?.id);
          // Auto-select first SHOP depot again
          const firstShop = this.getDestinations()[0];
          if (firstShop) {
            this.form.get('destinataireId')?.setValue(firstShop.id);
          }
          // Reload inventory
          this.loadData(this.currentDepot!.id);
        },
        error: (err: any) => {
          this.loading = false;
          this.showNotificationMessage(err.error?.error || 'Erreur lors de l\'envoi du transfert', 'error');
        }
      });
    } else if (this.items.length === 0) {
      this.showNotificationMessage('Veuillez ajouter au moins un produit au transfert', 'error');
    }
  }

  goBack(): void {
    this.router.navigate(['/stock']);
  }

  // Interactive product search methods
  startProductSearch(): void {
    this.showProductSearch = true;
    this.searchStep = 1;
    this.resetProductSearch();
  }

  selectFamily(family: ProductFamily): void {
    this.selectedFamily = family;
    this.searchStep = 2;
  }

  selectProduct(product: Product): void {
    this.selectedProduct = product;
    this.searchStep = 3;
  }

  adjustQuantity(change: number): void {
    this.productQuantity = Math.max(1, this.productQuantity + change);
  }

  updateQuantityManually(quantity: number): void {
    this.productQuantity = Math.max(1, quantity);
  }

  addProductToTransfer(): void {
    if (this.selectedFamily && this.selectedProduct) {
      const availableQuantity = this.getInventoryForProduct(this.selectedProduct.id);
      
      if (this.productQuantity > availableQuantity) {
        this.error = `Quantité insuffisante. Disponible: ${availableQuantity}`;
        return;
      }

      const item = this.fb.group({
        famille: [this.selectedFamily.name, Validators.required],
        productId: [this.selectedProduct.id, Validators.required],
        quantity: [this.productQuantity, [Validators.required, Validators.min(1)]]
      });

      this.items.push(item);
      this.cancelProductSearch();
    }
  }

  cancelProductSearch(): void {
    this.showProductSearch = false;
    this.resetProductSearch();
  }

  resetProductSearch(): void {
    this.searchStep = 1;
    this.selectedFamily = null;
    this.selectedProduct = null;
    this.productQuantity = 1;
  }

  getProductName(productId: number): string {
    if (!productId || !this.products.length) return 'Chargement...';
    const product = this.products.find(p => p.id === productId);
    return product ? product.name : `Produit ID: ${productId}`;
  }

  getProductsByFamille(famille: string): Product[] {
    return this.products.filter(p => p.famille?.name === famille);
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  // Pending transfers methods
  loadPendingTransfers(depotId: number): Promise<void> {
    return this.stockDocumentsService.getDocuments(1, 50, 'BON_EXPEDITION', undefined, depotId).toPromise()
      .then((response: any) => {
        if (response && response.data) {
          this.pendingTransfers = response.data.filter((doc: StockDocument) => 
            doc.emetteur?.type === 'MAIN' && 
            doc.destinataireId === depotId &&
            (doc.status === 'PREPARED' || doc.status === 'SENT')
          );
          console.log('Loaded pending transfers:', this.pendingTransfers);
        }
      })
      .catch((error) => {
        console.error('Error loading pending transfers:', error);
      });
  }

  viewTransferDetails(transfer: StockDocument): void {
    this.selectedTransfer = transfer;
    this.showTransferDetails = true;
  }

  closeTransferDetails(): void {
    this.showTransferDetails = false;
    this.selectedTransfer = null;
  }

  approveTransfer(transfer: StockDocument): void {
    this.approvingTransfer = true;
    this.error = '';
    this.success = '';

    console.log('Approving transfer:', transfer.id, 'for depot:', this.currentDepot!.id);
    console.log('Transfer status:', transfer.status);

    this.stockDocumentsService.receiveDocument(transfer.id, this.currentDepot!.id).subscribe({
      next: (updatedDocument) => {
        console.log('Transfer approved successfully:', updatedDocument);
        this.approvingTransfer = false;
        this.showNotificationMessage('✅ Transfert approuvé et stock ajouté avec succès !', 'success');
        this.closeTransferDetails();
        this.loadPendingTransfers(this.currentDepot!.id);
        this.loadData(this.currentDepot!.id);
      },
      error: (err) => {
        console.error('Error approving transfer:', err);
        this.approvingTransfer = false;
        this.showNotificationMessage(err.error?.error || 'Erreur lors de l\'approbation du transfert', 'error');
      }
    });
  }

  rejectTransfer(transfer: StockDocument): void {
    this.approvingTransfer = true;
    this.error = '';
    this.success = '';

    this.stockDocumentsService.validateDocument(transfer.id, 'CANCELLED', 'Rejeté par le dépôt de destination').subscribe({
      next: (updatedDocument) => {
        this.approvingTransfer = false;
        this.showNotificationMessage('❌ Transfert rejeté avec succès', 'success');
        this.closeTransferDetails();
        this.loadPendingTransfers(this.currentDepot!.id);
      },
      error: (err) => {
        this.approvingTransfer = false;
        this.showNotificationMessage(err.error?.error || 'Erreur lors du rejet du transfert', 'error');
      }
    });
  }

  getProductNameById(productId: number): string {
    if (!productId || !this.products.length) return 'Chargement...';
    const product = this.products.find(p => p.id === productId);
    return product ? product.name : `Produit ID: ${productId}`;
  }

  toggleCurrentInventory(): void {
    this.showCurrentInventory = !this.showCurrentInventory;
  }

  showNotificationMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.notificationMessage = message;
    this.notificationType = type;
    this.showNotification = true;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideNotification();
    }, 5000);
  }

  hideNotification(): void {
    this.showNotification = false;
    this.notificationMessage = '';
  }
}
