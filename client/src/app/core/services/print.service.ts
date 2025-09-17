import { Injectable } from '@angular/core';
import { ZReportData } from '../models/session.model';
import { Sale } from '../models/sale.model';

@Injectable({
  providedIn: 'root'
})
export class PrintService {

  constructor() { }

  // Print Z Report using ESC/POS commands
  printZReport(zReportData: ZReportData): void {
    const escposData = this.generateESCReport(zReportData, 'Z');
    this.sendToPrinter(escposData);
  }

  printDailyExtractWithWithdrawal(dailyExtract: any, companyData?: any): void {
    const escposData = this.generateDailyExtractESC(dailyExtract, companyData);
    this.sendToPrinter(escposData);
  }

  // Print X Report using ESC/POS commands
  printXReport(xReportData: ZReportData): void {
    const escposData = this.generateESCReport(xReportData, 'X');
    this.sendToPrinter(escposData);
  }

  // Print a single sale receipt (web-compatible HTML print)
  printSaleReceipt(sale: Sale, options?: { openPreviewOnly?: boolean }): void {
    const html = this.buildSaleReceiptHtml(sale);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Impossible d\'ouvrir la fenêtre d\'impression');
      }

      printWindow.document.write(html);
      printWindow.document.close();

      if (!options?.openPreviewOnly) {
        printWindow.onload = () => {
          printWindow.print();
          printWindow.close();
        };
      }
    } catch (error) {
      console.error('Erreur impression reçu:', error);
      alert('Erreur d\'impression: ' + error);
    }
  }

  // Build a simple, thermal-style HTML receipt for a sale
  buildSaleReceiptHtml(sale: Sale): string {
    const createdAt = new Date(sale.createdAt);
    const date = createdAt.toLocaleDateString('fr-FR');
    const time = createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const itemsRows = (sale.items || [])
      .map(item => {
        const unit = Number(item.unitPrice || 0).toFixed(3);
        const qty = Number(item.quantity || 0).toString();
        const total = Number(item.total || 0).toFixed(3);
        const name = (item.productName || '').toString();
        
        if (item.isWholesale) {
          const bundleQty = item.bundleQuantity || 0;
          const bundlePrice = item.bundlePrice || 0;
          const bundleSize = item.bundleSize || 1;
          return `
            <tr>
              <td class="name">${this.escapeHtml(name)}<br><small style="color: #8b5cf6; font-weight: bold;">GROS</small></td>
              <td class="qty">${bundleQty} fardeau${bundleQty > 1 ? 'x' : ''}<br><small>(${qty} unités)</small></td>
              <td class="price">${bundlePrice.toFixed(3)}/fardeau<br><small>(${(bundlePrice / bundleSize).toFixed(3)}/unité)</small></td>
              <td class="total">${total}</td>
            </tr>
          `;
        } else {
          return `
            <tr>
              <td class="name">${this.escapeHtml(name)}</td>
              <td class="qty">${qty}</td>
              <td class="price">${unit}</td>
              <td class="total">${total}</td>
            </tr>
          `;
        }
      })
      .join('');

    const discount = Number(sale.discount || 0);
    const subtotal = Number((sale.items || []).reduce((s, it) => s + (Number(it.total) || 0), 0));
    const net = Number(sale.finalTotal || subtotal - discount);
    const payment = sale.paymentMethod?.name || '—';
    const clientName = sale.client ? `${sale.client.firstName} ${sale.client.lastName}` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reçu Vente #${sale.id}</title>
          <style>
            @page { margin: 0 !important; }
            body { font-family: 'Courier New', monospace; margin: 0; padding: 8px; }
            .ticket { width: 300px; margin: 0 auto; }
            .center { text-align: center; }
            .line { border-top: 1px dashed #000; margin: 8px 0; }
            .double-line { border-top: 2px solid #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { font-size: 12px; padding: 2px 0; }
            td.name { width: 48%; }
            td.qty { width: 12%; text-align: right; }
            td.price { width: 20%; text-align: right; }
            td.total { width: 20%; text-align: right; }
            .muted { color: #444; }
            .bold { font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="center bold">PATISSERIE MODERNE</div>
            <div class="center muted">123 Rue de la Paix</div>
            <div class="center muted">Tunis, Tunisie</div>
            <div class="center muted">Tel: +216 71 123 456</div>
            <div class="double-line"></div>
            <div>Date: ${date} &nbsp;&nbsp; Heure: ${time}</div>
            ${clientName ? `<div>Client: ${this.escapeHtml(clientName)}</div>` : ''}
            <div>Ticket: #${sale.id}</div>
            ${this.isWholesaleSale(sale) ? '<div style="color: #8b5cf6; font-weight: bold; text-align: center;">VENTE GROS</div>' : ''}
            <div class="line"></div>
            <table>
              <thead>
                <tr>
                  <td class="bold">ARTICLE</td>
                  <td class="bold" style="text-align:right">QTE</td>
                  <td class="bold" style="text-align:right">P.U.</td>
                  <td class="bold" style="text-align:right">TOTAL</td>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
            <div class="line"></div>
            <table>
              <tr><td class="bold">Sous-total</td><td style="text-align:right" class="bold">${subtotal.toFixed(3)} dt</td></tr>
              ${discount > 0 ? `<tr><td>Remise</td><td style="text-align:right">-${discount.toFixed(3)} dt</td></tr>` : ''}
              <tr><td class="bold">TOTAL A PAYER</td><td style="text-align:right" class="bold">${net.toFixed(3)} dt</td></tr>
              <tr><td>Paiement</td><td style="text-align:right">${this.escapeHtml(payment)}</td></tr>
            </table>
            <div class="line"></div>
            <div class="center">Merci de votre visite!</div>
          </div>
        </body>
      </html>
    `;
  }

  // Generate ESC/POS commands for reports
  private generateESCReport(reportData: ZReportData, type: 'X' | 'Z'): string {
    const { session, summary, closureData } = reportData;

    let escpos = '';

    // Initialize printer
    escpos += '\x1B\x40';

    // Set character size and alignment
    escpos += '\x1B\x21\x00'; // Normal size
    escpos += '\x1B\x61\x01'; // Center align

    // Header
    escpos += '==================\n';
    escpos += 'RAPPORT ' + type + '\n';
    escpos += '==================\n\n';

    // Company info (would come from settings)
    escpos += 'PATISSERIE MODERNE\n';
    escpos += '123 Rue de la Paix\n';
    escpos += 'Tunis, Tunisie\n';
    escpos += 'Tel: +216 71 123 456\n\n';

    // Session info
    escpos += '\x1B\x61\x00'; // Left align
    escpos += 'Session: #' + session.id + '\n';
    escpos += 'Caissier: ' + session.user?.firstName + ' ' + session.user?.lastName + '\n';
    escpos += 'POS: ' + session.posId + '\n';
    escpos += 'Ouvert: ' + this.formatDateTime(session.openedAt) + '\n';

    if (session.closedAt) {
      escpos += 'Fermé: ' + this.formatDateTime(session.closedAt) + '\n';
    }

    escpos += '\n';

    // Sales summary
    escpos += 'RÉCAPITULATIF VENTES\n';
    escpos += '===================\n';

    if (summary.salesByPayment) {
      Object.entries(summary.salesByPayment).forEach(([method, data]) => {
        escpos += method + ': ' + this.formatCurrency(data.amount) + ' TND\n';
        escpos += '  (' + data.count + ' tickets)\n';
      });
    }

    escpos += '\n';
    escpos += 'Total Ventes: ' + this.formatCurrency(summary.totalSales) + ' TND\n';
    escpos += 'Nombre Tickets: ' + summary.totalTickets + '\n\n';

    // Cash movements
    if (session.cashMovements && session.cashMovements.length > 0) {
      escpos += 'MOUVEMENTS CAISSE\n';
      escpos += '=================\n';

      session.cashMovements.forEach(movement => {
        escpos += this.getCashMovementTypeLabel(movement.type) + ': ' + this.formatCurrency(movement.amount) + ' TND\n';
        escpos += '  ' + movement.reason + '\n';
        escpos += '  ' + this.formatDateTime(movement.createdAt) + '\n\n';
      });
    }

    // Cash counting
    escpos += 'COMPTAGE ESPÈCES\n';
    escpos += '================\n';
    escpos += 'Fonds de caisse: ' + this.formatCurrency(session.openingFund) + ' TND\n';
    escpos += 'Espèces attendues: ' + this.formatCurrency(summary.expectedCash) + ' TND\n';

    if (session.countedCash) {
      escpos += 'Espèces comptées: ' + this.formatCurrency(session.countedCash) + ' TND\n';
      escpos += 'Écart: ' + this.formatCurrency(session.variance || 0) + ' TND\n';

      if (session.variance && session.variance !== 0) {
        escpos += '\n';
        if (session.variance > 0) {
          escpos += 'SURPLUS: ' + this.formatCurrency(session.variance) + ' TND\n';
        } else {
          escpos += 'MANQUE: ' + this.formatCurrency(Math.abs(session.variance)) + ' TND\n';
        }
      }
    }

    escpos += '\n';

    // Closing info
    if (session.closedAt) {
      escpos += 'Fonds pour prochaine session: ' + this.formatCurrency(session.openingFund) + ' TND\n';

      // Withdrawal information (only for Z reports with closure data)
      if (type === 'Z' && closureData) {
        if (closureData.withdrawalAmount > 0) {
          escpos += 'Retrait vers Caisse Centrale: ' + this.formatCurrency(closureData.withdrawalAmount) + ' TND\n';
          escpos += 'Solde restant en caisse: ' + this.formatCurrency(closureData.remainingBalance) + ' TND\n';
        }
      }

      // Calculate deposit amount
      const depositAmount = (session.countedCash || 0) - (session.openingFund || 0);
      if (depositAmount > 0) {
        escpos += 'Montant à déposer: ' + this.formatCurrency(depositAmount) + ' TND\n';
      }
    }

    escpos += '\n';

    // Signatures
    escpos += 'Signatures:\n';
    escpos += 'Caissier: _________________\n';
    escpos += 'Responsable: ______________\n\n';

    // Footer
    escpos += '\x1B\x61\x01'; // Center align
    escpos += 'Merci de votre visite!\n';
    escpos += 'Rapport généré le ' + this.formatDateTime(new Date()) + '\n';

    if (type === 'Z') {
      escpos += 'Rapport Z #' + session.zSeq + '\n';
    } else {
      escpos += 'Rapport X #' + session.xSeq + '\n';
    }

    escpos += '\n\n\n';

    // Cut paper
    escpos += '\x1D\x56\x00';

    return escpos;
  }

  // Send data to printer
  // Generate ESC/POS commands for daily extract with withdrawal
  private generateDailyExtractESC(dailyExtract: any, companyData?: any): string {
    let escpos = '';

    // Initialize printer
    escpos += '\x1B\x40';

    // Left align everything
    escpos += '\x1B\x61\x00';

    // Stylish header with emojis (grayscale)
    escpos += '╔══════════════════════════════════╗\n';
    escpos += '📊 EXTRait JOURNALIÈRE 📊\n';
    escpos += '╚══════════════════════════════════╝\n\n';

    // Company info with style - use real data
    const companyName = companyData?.companyName || 'PATISSERIE MODERNE';
    const depotName = companyData?.depotName || '';
    const address = companyData?.address || '123 Rue de la Paix';
    const city = companyData?.city || 'Tunis, Tunisie';
    const phone = companyData?.phone || '+216 71 123 456';

    escpos += '🏪 ' + companyName + '\n';
    if (depotName) {
      escpos += '🏢 ' + depotName + '\n';
    }
    escpos += '📍 ' + address + '\n';
    escpos += '🌍 ' + city + '\n';
    escpos += '📞 ' + phone + '\n\n';

    // Date with emojis
    escpos += '📅 Date: ' + this.formatDate(dailyExtract.date) + '\n';
    escpos += '🕐 Heure clôture: ' + this.formatDateTime(dailyExtract.closureTimestamp) + '\n\n';

    // Families and Products with compact table format
    if (dailyExtract.families && dailyExtract.families.length > 0) {
      dailyExtract.families.forEach((family: any) => {
        escpos += '🍰 ' + family.name.toUpperCase() + ' 🍰\n';
        escpos += '========================\n';
        
        // Table header
        escpos += 'Article      Qty P.U. Total\n';
        escpos += '========================\n';

        if (family.products && family.products.length > 0) {
          family.products.forEach((product: any) => {
            const unitPrice = product.quantity > 0 ? product.revenue / product.quantity : 0;
            const productName = product.name.length > 12 ? product.name.substring(0, 12) : product.name.padEnd(12);
            const qty = product.quantity.toString().padStart(2);
            const price = this.formatCurrency(unitPrice).padStart(4);
            const total = this.formatCurrency(product.revenue).padStart(6);
            
            escpos += productName + ' ' + qty + ' ' + price + ' ' + total + '\n';
          });
        }

        // Family total row
        escpos += '========================\n';
        const totalLabel = 'Total ' + family.name;
        const totalValue = this.formatCurrency(family.totalRevenue);
        escpos += totalLabel.padEnd(12) + '   ' + totalValue.padStart(6) + '\n';
        escpos += '========================\n\n';
      });
    }

    // Summary with compact table format
    escpos += '📈 RÉCAPITULATIF 📈\n';
    escpos += '========================\n';
    escpos += 'Totale Remise     ' + this.formatCurrency(dailyExtract.totalDiscount) + '\n';
    escpos += 'Totale Recette    ' + this.formatCurrency(dailyExtract.totalRevenue) + '\n';
    escpos += 'Totale Caisse     ' + this.formatCurrency(dailyExtract.soldeDebit) + '\n';

    // Expenses with compact format
    if (dailyExtract.expenses && dailyExtract.expenses.length > 0) {
      escpos += 'Dépense\n';
      dailyExtract.expenses.forEach((expense: any) => {
        escpos += '--- ' + expense.description + ' ' + this.formatCurrency(expense.amount) + '\n';
      });
    }

    // Final summary
    escpos += 'Totale Caisse     ' + this.formatCurrency(dailyExtract.totalCaisse) + '\n';
    escpos += 'Retrait           ' + this.formatCurrency(dailyExtract.withdrawal) + '\n';
    escpos += 'Totale Reste      ' + this.formatCurrency(dailyExtract.remainingCash) + '\n';
    escpos += '========================\n\n';

    // Stylish footer
    escpos += '╔══════════════════════════════════╗\n';
    escpos += '✅ Fin de l\'extrait ✅\n';
    escpos += 'Merci de votre confiance! 💙\n';
    escpos += '╚══════════════════════════════════╝\n\n';

    // Cut paper
    escpos += '\x1D\x56\x00';

    return escpos;
  }

  private sendToPrinter(escposData: string): void {
    // Check if running in Tauri environment
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      this.printWithTauri(escposData);
    } else {
      this.printWithWebAPI(escposData);
    }
  }

  // Print using Tauri (desktop app)
  private async printWithTauri(escposData: string): Promise<void> {
    try {
      // This would use Tauri's printer API
      // For now, we'll simulate it

      // In a real implementation, you would:
      // 1. Use Tauri's invoke to call a Rust function
      // 2. The Rust function would send ESC/POS commands to the printer
      // 3. Handle printer status and errors

      alert('Impression envoyée à l\'imprimante (Tauri)');
    } catch (error) {
      console.error('Tauri printing error:', error);
      alert('Erreur d\'impression: ' + error);
    }
  }

  // Print using Web API (browser)
  private printWithWebAPI(escposData: string): void {
    try {
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Impossible d\'ouvrir la fenêtre d\'impression');
      }

      // Convert ESC/POS to HTML for web printing
      const htmlContent = this.escposToHtml(escposData);

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };
    } catch (error) {
      console.error('Web printing error:', error);
      alert('Erreur d\'impression: ' + error);
    }
  }

  // Convert ESC/POS to HTML for web printing
  private escposToHtml(escposData: string): string {
    // Remove ESC/POS commands and convert to HTML
    let html = escposData
      .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '') // Remove ANSI escape sequences
      .replace(/\x1B\x40/g, '') // Remove ESC @
      .replace(/\x1B\x61\x01/g, '') // Remove center align
      .replace(/\x1B\x61\x00/g, '') // Remove left align
      .replace(/\x1B\x21\x00/g, '') // Remove character size
      .replace(/\x1D\x56\x00/g, '') // Remove cut command
      .replace(/\n/g, '<br>');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport de Caisse</title>
        <style>
          @page {
            margin: 0 !important;   /* 🔥 remove browser print margins */
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.2;
            margin: 0 !important;
            padding: 0 !important;
          }
          .center { text-align: center; }
          .left { text-align: left; }
          .bold { font-weight: bold; }
          .underline { text-decoration: underline; }
          @media print {
            body { margin: 0; padding: 0; }
            * { margin: 0; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="center">
          ${html}
        </div>
      </body>
      </html>
    `;
  }

  // Utility methods
  private formatCurrency(amount: number | string): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return (isNaN(numAmount) ? 0 : numAmount).toFixed(3) + ' TND';
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private formatDateTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private getCashMovementTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'ENTREE': 'Entrée de caisse',
      'SORTIE': 'Sortie de caisse',
      'DEPOT_COFFRE': 'Dépôt coffre',
      'RETRAIT_CENTRALE': 'Retrait centrale',
      'AJUSTEMENT': 'Ajustement'
    };
    return labels[type] || type;
  }

  // Check if sale is wholesale
  private isWholesaleSale(sale: Sale): boolean {
    return sale.items && sale.items.some(item => item.isWholesale);
  }

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Test printer connection
  testPrinter(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // In a real implementation, this would test the printer connection
        // For now, we'll simulate success
        setTimeout(() => resolve(true), 1000);
      } catch (error) {
        console.error('Printer test failed:', error);
        resolve(false);
      }
    });
  }

  // Get printer status
  getPrinterStatus(): Promise<{
    connected: boolean;
    paperOut: boolean;
    coverOpen: boolean;
    error: string | null;
  }> {
    return new Promise((resolve) => {
      try {
        // In a real implementation, this would check actual printer status
        resolve({
          connected: true,
          paperOut: false,
          coverOpen: false,
          error: null
        });
      } catch (error) {
        resolve({
          connected: false,
          paperOut: false,
          coverOpen: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }
}
