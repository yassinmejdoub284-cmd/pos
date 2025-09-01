import { Injectable } from '@angular/core';
import { ZReportData } from '../models/session.model';

@Injectable({
  providedIn: 'root'
})
export class PrintService {
  
  constructor() {}

  // Print Z Report using ESC/POS commands
  printZReport(zReportData: ZReportData): void {
    const escposData = this.generateESCReport(zReportData, 'Z');
    this.sendToPrinter(escposData);
  }

  // Print X Report using ESC/POS commands
  printXReport(xReportData: ZReportData): void {
    const escposData = this.generateESCReport(xReportData, 'X');
    this.sendToPrinter(escposData);
  }

  // Generate ESC/POS commands for reports
  private generateESCReport(reportData: ZReportData, type: 'X' | 'Z'): string {
    const { session, summary } = reportData;
    
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
      console.log('Printing with Tauri:', escposData);
      
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
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.2;
            margin: 0;
            padding: 20px;
            width: 58mm;
            max-width: 58mm;
          }
          .center { text-align: center; }
          .left { text-align: left; }
          .bold { font-weight: bold; }
          .underline { text-decoration: underline; }
          @media print {
            body { margin: 0; padding: 10px; }
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
  private formatCurrency(amount: number): string {
    return amount.toFixed(3) + ' TND';
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

  // Test printer connection
  testPrinter(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // In a real implementation, this would test the printer connection
        // For now, we'll simulate success
        console.log('Testing printer connection...');
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
