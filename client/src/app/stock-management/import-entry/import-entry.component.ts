import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { StockDocumentsService } from '../../core/services/stock-documents.service';
import { DepotsService } from '../../core/services/depots.service';
import { Depot } from '../../core/models/depot.model';

interface ImportableEntry {
  id: number;
  numero: string;
  supplier?: { 
    id: number;
    name: string; 
  };
  createdAt: string;
  items: any[];
  imported: boolean;
  notes?: string;
}

interface EditableItem {
  productId: number;
  productName: string;
  famille: string;
  originalQuantity: number;
  originalPrice: number;
  quantity: number;
  purchasePrice: number;
  batch?: string;
  notes?: string;
}

@Component({
  selector: 'app-import-entry',
  templateUrl: './import-entry.component.html',
  standalone: false
})
export class ImportEntryComponent implements OnInit {
  depotId = -1;
  depot: Depot | null = null;
  loading = false;
  error = '';
  success = '';

  // Available entries to import
  availableEntries = signal<ImportableEntry[]>([]);
  selectedEntry: ImportableEntry | null = null;
  
  // Editable items from selected entry
  editableItems = signal<EditableItem[]>([]);
  
  // Form for the new entry
  form!: FormGroup;

  // UI state
  currentInput: string = '';
  selectedIndex: number = -1;
  selectedField: 'quantity' | 'price' | null = null;
  lastEnteredValue: string = '';
  Math = Math;

  // Notes
  notes: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private stockDocs: StockDocumentsService,
    private depotsService: DepotsService
  ) {}

  ngOnInit(): void {
    this.depotId = +this.route.snapshot.paramMap.get('depotId')!;
    this.loadDepot();
    this.initializeForm();
    this.loadAvailableEntries();
  }

  loadDepot(): void {
    this.depotsService.get(this.depotId).subscribe({
      next: (depot) => {
        this.depot = depot;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement du dépôt';
        console.error('Error loading depot:', error);
      }
    });
  }

  initializeForm(): void {
    this.form = this.fb.group({
      notes: [''],
      items: this.fb.array([])
    });
  }

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  loadAvailableEntries(): void {
    this.loading = true;
    this.error = '';
    
    // Load entries that are not yet imported
    this.stockDocs.getDocuments(1, 100, 'BON_ENTREE_DEPOT').subscribe({
      next: (response) => {
        const entries = Array.isArray(response) ? response : (response.data || []);
        
        // Filter out entries that were created through stock-management system
        const nonStockManagementEntries = entries.filter((entry: any) => {
          // Skip entries that are already marked as imported (status = RECEIVED with import notes)
          if (entry.status === 'RECEIVED' && entry.notes && entry.notes.includes('Importé via stock-management')) {
            return false;
          }
          
          const notes = entry.notes || '';
          
          // Skip if it was imported from another entry (has "Importé depuis:")
          if (notes.includes('Importé depuis:')) {
            return false;
          }
          
          // Skip if it's a stock-management created entry
          // These entries have "Fournisseur:" in notes but no "Supplier:" (which indicates real supplier linking)
          if (notes.includes('Fournisseur:') && !notes.includes('Supplier:')) {
            return false;
          }
          
          // Skip entries that have both emetteurId and destinataireId as the same depot
          // This indicates it was created through stock-management (standalone entries)
          if (entry.emetteurId === entry.destinataireId && notes.includes('Fournisseur:')) {
            return false;
          }
          
          return true;
        });
        
        this.availableEntries.set(nonStockManagementEntries);
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Erreur lors du chargement des bons d\'entrée';
        this.loading = false;
        console.error('Error loading entries:', error);
      }
    });
  }

  selectEntry(entry: ImportableEntry): void {
    this.selectedEntry = entry;
    this.prepareEditableItems(entry);
    this.populateForm();
  }

  prepareEditableItems(entry: ImportableEntry): void {
    const items: EditableItem[] = entry.items.map((item: any) => ({
      productId: item.productId,
      productName: item.product?.name || 'Produit inconnu',
      famille: item.product?.famille?.name || '',
      originalQuantity: item.quantity,
      originalPrice: item.purchasePrice,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      batch: item.batch || '',
      notes: item.notes || ''
    }));
    
    this.editableItems.set(items);
  }

  populateForm(): void {
    // Clear existing form array
    while (this.itemsArray.length !== 0) {
      this.itemsArray.removeAt(0);
    }

    // Add form controls for each editable item
    this.editableItems().forEach(item => {
      const itemForm = this.fb.group({
        productId: [item.productId, Validators.required],
        famille: [item.famille],
        quantity: [item.quantity, [Validators.required, Validators.min(0.01)]],
        purchasePrice: [item.purchasePrice, [Validators.required, Validators.min(0)]],
        batch: [item.batch],
        notes: [item.notes]
      });

      this.itemsArray.push(itemForm);
    });

    // Set notes from original entry
    this.notes = this.selectedEntry?.notes || '';
  }

  selectField(index: number, field: 'quantity' | 'price'): void {
    this.selectedIndex = index;
    this.selectedField = field;
    this.currentInput = '';
  }

  addDigit(digit: string): void {
    // Prevent multiple leading zeros
    if (digit === '0' && this.currentInput === '0') {
      return;
    }
    
    // Handle decimal point
    if (digit === '.' && this.currentInput.includes('.')) {
      return;
    }
    
    this.currentInput += digit;
  }

  clearDisplay(): void {
    this.currentInput = '';
  }

  enterValue(): void {
    if (!this.currentInput || this.currentInput === '') {
      return;
    }
    
    const value = parseFloat(this.currentInput);
    if (isNaN(value) || value <= 0) {
      this.error = 'Valeur invalide (> 0)';
      this.currentInput = '';
      return;
    }
    
    if (this.selectedIndex >= 0 && this.selectedField) {
      // Update the form control
      const formControl = this.itemsArray.at(this.selectedIndex).get(this.selectedField);
      if (formControl) {
        formControl.setValue(value);
      }
      
      // Update the editable items array
      const updatedItems = this.editableItems().map((item, index) => {
        if (index === this.selectedIndex) {
          return {
            ...item,
            [this.selectedField === 'quantity' ? 'quantity' : 'purchasePrice']: value
          };
        }
        return item;
      });
      this.editableItems.set(updatedItems);
    }
    
    this.lastEnteredValue = this.currentInput;
    this.currentInput = '';
    this.selectedField = null;
    this.error = '';
  }

  onDirectInputChange(index: number, field: 'quantity' | 'purchasePrice', value: string): void {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue >= 0) {
      const formControl = this.itemsArray.at(index).get(field);
      if (formControl) {
        formControl.setValue(numericValue);
      }
      
      // Update the editable items array
      const updatedItems = this.editableItems().map((item, i) => {
        if (i === index) {
          return {
            ...item,
            [field === 'quantity' ? 'quantity' : 'purchasePrice']: numericValue
          };
        }
        return item;
      });
      this.editableItems.set(updatedItems);
    }
  }

  getFieldClass(index: number, field: 'quantity' | 'price'): string {
    const isSelected = this.selectedIndex === index && this.selectedField === field;
    return isSelected ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-300';
  }

  removeItem(index: number): void {
    this.itemsArray.removeAt(index);
    const updatedItems = this.editableItems().filter((_, i) => i !== index);
    this.editableItems.set(updatedItems);
    
    if (this.selectedIndex === index) {
      this.selectedIndex = -1;
      this.selectedField = null;
    } else if (this.selectedIndex > index) {
      this.selectedIndex--;
    }
  }

  submitImport(): void {
    if (this.form.invalid) {
      this.error = 'Veuillez vérifier les données saisies';
      return;
    }

    if (this.itemsArray.length === 0) {
      this.error = 'Veuillez conserver au moins un produit';
      return;
    }

    this.loading = true;
    this.error = '';

    // Create standalone entry data (no supplier linking, no payment processing)
    const supplierInfo = this.selectedEntry?.supplier 
      ? `${this.selectedEntry.supplier.name}`
      : 'Fournisseur non spécifié';
    
    const notes = `${this.notes || ''}\nImporté depuis: ${this.selectedEntry?.numero}\nFournisseur: ${supplierInfo}`.trim();

    const items = this.itemsArray.value.map((item: any) => ({
      productId: item.productId,
      famille: item.famille || 'Divers',
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      batch: item.batch || null,
      notes: item.notes || null
    }));

    this.stockDocs.createEntry(this.depotId, null, items, notes).subscribe({
      next: (response) => {
        this.success = 'Bon d\'entrée importé avec succès';
        this.loading = false;
        
        // Mark the original entry as imported (like invoice import)
        if (this.selectedEntry) {
          this.markEntryAsImported(this.selectedEntry.id);
        }
        
        // Show success message and redirect
        setTimeout(() => {
          this.router.navigate(['/stock-management']);
        }, 2000);
      },
      error: (error) => {
        this.error = 'Erreur lors de l\'importation du bon d\'entrée';
        this.loading = false;
        console.error('Error importing entry:', error);
      }
    });
  }

  markEntryAsImported(entryId: number): void {
    // Mark the entry as imported in the backend
    this.stockDocs.validateDocument(entryId, 'RECEIVED', 'Importé via stock-management').subscribe({
      next: () => {
        // Update local state
        const updatedEntries = this.availableEntries().map(entry => 
          entry.id === entryId ? { ...entry, status: 'RECEIVED' } : entry
        );
        this.availableEntries.set(updatedEntries);
      },
      error: (error) => {
        console.error('Error marking entry as imported:', error);
        // Still update local state even if backend call fails
        const updatedEntries = this.availableEntries().map(entry => 
          entry.id === entryId ? { ...entry, status: 'RECEIVED' } : entry
        );
        this.availableEntries.set(updatedEntries);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/stock-management/entry-options', this.depotId]);
  }

  getTotalQuantity(): number {
    return this.editableItems().reduce((total, item) => total + item.quantity, 0);
  }

  getTotalValue(): number {
    return this.editableItems().reduce((total, item) => total + (item.quantity * item.purchasePrice), 0);
  }

  getEntryTotalQuantity(entry: ImportableEntry): number {
    return entry.items.reduce((total, item) => total + (item.quantity || 0), 0);
  }

  getEntryTotalValue(entry: ImportableEntry): number {
    return entry.items.reduce((total, item) => total + ((item.quantity || 0) * (item.purchasePrice || 0)), 0);
  }

  resetSelection(): void {
    this.selectedEntry = null;
    this.editableItems.set([]);
    this.notes = '';
    while (this.itemsArray.length !== 0) {
      this.itemsArray.removeAt(0);
    }
  }

  importFromFile(): void {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.xlsx,.xls,.pdf';
    fileInput.style.display = 'none';
    
    fileInput.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.handleFileImport(file);
      }
    };
    
    // Trigger file selection
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  }

  private handleFileImport(file: File): void {
    this.loading = true;
    this.error = '';
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('depotId', this.depotId.toString());
    
    // Here you would typically call a service to process the file
    // For now, we'll simulate the import process
    console.log('Importing file:', file.name);
    
    // Simulate file processing
    setTimeout(() => {
      this.loading = false;
      this.success = `Fichier ${file.name} importé avec succès`;
      
      // You would typically process the file and update the editable items here
      // For demonstration, we'll just show a success message
      
      setTimeout(() => {
        this.success = '';
      }, 3000);
    }, 2000);
  }
}
