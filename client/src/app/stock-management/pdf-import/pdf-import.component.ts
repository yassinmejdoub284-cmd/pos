import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';

interface ParsedInvoiceData {
  filename: string;
  extractedDate: string;
  items: ParsedItem[];
  totals: {
    totalTTC?: number;
  };
  isExtraitJournaliere: boolean;
}

interface ParsedItem {
  famille: string;
  article: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
}

interface EditableItem extends ParsedItem {
  productId?: number;
}

@Component({
  selector: 'app-pdf-import',
  templateUrl: './pdf-import.component.html',
  standalone: false
})
export class PdfImportComponent implements OnInit {
  depotId = -1;
  loading = false;
  error = '';
  success = '';

  // File upload
  selectedFile: File | null = null;
  isDragging = false;

  // Parsed data
  parsedData = signal<ParsedInvoiceData | null>(null);
  editableItems = signal<EditableItem[]>([]);

  // UI state
  showResults = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.depotId = +this.route.snapshot.paramMap.get('depotId')!;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFileSelection(input.files[0]);
    }
  }

  handleFileSelection(file: File): void {
    if (file.type !== 'application/pdf') {
      this.error = 'Seuls les fichiers PDF sont acceptés';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.error = 'Le fichier est trop volumineux (max 10MB)';
      return;
    }

    this.selectedFile = file;
    this.error = '';
  }

  uploadPDF(): void {
    if (!this.selectedFile) {
      this.error = 'Veuillez sélectionner un fichier PDF';
      return;
    }

    this.loading = true;
    this.error = '';
    this.showResults = false;

    const formData = new FormData();
    formData.append('pdf', this.selectedFile);

    const token = this.authService.getToken();
    const headers: any = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.http.post<any>(`${environment.apiUrl}/invoices/import-pdf`, formData, { headers })
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success && response.data) {
            this.parsedData.set(response.data);
            this.editableItems.set(response.data.items.map((item: ParsedItem) => ({ ...item })));
            this.showResults = true;
          } else {
            this.error = response.error || 'Erreur lors de l\'analyse du PDF';
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = error.error?.message || 'Erreur lors de l\'importation du PDF';
          console.error('PDF import error:', error);
        }
      });
  }

  updateItem(index: number, field: keyof EditableItem, value: any): void {
    const items = this.editableItems();
    items[index] = { ...items[index], [field]: value };
    
    // Recalculate total if quantity or price changed
    if (field === 'quantite' || field === 'prixUnitaire') {
      items[index].total = items[index].quantite * items[index].prixUnitaire;
    }
    
    this.editableItems.set([...items]);
  }

  removeItem(index: number): void {
    const items = this.editableItems().filter((_, i) => i !== index);
    this.editableItems.set(items);
  }

  getTotalTTC(): number {
    return this.editableItems().reduce((sum, item) => sum + item.total, 0);
  }

  importInvoice(): void {
    if (this.editableItems().length === 0) {
      this.error = 'Veuillez conserver au moins un article';
      return;
    }

    this.loading = true;
    this.error = '';

    const payload = {
      depotId: this.depotId,
      filename: this.parsedData()?.filename,
      extractedDate: this.parsedData()?.extractedDate,
      items: this.editableItems(),
      isExtraitJournaliere: this.parsedData()?.isExtraitJournaliere
    };

    const token = this.authService.getToken();
    const headers: any = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.http.post<any>(`${environment.apiUrl}/invoices/create-from-import`, payload, { headers })
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.success = 'Facture importée avec succès';
            setTimeout(() => {
              this.router.navigate(['/stock-management']);
            }, 2000);
          } else {
            this.error = response.error || 'Erreur lors de la création de la facture';
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = error.error?.message || 'Erreur lors de la création de la facture';
          console.error('Invoice creation error:', error);
        }
      });
  }

  reset(): void {
    this.selectedFile = null;
    this.parsedData.set(null);
    this.editableItems.set([]);
    this.showResults = false;
    this.error = '';
    this.success = '';
  }

  goBack(): void {
    this.router.navigate(['/stock-management/entry-options', this.depotId]);
  }
}
