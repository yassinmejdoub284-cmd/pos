import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface PDFParseResult {
  success: boolean;
  data?: PDFTableData;
  error?: string;
  pages?: number;
  filename: string;
}

export interface PDFTableData {
  headers: string[];
  rows: PDFTableRow[];
  extractedDate?: string;
  totalHT?: number;
  totalTVA?: number;
  totalTTC?: number;
}

export interface PDFTableRow {
  date?: string;
  famille?: string;
  article?: string;
  designationLegale?: string;
  quantite?: number;
  prixHTVA?: number;
  tvaPercent?: number;
  prixTTC?: number;
  rawData: { [key: string]: any };
}

export interface ColumnMapping {
  [key: string]: string; // PDF column name -> mapped field name
}

export interface TempInvoiceDraft {
  id: string;
  invoiceNumber: string;
  customerId?: number;
  customerName: string;
  customerAddress?: string;
  customerMatricule?: string;
  date: string;
  notes?: string;
  lines: TempInvoiceLine[];
  totals: {
    subtotalHTVA: number;
    totalTVA: number;
    totalTTC: number;
  };
  status: 'Draft' | 'Numbered' | 'Needs Number';
  sourceFilename: string;
  createdAt: string;
  isTemporary: boolean;
}

export interface TempInvoiceLine {
  productId?: number;
  productName: string;
  familleName?: string;
  legalDesignation: string;
  quantity: number;
  prixVenteHTVA: number;
  prixVenteTTC: number;
  tvaPercent: number;
  montantTVA: number;
  sousTotalTTC: number;
}

@Injectable({
  providedIn: 'root'
})
export class PDFParserService {
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Parse a PDF file and extract table data
   */
  parsePDF(file: File): Promise<PDFParseResult> {
    const formData = new FormData();
    formData.append('pdf', file);

    const token = this.authService.getToken();
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http.post<PDFParseResult>(`${this.apiUrl}/pdf/parse`, formData, { headers })
      .toPromise()
      .then(result => result || { success: false, error: 'No response from server', filename: file.name })
      .catch(error => {
        console.error('PDF parsing error:', error);
        return {
          success: false,
          error: error.error?.message || 'Erreur lors du parsing du PDF',
          filename: file.name
        };
      });
  }

  /**
   * Map PDF columns to standard fields
   */
  mapColumns(headers: string[], mapping: ColumnMapping): string[] {
    return headers.map(header => mapping[header] || header);
  }

  /**
   * Create a temporary invoice draft from parsed PDF data
   */
  createTempInvoiceDraft(
    pdfData: PDFTableData,
    customerInfo: {
      customerId?: number;
      customerName: string;
      customerAddress?: string;
      customerMatricule?: string;
    },
    invoiceDate: string,
    sourceFilename: string,
    notes?: string
  ): Promise<TempInvoiceDraft> {
    const payload = {
      pdfData,
      customerInfo,
      invoiceDate,
      notes,
      sourceFilename
    };

    const token = this.authService.getToken();
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http.post<TempInvoiceDraft>(`${this.apiUrl}/invoices/temp-draft`, payload, { headers })
      .toPromise()
      .then(result => {
        if (!result) {
          throw new Error('No response from server');
        }
        return result;
      })
      .catch(error => {
        console.error('Error creating temp invoice draft:', error);
        throw new Error(error.error?.message || 'Erreur lors de la création du brouillon');
      });
  }

  /**
   * Get all temporary invoice drafts
   */
  getTempInvoiceDrafts(): Promise<TempInvoiceDraft[]> {
    const token = this.authService.getToken();
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get<TempInvoiceDraft[]>(`${this.apiUrl}/invoices/temp-drafts`, { headers })
      .toPromise()
      .then(result => {
        if (Array.isArray(result)) {
          return result;
        }
        return [];
      })
      .catch(error => {
        console.error('Error fetching temp drafts:', error);
        return [];
      });
  }

  /**
   * Delete a temporary invoice draft
   */
  deleteTempInvoiceDraft(draftId: string): Promise<boolean> {
    const token = this.authService.getToken();
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http.delete(`${this.apiUrl}/invoices/temp-drafts/${draftId}`, { headers })
      .toPromise()
      .then(() => true)
      .catch(error => {
        console.error('Error deleting temp draft:', error);
        return false;
      });
  }

  /**
   * Get the next available invoice number
   */
  getNextInvoiceNumber(): Promise<string> {
    const token = this.authService.getToken();
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get<{ nextInvoiceNumber: string }>(`${this.apiUrl}/invoices/next-number`, { headers })
      .toPromise()
      .then((result: any) => {
        if (result && typeof result === 'object' && 'nextInvoiceNumber' in result) {
          return result.nextInvoiceNumber;
        }
        return 'DRAFT-001';
      })
      .catch(error => {
        console.error('Error getting next invoice number:', error);
        return 'DRAFT-001';
      }) as Promise<string>;
  }

  /**
   * Get customers for dropdown
   */
  getCustomers(): Promise<any[]> {
    const token = this.authService.getToken();
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http.get<any[]>(`${this.apiUrl}/clients`, { headers })
      .toPromise()
      .then(result => {
        if (Array.isArray(result)) {
          return result;
        }
        return [];
      })
      .catch(error => {
        console.error('Error fetching customers:', error);
        return [];
      });
  }

  /**
   * Validate PDF file
   */
  validatePDFFile(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'Aucun fichier sélectionné' };
    }

    if (file.type !== 'application/pdf') {
      return { valid: false, error: 'Seuls les fichiers PDF sont acceptés' };
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return { valid: false, error: 'Le fichier est trop volumineux (max 10MB)' };
    }

    return { valid: true };
  }

  /**
   * Generate a temporary invoice number
   */
  generateTempInvoiceNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.getTime().toString().slice(-4);
    return `DRAFT-${dateStr}-${timeStr}`;
  }

  /**
   * Process PDF table data into invoice lines
   */
  processTableDataToInvoiceLines(
    pdfData: PDFTableData,
    columnMapping: ColumnMapping
  ): TempInvoiceLine[] {
    const lines: TempInvoiceLine[] = [];

    pdfData.rows.forEach((row, index) => {
      // Skip rows with zero or missing quantity
      const quantity = this.extractNumber(row.rawData[columnMapping['Quantité']] || row.rawData['quantite'] || row.rawData['qty']);
      if (quantity <= 0) return;

      const article = row.rawData[columnMapping['Article']] || row.rawData['article'] || row.rawData['designation'] || `Article ${index + 1}`;
      const designationLegale = row.rawData[columnMapping['Désignation légale']] || row.rawData['designation_legale'] || article;
      const famille = row.rawData[columnMapping['Famille']] || row.rawData['famille'] || 'Général';
      
      // Extract prices
      const prixTTC = this.extractNumber(row.rawData[columnMapping['PV TTC']] || row.rawData['prix_ttc'] || row.rawData['ttc']);
      const prixHTVA = this.extractNumber(row.rawData[columnMapping['PV HTVA']] || row.rawData['prix_htva'] || row.rawData['htva']);
      const tvaPercent = this.extractNumber(row.rawData[columnMapping['TVA %']] || row.rawData['tva_percent'] || row.rawData['tva']) || 19;

      // Calculate missing values
      let finalPrixTTC = prixTTC;
      let finalPrixHTVA = prixHTVA;
      let finalTvaPercent = tvaPercent;

      if (prixTTC && !prixHTVA) {
        finalPrixHTVA = prixTTC / (1 + tvaPercent / 100);
      } else if (prixHTVA && !prixTTC) {
        finalPrixTTC = prixHTVA * (1 + tvaPercent / 100);
      } else if (!prixTTC && !prixHTVA) {
        // Skip this line if no price information
        return;
      }

      const montantTVA = finalPrixTTC - finalPrixHTVA;
      const sousTotalTTC = finalPrixTTC * quantity;

      lines.push({
        productName: article,
        familleName: famille,
        legalDesignation: designationLegale,
        quantity,
        prixVenteHTVA: Math.round(finalPrixHTVA * 100) / 100,
        prixVenteTTC: Math.round(finalPrixTTC * 100) / 100,
        tvaPercent: finalTvaPercent,
        montantTVA: Math.round(montantTVA * 100) / 100,
        sousTotalTTC: Math.round(sousTotalTTC * 100) / 100
      });
    });

    return lines;
  }

  /**
   * Calculate totals from invoice lines
   */
  calculateTotals(lines: TempInvoiceLine[]): { subtotalHTVA: number; totalTVA: number; totalTTC: number } {
    const totals = lines.reduce(
      (acc, line) => ({
        subtotalHTVA: acc.subtotalHTVA + (line.prixVenteHTVA * line.quantity),
        totalTVA: acc.totalTVA + (line.montantTVA * line.quantity),
        totalTTC: acc.totalTTC + line.sousTotalTTC
      }),
      { subtotalHTVA: 0, totalTVA: 0, totalTTC: 0 }
    );

    return {
      subtotalHTVA: Math.round(totals.subtotalHTVA * 100) / 100,
      totalTVA: Math.round(totals.totalTVA * 100) / 100,
      totalTTC: Math.round(totals.totalTTC * 100) / 100
    };
  }

  /**
   * Extract number from various formats
   */
  private extractNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remove common currency symbols and spaces
      const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }
}
