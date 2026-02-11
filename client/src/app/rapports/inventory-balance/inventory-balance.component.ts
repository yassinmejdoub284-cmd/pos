import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InventoryService } from '../../core/services/inventory.service';
import { SalesService } from '../../core/services/sales.service';
import { ProductsService } from '../../core/services/products.service';
import { Product } from '../../core/models/product.model';
import { PrintService } from '../../core/services/print.service';

export interface InventoryBalanceRow {
  productId: number;
  designation: string;
  debut: number; // qte * prix_vente for each entry
  credit: number; // sales amount + free items + exit vouchers + wholesale difference
  solde: number; // debut - credit
}



export interface InventoryBalanceSummary {
  totalProducts: number;
  totalDebut: number;
  totalCredit: number;
  totalSolde: number;
  products: InventoryBalanceRow[];
}

@Component({
  selector: 'app-inventory-balance-report',
  templateUrl: './inventory-balance.component.html',
  styleUrls: ['./inventory-balance.component.css'],
  standalone: false
})
export class InventoryBalanceReportComponent implements OnInit {
  products: Product[] = [];
  balanceData: InventoryBalanceRow[] = [];
  summary: InventoryBalanceSummary | null = null;

  
  // UI state
  loading = false;
  error = '';

  


  constructor(
    private http: HttpClient,
    private inventoryService: InventoryService,
    private salesService: SalesService,
    private productsService: ProductsService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.generateBalanceReport();
  }

  loadProducts(): void {
    this.loading = true;
    this.productsService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des produits';
        this.loading = false;
      }
    });
  }

  async generateBalanceReport(): Promise<void> {
    this.loading = true;
    this.error = '';
    
    try {
      const balanceRows: InventoryBalanceRow[] = [];
      
      for (const product of this.products) {
        const debut = await this.calculateDebut(product);
        const credit = await this.calculateCredit(product);
        const solde = debut - credit;
        
        balanceRows.push({
          productId: product.id,
          designation: product.name,
          debut,
          credit,
          solde
        });
      }
      
      this.balanceData = balanceRows;
      this.summary = this.calculateSummary(balanceRows);
      this.loading = false;
    } catch (err) {
      this.error = 'Erreur lors de la génération du rapport';
      this.loading = false;
    }
  }

  private async calculateDebut(product: Product): Promise<number> {
    try {
      // Get all stock entries for this product
      const stockEntries = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/stock-documents`, {
        params: {
          type: 'BON_ENTREE_DEPOT'
        }
      }));

      let totalDebut = 0;
      const entries = Array.isArray(stockEntries) ? stockEntries : ((stockEntries as any)?.data || []);
      
      for (const entry of entries) {
        const items = entry.items?.filter((item: any) => item.productId === product.id) || [];
        for (const item of items) {
          const qty = Number(item.quantity) || 0;
          const prixVente = Number(product.prix_vente_TTC) || 0;
          totalDebut += qty * prixVente;
        }
      }
      
      return totalDebut;
    } catch (err) {
      console.error('Error calculating debut for product:', product.id, err);
      return 0;
    }
  }

  private async calculateCredit(product: Product): Promise<number> {
    try {
      // Get sales data for this product
      const sales = await firstValueFrom(this.salesService.getSales());
      const salesArray = Array.isArray(sales) ? sales : [];
      
      let totalCredit = 0;
      
      for (const sale of salesArray) {
        const saleItems = sale.items?.filter((item: any) => item.productId === product.id) || [];
        
        for (const item of saleItems) {
          const itemQty = Number(item.quantity) || 0;
          const itemPrice = Number(item.unitPrice) || 0;
          const itemTotal = Number(item.total) || 0;
          const isWholesale = item.isWholesale || sale.isWholesale;
          const isGift = sale.status === 'CADEAU' || itemTotal === 0;
          const discount = Number(item.discount) || 0;
          
          if (isGift) {
            // Free items: count as credit at full price
            const fullPrice = itemQty * Number(product.prix_vente_TTC);
            totalCredit += fullPrice;
          } else {
            // Regular sales: count the actual amount
            totalCredit += itemTotal;
          }
          
          // Add discount as credit
          if (discount > 0) {
            totalCredit += discount;
          }
          
          // Wholesale difference: if wholesale price is different from retail
          if (isWholesale) {
            const retailPrice = itemQty * Number(product.prix_vente_TTC);
            const wholesalePrice = itemTotal;
            const difference = retailPrice - wholesalePrice;
            if (difference > 0) {
              totalCredit += difference;
            }
          }
        }
      }
      
      return totalCredit;
    } catch (err) {
      console.error('Error calculating credit for product:', product.id, err);
      return 0;
    }
  }

  private calculateSummary(balanceRows: InventoryBalanceRow[]): InventoryBalanceSummary {
    const totalDebut = balanceRows.reduce((sum, row) => sum + row.debut, 0);
    const totalCredit = balanceRows.reduce((sum, row) => sum + row.credit, 0);
    const totalSolde = balanceRows.reduce((sum, row) => sum + row.solde, 0);
    
    return {
      totalProducts: balanceRows.length,
      totalDebut,
      totalCredit,
      totalSolde,
      products: balanceRows
    };
  }







  formatNumber(value: number): string {
    return value.toLocaleString('fr-FR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('fr-FR');
  }

  getProductName(productId: number): string {
    const product = this.products.find(p => p.id === productId);
    return product?.name || 'Produit inconnu';
  }

  private readonly printService = inject(PrintService);

  printA4(): void {
    const title = 'Tableau de Balance Inventaire';
    
    let htmlContent = `
      <div class="header">
        <div class="title">${title}</div>
        <div class="subtitle">Date: ${new Date().toLocaleDateString('fr-FR')}</div>
      </div>
    `;

    if (this.summary) {
      htmlContent += `
        <div class="summary">
          <p><strong>Total Produits:</strong> ${this.summary.totalProducts}</p>
          <p><strong>Total Début:</strong> ${this.formatNumber(this.summary.totalDebut)} dt</p>
          <p><strong>Total Crédit:</strong> ${this.formatNumber(this.summary.totalCredit)} dt</p>
          <p><strong>Total Solde:</strong> ${this.formatNumber(this.summary.totalSolde)} dt</p>
        </div>
      `;
    }
    
    htmlContent += `
      <table>
        <thead>
          <tr>
            <th>Désignation</th>
            <th style="text-align: right;">Début (dt)</th>
            <th style="text-align: right;">Crédit (dt)</th>
            <th style="text-align: right;">Solde (dt)</th>
          </tr>
        </thead>
        <tbody>
          ${this.balanceData.map(row => `
            <tr>
              <td>${row.designation}</td>
              <td style="text-align: right;">${this.formatNumber(row.debut)}</td>
              <td style="text-align: right;">${this.formatNumber(row.credit)}</td>
              <td style="text-align: right;">${this.formatNumber(row.solde)}</td>
            </tr>
          `).join('')}
          ${this.summary ? `
            <tr class="total-row">
              <td><strong>TOTAL</strong></td>
              <td style="text-align: right;"><strong>${this.formatNumber(this.summary.totalDebut)}</strong></td>
              <td style="text-align: right;"><strong>${this.formatNumber(this.summary.totalCredit)}</strong></td>
              <td style="text-align: right;"><strong>${this.formatNumber(this.summary.totalSolde)}</strong></td>
            </tr>
          ` : ''}
        </tbody>
      </table>
    `;
    
    this.printService.printA4Report(htmlContent, title);
  }
}
