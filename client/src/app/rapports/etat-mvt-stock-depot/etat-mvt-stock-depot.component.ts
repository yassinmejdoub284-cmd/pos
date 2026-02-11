import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PrintService } from '../../core/services/print.service';

interface DepotMovementRow {
  id: number;
  date: string;
  documentNumero: string;
  documentType: string;
  documentStatus: string;
  depotName: string;
  depotCode: string;
  depotType: string;
  destinataireName: string;
  parentProductId: number | null;
  parentProductName: string;
  childProductId: number;
  childProductName: string;
  quantity: number;
  prixUnitaire: number | null;
  purchasePrice: number | null;
  montantHT: number | null;
  montantTTC: number | null;
  montantTVA: number | null;
  tva: number | null;
  famille: string;
  colisCount: number;
}

interface ChildProductGroup {
  childProductName: string;
  childProductId: number;
  parentProductName: string;
  rows: DepotMovementRow[];
  totalQty: number;
  totalTTC: number;
  totalHT: number;
}

@Component({
  selector: 'app-etat-mvt-stock-depot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './etat-mvt-stock-depot.component.html',
  styleUrls: ['./etat-mvt-stock-depot.component.css']
})
export class EtatMvtStockDepotComponent implements OnInit {
  allRows = signal<DepotMovementRow[]>([]);
  isLoading = signal<boolean>(false);
  
  // Filters
  dateFrom = signal<string>('');
  dateTo = signal<string>('');
  articleFilter = signal<string>('');
  depotFilter = signal<string>('');
  
  // Pagination
  displayLimit = signal<number>(200);

  // Computed — filtered flat rows
  filteredRows = computed(() => {
    const rows = this.allRows();
    const articleSearch = this.articleFilter().toLowerCase();
    const depotSearch = this.depotFilter().toLowerCase();

    let filtered = rows;
    if (articleSearch) {
      filtered = filtered.filter(r =>
        r.childProductName.toLowerCase().includes(articleSearch) ||
        r.parentProductName.toLowerCase().includes(articleSearch) ||
        r.famille.toLowerCase().includes(articleSearch)
      );
    }
    if (depotSearch) {
      filtered = filtered.filter(r =>
        r.depotName.toLowerCase().includes(depotSearch) ||
        r.depotCode.toLowerCase().includes(depotSearch)
      );
    }

    return filtered;
  });

  // Grouped by child product
  groupedByChild = computed(() => {
    const rows = this.filteredRows();
    const map = new Map<string, ChildProductGroup>();

    for (const row of rows) {
      const key = row.childProductName || `child-${row.childProductId}`;
      if (!map.has(key)) {
        map.set(key, {
          childProductName: row.childProductName,
          childProductId: row.childProductId,
          parentProductName: row.parentProductName,
          rows: [],
          totalQty: 0,
          totalTTC: 0,
          totalHT: 0
        });
      }
      const group = map.get(key)!;
      group.rows.push(row);
      group.totalQty += row.quantity;
      group.totalTTC += row.montantTTC || 0;
      group.totalHT += row.montantHT || 0;
    }

    // Sort groups alphabetically by child product name
    return Array.from(map.values()).sort((a, b) =>
      a.childProductName.localeCompare(b.childProductName)
    );
  });

  hasMoreItems = computed(() => {
    return this.filteredRows().length > this.displayLimit();
  });

  // Summary totals
  summaryTotals = computed(() => {
    const groups = this.groupedByChild();
    const totalQty = groups.reduce((s, g) => s + g.totalQty, 0);
    const totalHT = groups.reduce((s, g) => s + g.totalHT, 0);
    const totalTTC = groups.reduce((s, g) => s + g.totalTTC, 0);
    const uniqueChildren = groups.length;
    const totalMovements = groups.reduce((s, g) => s + g.rows.length, 0);
    return { totalQty, totalHT, totalTTC, uniqueChildren, totalMovements };
  });

  private readonly printService = inject(PrintService);

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      const params: any = {};
      if (this.dateFrom()) params.startDate = this.dateFrom();
      if (this.dateTo()) params.endDate = this.dateTo();

      const rows = await this.http.get<DepotMovementRow[]>(
        `${environment.apiUrl}/reports/etat-mvt-stock-depot`,
        { params }
      ).toPromise();

      this.allRows.set(rows || []);
    } catch (error) {
      console.error('Error loading depot movements:', error);
      this.allRows.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  onDateChange() {
    this.loadData();
  }

  onArticleFilterChange(event: Event) {
    this.articleFilter.set((event.target as HTMLInputElement).value);
  }

  onDepotFilterChange(event: Event) {
    this.depotFilter.set((event.target as HTMLInputElement).value);
  }

  loadMore() {
    this.displayLimit.update(n => n + 300);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  }

  formatDocType(type: string): string {
    const map: Record<string, string> = {
      'BON_EXPEDITION': 'BE',
      'BON_ENTREE_DEPOT': 'BED',
      'BON_TRANSFERT': 'BT',
      'BON_ENTREE_MAGASIN': 'BEM'
    };
    return map[type] || type;
  }

  navigateToHome() {
    this.router.navigate(['/rapports']);
  }

  exportToExcel() {
    const rows = this.filteredRows();
    const headers = [
      'Date', 'Document', 'Type', 'Dépôt', 'Destination',
      'Produit Parent', 'Sous-Produit', 'Famille',
      'Qté', 'P.U', 'Total HT', 'Total TTC'
    ];

    const csvRows = [headers.join(',')];

    rows.forEach(r => {
      csvRows.push([
        `"${this.formatDate(r.date)}"`,
        `"${r.documentNumero}"`,
        `"${this.formatDocType(r.documentType)}"`,
        `"${r.depotName}"`,
        `"${r.destinataireName}"`,
        `"${r.parentProductName}"`,
        `"${r.childProductName}"`,
        `"${r.famille}"`,
        r.quantity.toFixed(3),
        r.prixUnitaire?.toFixed(3) || '',
        r.montantHT?.toFixed(3) || '',
        r.montantTTC?.toFixed(3) || ''
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'etat-mvt-stock-depot.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  printA4(): void {
    const groups = this.groupedByChild();
    const totals = this.summaryTotals();
    const title = 'État MVT Stock — Dépôt / Atelier';

    let tableRows = '';
    for (const group of groups) {
      // Group header row
      tableRows += `
        <tr style="background: #fef3c7; font-weight: bold;">
          <td colspan="5" style="padding: 8px; font-size: 13px;">${group.childProductName} <span style="font-weight:normal;color:#92400e;font-size:11px;">(Parent: ${group.parentProductName})</span></td>
          <td style="text-align:right;padding:8px;">${group.totalQty.toFixed(3)}</td>
          <td></td>
          <td style="text-align:right;padding:8px;">${group.totalTTC.toFixed(3)}</td>
        </tr>`;
      for (const r of group.rows) {
        tableRows += `
          <tr>
            <td>${this.formatDate(r.date)}</td>
            <td>${r.documentNumero}</td>
            <td>${r.depotName}</td>
            <td>${r.destinataireName}</td>
            <td></td>
            <td style="text-align: right;">${r.quantity.toFixed(3)}</td>
            <td style="text-align: right;">${r.prixUnitaire?.toFixed(3) || '—'}</td>
            <td style="text-align: right;">${r.montantTTC?.toFixed(3) || '—'}</td>
          </tr>`;
      }
    }

    let htmlContent = `
      <div class="header">
        <div class="title">${title}</div>
        <div class="subtitle">Date: ${new Date().toLocaleDateString('fr-FR')} · ${totals.uniqueChildren} sous-produits · ${totals.totalMovements} mouvements</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Document</th>
            <th>Dépôt</th>
            <th>Destination</th>
            <th>Sous-Produit</th>
            <th style="text-align: right;">Qté</th>
            <th style="text-align: right;">P.U</th>
            <th style="text-align: right;">Total TTC</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr style="font-weight: bold; border-top: 2px solid #333;">
            <td colspan="5">TOTAL GÉNÉRAL</td>
            <td style="text-align: right;">${totals.totalQty.toFixed(3)}</td>
            <td></td>
            <td style="text-align: right;">${totals.totalTTC.toFixed(3)}</td>
          </tr>
        </tbody>
      </table>
    `;

    this.printService.printA4Report(htmlContent, title);
  }
}

