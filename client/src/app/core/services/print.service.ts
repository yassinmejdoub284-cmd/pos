import { Injectable } from '@angular/core';
import { ZReportData } from '../models/session.model';
import { Sale } from '../models/sale.model';
import { SettingsService, AppSettings } from './settings.service';

@Injectable({
  providedIn: 'root'
})
export class PrintService {
  private isDesktop = false;

  constructor(private settingsService: SettingsService) {
    // Check if we're running in Tauri desktop environment
    this.isDesktop = typeof window !== 'undefined' && (window as any).__TAURI__;
  }

  // Print methods that work in both desktop and web environments
  async printPlainText(text: string): Promise<void> {
    if (this.isDesktop) {
      const { invoke } = await import('@tauri-apps/api/core');
    await invoke('print_text_direct', { text });
    } else {
      // Web fallback: open print dialog with plain text
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head><title>Print</title></head>
            <body style="font-family: monospace; white-space: pre-wrap;">${text}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  }

  async printHtml(html: string): Promise<void> {
    if (this.isDesktop) {
      const { invoke } = await import('@tauri-apps/api/core');
    await invoke('print_html', { html });
    } else {
      // Web fallback: open print dialog with HTML
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      }
    }
  }

  async printPdf(pdfBase64: string): Promise<void> {
    if (this.isDesktop) {
      const { invoke } = await import('@tauri-apps/api/core');
    await invoke('print_pdf', { pdfBase64: pdfBase64 });
    } else {
      // Web fallback: download PDF
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${pdfBase64}`;
      link.download = 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  async printEscPos(escposData: string): Promise<void> {
    if (this.isDesktop) {
      const { invoke } = await import('@tauri-apps/api/core');
    const base64 = this.toBase64(this.stringToBytes(escposData));
    await invoke('print_raw_bytes', { data_base64: base64 });
    } else {
      // Web fallback: convert ESC/POS to readable format and print
      const readableText = this.convertEscPosToReadable(escposData);
      await this.printPlainText(readableText);
    }
  }

  async openCashDrawer(): Promise<void> {
    if (this.isDesktop) {
      const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_cash_drawer');
    } else {
      // Web fallback: show message
      alert('Ouverture du tiroir-caisse (mode web)');
    }
  }

  // Receipts and reports route to Tauri print
  printZReport(zReportData: ZReportData): void {
    const escposData = this.generateESCReport(zReportData, 'Z');
    void this.printEscPos(escposData);
  }

  printDailyExtractWithWithdrawal(sessionReport: any, companyData?: any, withdrawalAmount: number = 0): void {
    const escposData = this.generateDailyExtractESC(sessionReport, companyData, withdrawalAmount);
    void this.printEscPos(escposData);
  }

  // Print detailed session report for thermal printer
  printDetailedSessionReport(sessionReport: any, companyData?: any): void {
    const escposData = this.generateDailyExtractESC(sessionReport, companyData, 0);
    void this.printEscPos(escposData);
  }

  printXReport(xReportData: ZReportData): void {
    const escposData = this.generateESCReport(xReportData, 'X');
    void this.printEscPos(escposData);
  }

  printSaleReceipt(sale: Sale, options?: { openPreviewOnly?: boolean }): void {
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        // Check if desktop version is enabled
        if (settings?.isDesktopVersion) {
          // Use Tauri direct printing with text format
          const text = this.buildSaleReceiptText(sale, settings);
          void this.printPlainText(text);
        } else {
          // Use browser window printing with HTML format
          this.printReceiptInBrowser(sale, settings);
        }
      },
      error: () => {
        // Fallback to default settings if error
        const text = this.buildSaleReceiptText(sale, null);
        void this.printPlainText(text);
      }
    });
  }

  // Print invoice (different from regular receipt)
  printInvoice(invoice: any, options?: { openPreviewOnly?: boolean }): void {
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        // Check if desktop version is enabled
        if (settings?.isDesktopVersion) {
          // Use Tauri direct printing with text format
          const text = this.buildInvoiceText(invoice, settings);
          void this.printPlainText(text);
        } else {
          // Use browser window printing with HTML format
          this.printInvoiceInBrowser(invoice, settings);
        }
      },
      error: () => {
        // Fallback to default settings if error
        const text = this.buildInvoiceText(invoice, null);
        void this.printPlainText(text);
      }
    });
  }

  // Printers management (stubs wired to backend)
  async getAvailablePrinters(): Promise<Array<{ name: string; isDefault: boolean }>> {
    if (this.isDesktop) {
      const { invoke } = await import('@tauri-apps/api/core');
    return invoke('get_available_printers');
    } else {
      // Web fallback: return empty array
      return [];
    }
  }

  async setDefaultPrinter(printerName: string): Promise<boolean> {
    if (this.isDesktop) {
      const { invoke } = await import('@tauri-apps/api/core');
    return invoke<{ success: boolean; message: string }>('set_default_printer', { printer_name: printerName })
        .then((res: any) => !!res?.success);
    } else {
      // Web fallback: return false
      return false;
    }
  }

  // Browser printing method
  private printReceiptInBrowser(sale: Sale, settings?: AppSettings | null): void {
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (!printWindow) {
      console.error('Could not open print window');
      return;
    }

    // Use the existing HTML receipt builder
    const htmlContent = this.buildSaleReceiptHtml(sale, settings);

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load, then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 100);
    };
  }


  // --- Helpers ---
  private stringToBytes(input: string): Uint8Array {
    return new TextEncoder().encode(input);
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
    }
    return btoa(binary);
  }

  // Convert ESC/POS commands to readable text for web printing
  private convertEscPosToReadable(escposData: string): string {
    // Remove ESC/POS control sequences and keep only printable characters
    return escposData
      .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '') // Remove ANSI escape sequences
      .replace(/\x1B\x40/g, '') // Remove ESC @ (initialize)
      .replace(/\x1B\x61[0-2]/g, '') // Remove ESC a (alignment) - this was causing the 'a' character
      .replace(/\x1B\x21[0-9A-F]/g, '') // Remove ESC ! (character size)
      .replace(/\x1D\x56[0-2]/g, '') // Remove GS V (cut paper) - this was causing the 'V' character
      .replace(/\x1B\x4A[0-9A-F]/g, '') // Remove ESC J (line feed)
      .replace(/\x0A/g, '\n') // Convert LF to newline
      .replace(/\x0D/g, '') // Remove CR
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters
      .replace(/^a/, '') // Remove any remaining 'a' at the beginning
      .replace(/V$/, '') // Remove any remaining 'V' at the end
      .replace(/a$/, '') // Remove any remaining 'a' at the end
      // Remove leftover single-letter alignment artifacts at line start
      .replace(/^\s*[aA]\s*$/gm, '')
      // Remove 'a' at the beginning of any line
      .replace(/^a/gm, '')
      // Specifically handle stray 'a' before footer lines like 'Merci de votre confiance!'
      .replace(/^a(?=Merci)/gm, '')
      // Remove stray 'a' before common headings
      .replace(/^a(?=Session\s*:)/gm, '')
      .replace(/^a(?=Caissier\s*:)/gm, '')
      .replace(/^a(?=Ouvert\s*:)/gm, '')
      .replace(/^a(?=Fermé\s*:)/gm, '')
      // Remove 'a' before 'Extrait Journalière'
      .replace(/^a(?=Extrait)/gm, '')
      .trim();
  }

  // Helper method to get ticket number for printing
  private getTicketNumberForPrint(sale: any): string {
    let ticketNumber = sale.id.toString().padStart(4, '0'); // Default fallback
    
    if (sale.dailyTicketNumber) {
      if (sale.dailyTicketNumber.includes('/')) {
        ticketNumber = sale.dailyTicketNumber.split('/')[1];
      } else {
        ticketNumber = sale.dailyTicketNumber;
      }
    }
    
    return ticketNumber;
  }

  // Print Z Report using ESC/POS commands
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
    const openedAtStr = this.formatDateTime(session.openedAt);
    const closedAtStr = session.closedAt ? this.formatDateTime(session.closedAt) : '';
    escpos += 'Ouvert: ' + openedAtStr + (closedAtStr ? '  |  Fermé: ' + closedAtStr : '') + '\n\n';

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
  // Generate comprehensive ESC/POS commands for detailed daily extract
  private generateDailyExtractESC(sessionReport: any, companyData?: any, withdrawalAmount: number = 0): string {
    let escpos = '';

    // Debug: Log the session report structure to help identify data issues (remove in production)
    console.log('Session Report Structure:', sessionReport);
    console.log('Session data:', sessionReport.session);
    console.log('Session sales:', sessionReport.session?.sales);
    console.log('Opening fund from session:', sessionReport.session?.openingFund);
    console.log('Families data:', sessionReport.families);
    console.log('Summary data:', sessionReport.summary);

    // Initialize printer
    escpos += '\x1B\x40';
    escpos += '\x1B\x61\x01'; // Center align for header

    // Minimal header removed per request

    // Show title centered and date/time right aligned
    const closedDate = new Date();
    const formatDateNoYearWithTime = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month} ${hours}:${minutes}`;
    };
    const closingTime = formatDateNoYearWithTime(closedDate);
    
    // Add decorative top border
    escpos += '================================\n';
    
    // Center both title and date on the same line
    escpos += '\x1B\x61\x01'; // Center align
    escpos += 'Extrait Journalière - ' + closingTime + '\n';
    
    // Add decorative bottom border
    escpos += '================================\n\n';

    // Session info (kept minimal or removed as requested)
    escpos += '\x1B\x61\x00'; // Left align
    const session = sessionReport.session;
    const summary = sessionReport.summary;

    // Opening fund - keep but do not print session/user lines above
    const sessionOpeningFund = session.openingFund || 
                              session.opening_fund || 
                              session.fondsInitial || 
                              sessionReport.openingFund ||
                              sessionReport.fondsInitial ||
                              0;

    // Sales by family with detailed products

    // Build products per family from session sales if needed
    const sales: any[] = (sessionReport?.session?.sales || []) as any[];
    const familyToProducts: Record<string, { name: string; quantity: number; revenue: number }[]> = {};
    const normalizeFamily = (name: any): string => (name ?? '').toString().trim();

    console.log('Processing sales for product aggregation:', sales.length, 'sales');
    
    if (sales.length) {
      const tempMap: Record<string, Record<string, { name: string; quantity: number; revenue: number }>> = {};
      for (const sale of sales) {
        const items: any[] = (sale.items || []) as any[];
        console.log('Sale items:', items.length, 'items in sale', sale.id);
        for (const it of items) {
          console.log('Processing item:', it);
          const famCandidate = it.familyName || it.categoryName || it.family || it.product?.famille?.name || it.product?.family?.name || '';
          const fam = normalizeFamily(famCandidate);
          const familyName = fam && fam.length ? fam : 'AUTRES';
          const productName: string = (it.productName || it.name || 'Produit').toString();
          const qty: number = parseFloat(String(it.quantity ?? it.qty ?? 0)) || 0;
          const lineTotal: number = parseFloat(String(it.total ?? it.revenue ?? it.amount ?? 0)) || 0;
          console.log('Item details:', { familyName, productName, qty, lineTotal });
          if (!tempMap[familyName]) tempMap[familyName] = {};
          if (!tempMap[familyName][productName]) {
            tempMap[familyName][productName] = { name: productName, quantity: 0, revenue: 0 };
          }
          tempMap[familyName][productName].quantity += qty;
          tempMap[familyName][productName].revenue += lineTotal;
        }
      }
      // Convert to arrays sorted by revenue desc
      for (const famName of Object.keys(tempMap)) {
        familyToProducts[famName] = Object.values(tempMap[famName])
          .filter(p => p.quantity > 0 && p.revenue > 0)
          .sort((a, b) => b.revenue - a.revenue);
      }
      console.log('Final familyToProducts:', familyToProducts);
    }

    if (sessionReport.families && sessionReport.families.length > 0) {
      sessionReport.families.forEach((family: any) => {
        const famName: string = normalizeFamily(family.name || 'AUTRES');
        const familyTotal = Number(family.totalRevenue || family.total || family.amount || family.amountTTC || 0)
          || (familyToProducts[famName]?.reduce((s, p) => s + p.revenue, 0) || 0);
        const amount = this.formatCurrency(familyTotal);
        const totalWidth = 32; // Total line width
        const usedSpace = famName.length + 1 + amount.length; // +1 for colon
        const dots = '.'.repeat(Math.max(1, totalWidth - usedSpace));
        const line = famName.toUpperCase() + ':' + dots + amount;
        escpos += line + '\n';
      });
    } else {
      // No families in report: synthesize from sales map
      const famNames = Object.keys(familyToProducts);
      if (!famNames.length) {
        escpos += 'Aucune donnée de famille disponible\n';
      } else {
        for (const famName of famNames) {
          const famTotal = familyToProducts[famName].reduce((s, x) => s + x.revenue, 0);
          const amount = this.formatCurrency(famTotal);
          const totalWidth = 32; // Total line width
          const usedSpace = famName.length + 1 + amount.length; // +1 for colon
          const dots = '.'.repeat(Math.max(1, totalWidth - usedSpace));
          const line = famName.toUpperCase() + ':' + dots + amount;
          escpos += line + '\n';
        }
      }
    }

    // Add total for family products
    const totalFamilySales = sessionReport.families && sessionReport.families.length > 0 
      ? sessionReport.families.reduce((sum: number, family: any) => {
          const famName = normalizeFamily(family.name || 'AUTRES');
          const familyTotal = Number(family.totalRevenue || family.total || family.amount || family.amountTTC || 0)
            || (familyToProducts[famName]?.reduce((s, p) => s + p.revenue, 0) || 0);
          return sum + familyTotal;
        }, 0)
      : Object.values(familyToProducts).reduce((sum, products) => 
          sum + products.reduce((s, p) => s + p.revenue, 0), 0);
    
    escpos += '--------------------------------\n';
    const totalAmount = this.formatCurrency(totalFamilySales);
    const totalWidth = 32;
    const usedSpace = 'TOTAL:'.length + totalAmount.length;
    const dots = '.'.repeat(Math.max(1, totalWidth - usedSpace));
    escpos += 'TOTAL:' + dots + totalAmount + '\n\n';

    // Sales summary by payment method removed per request

    // Cash movements section removed per request

    // Financial summary
    escpos += '################################\n';
    escpos += '    RÉSUMÉ FINANCIER\n';
    escpos += '################################\n';
    
    const expectedCash = summary.expectedCash || 0;
    const totalSales = summary.totalSales || 0;
    const financialOpeningFund = session.openingFund || 0;
    
    const financialTotalWidth = 32;
    
    const formatFinancialLine = (label: string, amount: number) => {
      const amountStr = this.formatCurrency(amount);
      const usedSpace = label.length + amountStr.length;
      const spaces = ' '.repeat(Math.max(1, financialTotalWidth - usedSpace));
      return label + spaces + amountStr;
    };
    
    // Calculate encaissement using the same logic as cash closure component
    const getClientPaymentsTotal = () => parseFloat(summary.clientPaymentsTotal || 0) || 0;
    
    const getTotalOrderAdvances = () => {
      const movements = session.cashMovements || [];
      return movements
        .filter((m: any) => {
          const reason = (m.reason || '').toLowerCase();
          return m.type === 'ENTREE' && (
            reason.includes('acompte') || 
            reason.includes('avance') || 
            reason.includes('advance')
          );
        })
        .reduce((sum: number, m: any) => sum + (parseFloat(m.amount || 0) || 0), 0);
    };
    
    const getCashFromSalesNetOfCredit = () => {
      const totalSales = parseFloat(summary.totalSales || 0) || 0;
      const credit = parseFloat(summary.creditOutstanding || 0) || 0;
      return Math.max(0, totalSales - credit);
    };
    
    const getFundingsTotal = () => {
      const movements = session.cashMovements || [];
      return movements
        .filter((m: any) => (m?.type === 'ENTREE') && 
          ((m?.reason || '').toLowerCase().includes('fonds de caisse') || 
           (m?.reason || '').toLowerCase().includes('alimentation') || 
           (m?.reason || '').toLowerCase().includes('alimenter')))
        .reduce((sum: number, m: any) => sum + (parseFloat(m.amount || 0) || 0), 0);
    };
    
    const actualEntries = getClientPaymentsTotal() + getTotalOrderAdvances() + getCashFromSalesNetOfCredit() + getFundingsTotal();
    const actualExits = summary.sortie || 0;
    
    escpos += formatFinancialLine('Fonds initial:', financialOpeningFund) + '\n';
    escpos += formatFinancialLine('Enc. client:', getClientPaymentsTotal()) + '\n';
    escpos += formatFinancialLine('Acomptes sur Cmd.:', getTotalOrderAdvances()) + '\n';
    escpos += formatFinancialLine('Alim. de caisse:', getFundingsTotal()) + '\n';
    escpos += formatFinancialLine('Espèces en caisse:', getCashFromSalesNetOfCredit()) + '\n';
    
    // Calculate detailed décaissements
    const getExpensesTotal = () => {
      const movements = session.cashMovements || [];
      return movements
        .filter((m: any) => m.type === 'SORTIE' && 
          !(m.reason || '').toLowerCase().includes('fournisseur') &&
          !(m.reason || '').toLowerCase().includes('supplier'))
        .reduce((sum: number, m: any) => sum + (parseFloat(m.amount || 0) || 0), 0);
    };
    
    const getSupplierPayments = () => {
      const movements = session.cashMovements || [];
      return movements
        .filter((m: any) => m.type === 'SORTIE' && 
          ((m.reason || '').toLowerCase().includes('fournisseur') ||
           (m.reason || '').toLowerCase().includes('supplier')));
    };
    
    escpos += formatFinancialLine('Dépenses:', getExpensesTotal()) + '\n';
    
    // Show individual supplier payments
    const supplierPayments = getSupplierPayments();
    const supplierDetails = (summary as any)?.supplierPaymentsDetails || [];
    
    if (supplierPayments.length > 0) {
      supplierPayments.forEach((payment: any) => {
        const amount = parseFloat(payment.amount || 0) || 0;
        const reason = payment.reason || '';
        let supplierName = 'Fournisseur';
        
        // Try to extract supplierPayment id from reason: "Règlement fournisseur #<id> (FOURN:<supplierId>)"
        const idMatch = reason.match(/#(\d+)/);
        const paymentId = idMatch ? parseInt(idMatch[1], 10) : null;
        
        if (supplierDetails && supplierDetails.length && paymentId) {
          const match = supplierDetails.find((d: any) => Number(d.id) === paymentId);
          if (match && match.supplierName) {
            supplierName = match.supplierName;
          }
        }
        
        // Fallback: if reason contains a name in parentheses not just the FOURN code, try to extract
        if (supplierName === 'Fournisseur') {
          const paren = reason.match(/\(([^)]+)\)/);
          if (paren && paren[1] && !/^FOURN:/i.test(paren[1])) {
            supplierName = paren[1].trim();
          }
        }
        
        const line = `${supplierName} - ${this.formatCurrency(amount)}`;
        escpos += line + '\n';
      });
    } else {
      escpos += formatFinancialLine('Règlement Fournisseurs:', 0) + '\n';
    }
    escpos += '--------------------------------\n';
    escpos += formatFinancialLine('Solde attendu:', expectedCash) + '\n';
    
    if (withdrawalAmount > 0) {
      escpos += formatFinancialLine('Retrait central:', withdrawalAmount) + '\n';
      escpos += formatFinancialLine('Solde restant:', expectedCash - withdrawalAmount) + '\n';
    }
    
    escpos += '================================\n\n';

    // Cut paper
    escpos += '\x1D\x56\x00';

    return escpos;
  }

  // Build a simple, thermal-style HTML receipt for a sale
  buildSaleReceiptHtml(sale: Sale, settings?: AppSettings | null): string {
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

    // Generate logo HTML if enabled
    let logoHtml = '';
    if (settings?.printSettings?.showLogo && settings?.logoUrl) {
      const logoSize = settings.printSettings.logoSize || 'medium';
      const logoUrl = this.settingsService.getAbsoluteLogoUrl(settings.logoUrl);
      
      let logoWidth = '60px';
      if (logoSize === 'large') logoWidth = '80px';
      else if (logoSize === 'small') logoWidth = '40px';
      
      logoHtml = `
        <div class="center" style="margin-bottom: 10px;">
          <img src="${logoUrl}" alt="Company Logo" style="max-width: ${logoWidth}; height: auto; max-height: 60px;" />
        </div>
      `;
    }

    const companyName = settings?.companyName || 'PATISSERIE MODERNE';
    const companyAddress = settings?.companyAddress || '123 Rue de la Paix, Tunis, Tunisie';
    const companyPhone = settings?.companyPhone || 'Tel: +216 71 123 456';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reçu Vente #${this.getTicketNumberForPrint(sale)}</title>
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
            ${logoHtml}
            <div class="center bold">${this.escapeHtml(companyName)}</div>
            <div class="center muted">${this.escapeHtml(companyAddress)}</div>
            <div class="center muted">${this.escapeHtml(companyPhone)}</div>
            <div class="double-line"></div>
            <div>Date: ${date} &nbsp;&nbsp; Heure: ${time}</div>
            ${clientName ? `<div>Client: ${this.escapeHtml(clientName)}</div>` : ''}
            <div>Ticket: #${this.getTicketNumberForPrint(sale)}</div>
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


  buildSaleReceiptText(sale: Sale, settings: AppSettings | null): string {
    const createdAt = new Date(sale.createdAt);
    
    // Format date and time based on settings
    const dateFormat = settings?.printSettings?.dateFormat || 'dd/mm/yyyy';
    const timeFormat = settings?.printSettings?.timeFormat || '24h';
    
    let date: string;
    let time: string;
    
    if (dateFormat === 'dd/mm/yyyy') {
      date = createdAt.toLocaleDateString('fr-FR');
    } else if (dateFormat === 'mm/dd/yyyy') {
      date = createdAt.toLocaleDateString('en-US');
    } else {
      date = createdAt.toISOString().split('T')[0];
    }
    
    if (timeFormat === '12h') {
      time = createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } else {
      time = createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    let text = '';
    
    // ESC/POS commands for formatting
    const ESC = '\x1B';
    const centerAlign = ESC + '\x61\x01'; // Center alignment
    const leftAlign = ESC + '\x61\x00';   // Left alignment
    const boldOn = ESC + '\x45\x01';      // Bold on
    const boldOff = ESC + '\x45\x00';     // Bold off
    const normalSize = ESC + '\x21\x00';  // Normal size
    const monospaceFont = ESC + '\x4D\x00'; // Select font A (monospace)
    const resetFont = ESC + '\x40';       // Initialize printer (resets font)
    const noTopMargin = ESC + '\x4C\x00\x00'; // Set top margin to 0
    const noBottomMargin = ESC + '\x4E\x00\x00'; // Set bottom margin to 0
    
    // Eliminate margins and set monospace font
    text += noTopMargin + noBottomMargin + monospaceFont;
    
    // Header
    text += '==================\n';
    
    
    // Company name (bold and centered) - sanitized for thermal printer
    const companyName = this.sanitizeForThermalPrinter(settings?.companyName || 'PATISSERIE MODERNE');
    text += centerAlign + boldOn + companyName + boldOff + normalSize + '\n';
    
    // Company details (centered) - sanitized for thermal printer
    if (settings?.printSettings?.showCompanyDetails) {
      if (settings?.companyAddress) {
        text += centerAlign + this.sanitizeForThermalPrinter(settings.companyAddress) + '\n';
      }
      if (settings?.companyPhone) {
        text += centerAlign + this.sanitizeForThermalPrinter(settings.companyPhone) + '\n';
      }
      if (settings?.companyEmail) {
        text += centerAlign + this.sanitizeForThermalPrinter(settings.companyEmail) + '\n';
      }
    }
    
    text += leftAlign + '==================\n\n';
    
    // Sale info
    text += `Date: ${date}     Heure: ${time}\n`;
    // Extract just the ticket number part (without session ID) for printing
    text += `Ticket: #${this.getTicketNumberForPrint(sale)}\n`;
    
    // Client info (if enabled in settings) - sanitized for thermal printer
    if (settings?.printSettings?.showClientInfo) {
      const clientName = sale.client ? `${sale.client.firstName} ${sale.client.lastName}` : '';
      if (clientName) {
        text += `Client: ${this.sanitizeForThermalPrinter(clientName)}\n`;
      }
    }
    
    if (this.isWholesaleSale(sale)) {
      text += 'VENTE GROS\n';
    }
    
    text += '------------------\n';
    
    // Format currency based on settings
    const currencySymbol = settings?.printSettings?.currencySymbol || 'dt';
    const currencyPosition = settings?.printSettings?.currencyPosition || 'after';
    
    const formatCurrency = (amount: number) => {
      // Round to 3 decimal places maximum and remove trailing zeros
      const rounded = Math.round(amount * 1000) / 1000;
      const formatted = rounded.toString();
      return currencyPosition === 'before' ? `${currencySymbol} ${formatted}` : `${formatted} ${currencySymbol}`;
    };
    
    // Items header
    text += 'ARTICLE           QTE  P.U.    TOTAL\n';
    text += '------------------\n';
    
    // Items - sanitized for thermal printer
    (sale.items || []).forEach(item => {
      const name = this.sanitizeForThermalPrinter((item.productName || '').toString());
      const qty = Number(item.quantity || 0).toString();
      const unit = Number(item.unitPrice || 0);
      const total = Number(item.total || 0);
      
      if (item.isWholesale) {
        const bundleQty = item.bundleQuantity || 0;
        const bundlePrice = item.bundlePrice || 0;
        const bundleSize = item.bundleSize || 1;
        
        text += `${name}\n`;
        text += `GROS              ${bundleQty} fardeau${bundleQty > 1 ? 'x' : ''}  ${formatCurrency(bundlePrice)}  ${formatCurrency(total)}\n`;
        text += `                  (${qty} unités)\n`;
      } else {
        // Format item line with proper spacing
        const namePadded = name.padEnd(16);
        const qtyPadded = qty.padStart(3);
        const unitPadded = formatCurrency(unit).padStart(6);
        const totalPadded = formatCurrency(total).padStart(8);
        text += `${namePadded} ${qtyPadded} ${unitPadded} ${totalPadded}\n`;
      }
    });
    
    text += '------------------\n';
    
    // Totals
    const discount = Number(sale.discount || 0);
    const subtotal = Number((sale.items || []).reduce((s, it) => s + (Number(it.total) || 0), 0));
    const net = Number(sale.finalTotal || subtotal - discount);
    const payment = sale.paymentMethod?.name || '—';
    
    text += `Sous-total                    ${formatCurrency(subtotal)}\n`;
    if (discount > 0 && settings?.printSettings?.showDiscountDetails) {
      text += `Remise                        -${formatCurrency(discount)}\n`;
    }
    text += `TOTAL A PAYER                 ${formatCurrency(net)}\n`;
    // Payment method (if enabled in settings) - sanitized for thermal printer
    if (settings?.printSettings?.showPaymentMethod) {
      text += `Paiement                      ${this.sanitizeForThermalPrinter(payment)}\n`;
    }
    
    text += '==================\n';
    
    // Custom thank you message from settings - sanitized for thermal printer
    const thankYouMessage = this.sanitizeForThermalPrinter(settings?.printSettings?.customTexts?.thankYouMessage || 'Merci de votre visite!');
    text += centerAlign + thankYouMessage + '\n\n\n\n\n\n';
    
    // Paper cut command
    text += ESC + '\x69'; // Full cut
    text += ESC + '\x64\x01'; // Feed 6 lines before cutting
    
    return text;
  }

  // Utility methods
  private formatTicketId(id: number): string {
    // Convert timestamp-based ID to a shorter, more readable format
    // If it's a timestamp (13 digits), extract the last 6 digits
    if (id.toString().length >= 10) {
      return id.toString().slice(-6);
    }
    // Otherwise, use the full ID
    return id.toString();
  }

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

  /**
   * Sanitize text for thermal printer compatibility
   * Converts special characters to ASCII equivalents
   */
  private sanitizeForThermalPrinter(input: string): string {
    return input
      .replace(/[ÀÁÂÃÄÅ]/g, 'A')
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[ÈÉÊË]/g, 'E')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ÌÍÎÏ]/g, 'I')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[ÒÓÔÕÖ]/g, 'O')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ÙÚÛÜ]/g, 'U')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[Ç]/g, 'C')
      .replace(/[ç]/g, 'c')
      .replace(/[Ñ]/g, 'N')
      .replace(/[ñ]/g, 'n')
      .replace(/[Ý]/g, 'Y')
      .replace(/[ý]/g, 'y')
      .replace(/[Ÿ]/g, 'Y')
      .replace(/[ÿ]/g, 'y')
      .replace(/[Æ]/g, 'AE')
      .replace(/[æ]/g, 'ae')
      .replace(/[Œ]/g, 'OE')
      .replace(/[œ]/g, 'oe')
      .replace(/[ß]/g, 'ss')
      .replace(/[€]/g, 'EUR')
      .replace(/[£]/g, 'GBP')
      .replace(/[¥]/g, 'YEN')
      .replace(/[©]/g, '(c)')
      .replace(/[®]/g, '(R)')
      .replace(/[™]/g, 'TM')
      .replace(/[°]/g, 'deg')
      .replace(/[±]/g, '+/-')
      .replace(/[×]/g, 'x')
      .replace(/[÷]/g, '/')
      .replace(/[¼]/g, '1/4')
      .replace(/[½]/g, '1/2')
      .replace(/[¾]/g, '3/4')
      .replace(/[¹]/g, '1')
      .replace(/[²]/g, '2')
      .replace(/[³]/g, '3')
      .replace(/[µ]/g, 'u')
      .replace(/[¶]/g, 'P')
      .replace(/[·]/g, '.')
      .replace(/[¸]/g, ',')
      .replace(/[¹]/g, '1')
      .replace(/[º]/g, 'o')
      .replace(/[»]/g, '>>')
      .replace(/[¼]/g, '1/4')
      .replace(/[½]/g, '1/2')
      .replace(/[¾]/g, '3/4')
      .replace(/[¿]/g, '?')
      .replace(/[¡]/g, '!')
      .replace(/[«]/g, '<<')
      .replace(/[»]/g, '>>')
      .replace(/[–]/g, '-')
      .replace(/[—]/g, '-')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/[…]/g, '...')
      .replace(/[•]/g, '*')
      .replace(/[▪]/g, '*')
      .replace(/[▫]/g, '*')
      .replace(/[‣]/g, '*')
      .replace(/[⁃]/g, '-')
      .replace(/[⁌]/g, '-')
      .replace(/[⁍]/g, '-')
      .replace(/[⁎]/g, '*')
      .replace(/[⁏]/g, ';')
      .replace(/[⁐]/g, '?')
      .replace(/[⁑]/g, '**')
      .replace(/[⁒]/g, '%')
      .replace(/[⁓]/g, '~')
      .replace(/[⁔]/g, '^')
      .replace(/[⁕]/g, '*')
      .replace(/[⁖]/g, '***')
      .replace(/[⁗]/g, '****')
      .replace(/[⁘]/g, '*')
      .replace(/[⁙]/g, '*****')
      .replace(/[⁚]/g, '**')
      .replace(/[⁛]/g, '***')
      .replace(/[⁜]/g, '****')
      .replace(/[⁝]/g, '*****')
      .replace(/[⁞]/g, '******');
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

  // Browser printing method for invoices
  private printInvoiceInBrowser(invoice: any, settings?: AppSettings | null): void {
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    if (!printWindow) {
      console.error('Could not open print window');
      return;
    }

    // Use the existing HTML invoice builder
    const htmlContent = this.buildInvoiceHtml(invoice, settings);

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load, then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 100);
    };
  }

  // Build HTML invoice for browser printing
  buildInvoiceHtml(invoice: any, settings?: AppSettings | null): string {
    const createdAt = new Date(invoice.createdAt);
    const date = createdAt.toLocaleDateString('fr-FR');
    const time = createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const lines = invoice.lines || [];
    const itemsRows = lines.map((line: any) => {
      const name = line.productName || line.name || 'Produit';
      const qty = Number(line.quantity || 0).toString();
      const unitPrice = Number(line.prixVenteTTC || line.unitPrice || 0).toFixed(3);
      const total = Number(line.total || line.amount || 0).toFixed(3);
      
      return `
        <tr>
          <td class="name">${this.escapeHtml(name)}</td>
          <td class="qty">${qty}</td>
          <td class="price">${unitPrice}</td>
          <td class="total">${total}</td>
        </tr>
      `;
    }).join('');

    const totalHT = Number(invoice.totalHT || 0).toFixed(3);
    const totalTVA = Number(invoice.totalTVA || 0).toFixed(3);
    const totalTTC = Number(invoice.total || 0).toFixed(3);
    
    const clientName = invoice.client ? `${invoice.client.firstName || ''} ${invoice.client.lastName || ''}`.trim() : 'Client anonyme';
    const clientMatricule = invoice.client?.matriculeFiscal || '';
    const clientAddress = invoice.client?.address || '';

    // Generate logo HTML if enabled
    let logoHtml = '';
    if (settings?.printSettings?.showLogo && settings?.logoUrl) {
      const logoSize = settings.printSettings.logoSize || 'medium';
      const logoUrl = this.settingsService.getAbsoluteLogoUrl(settings.logoUrl);
      
      let logoWidth = '60px';
      if (logoSize === 'large') logoWidth = '80px';
      else if (logoSize === 'small') logoWidth = '40px';
      
      logoHtml = `
        <div class="center" style="margin-bottom: 10px;">
          <img src="${logoUrl}" alt="Company Logo" style="max-width: ${logoWidth}; height: auto; max-height: 60px;" />
        </div>
      `;
    }

    const companyName = settings?.companyName || 'PATISSERIE MODERNE';
    const companyAddress = settings?.companyAddress || '123 Rue de la Paix, Tunis, Tunisie';
    const companyPhone = settings?.companyPhone || 'Tel: +216 71 123 456';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Facture ${invoice.invoiceNumber || invoice.id}</title>
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
            .invoice-header { background: #f0f0f0; padding: 8px; margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="ticket">
            ${logoHtml}
            <div class="center bold">${this.escapeHtml(companyName)}</div>
            <div class="center muted">${this.escapeHtml(companyAddress)}</div>
            <div class="center muted">${this.escapeHtml(companyPhone)}</div>
            <div class="double-line"></div>
            
            <div class="invoice-header center bold">FACTURE</div>
            <div>N° Facture: ${invoice.invoiceNumber || `FAC-${invoice.id}`}</div>
            <div>Date: ${date} &nbsp;&nbsp; Heure: ${time}</div>
            <div class="line"></div>
            
            <div class="bold">CLIENT:</div>
            <div>${this.escapeHtml(clientName)}</div>
            ${clientMatricule ? `<div>Matricule fiscal: ${this.escapeHtml(clientMatricule)}</div>` : ''}
            ${clientAddress ? `<div>Adresse: ${this.escapeHtml(clientAddress)}</div>` : ''}
            <div class="line"></div>
            
            <table>
              <thead>
                <tr>
                  <td class="bold">ARTICLE</td>
                  <td class="bold" style="text-align:right">QTE</td>
                  <td class="bold" style="text-align:right">P.U. TTC</td>
                  <td class="bold" style="text-align:right">TOTAL</td>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
            <div class="line"></div>
            <table>
              <tr><td class="bold">Total HT</td><td style="text-align:right" class="bold">${totalHT} dt</td></tr>
              <tr><td class="bold">TVA</td><td style="text-align:right" class="bold">${totalTVA} dt</td></tr>
              <tr><td class="bold">TOTAL TTC</td><td style="text-align:right" class="bold">${totalTTC} dt</td></tr>
            </table>
            <div class="line"></div>
            <div class="center">Merci de votre confiance!</div>
          </div>
        </body>
      </html>
    `;
  }

  // Build thermal text invoice
  buildInvoiceText(invoice: any, settings: AppSettings | null): string {
    const createdAt = new Date(invoice.createdAt);
    const date = createdAt.toLocaleDateString('fr-FR');
    const time = createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let text = '';
    
    // ESC/POS commands for formatting
    const ESC = '\x1B';
    const centerAlign = ESC + '\x61\x01'; // Center alignment
    const leftAlign = ESC + '\x61\x00';   // Left alignment
    const boldOn = ESC + '\x45\x01';      // Bold on
    const boldOff = ESC + '\x45\x00';     // Bold off
    const normalSize = ESC + '\x21\x00';  // Normal size
    const monospaceFont = ESC + '\x4D\x00'; // Select font A (monospace)
    const resetFont = ESC + '\x40';       // Initialize printer (resets font)
    const noTopMargin = ESC + '\x4C\x00\x00'; // Set top margin to 0
    const noBottomMargin = ESC + '\x4E\x00\x00'; // Set bottom margin to 0
    
    // Eliminate margins and set monospace font
    text += noTopMargin + noBottomMargin + monospaceFont;
    
    // Header
    text += '==================\n';
    
    // Company name (bold and centered)
    const companyName = this.sanitizeForThermalPrinter(settings?.companyName || 'PATISSERIE MODERNE');
    text += centerAlign + boldOn + companyName + boldOff + normalSize + '\n';
    
    // Company details (centered)
    if (settings?.printSettings?.showCompanyDetails) {
      if (settings?.companyAddress) {
        text += centerAlign + this.sanitizeForThermalPrinter(settings.companyAddress) + '\n';
      }
      if (settings?.companyPhone) {
        text += centerAlign + this.sanitizeForThermalPrinter(settings.companyPhone) + '\n';
      }
    }
    
    text += leftAlign + '==================\n\n';
    
    // Invoice header
    text += centerAlign + boldOn + 'FACTURE' + boldOff + '\n';
    text += leftAlign + 'N° Facture: ' + (invoice.invoiceNumber || `FAC-${invoice.id}`) + '\n';
    text += 'Date: ' + date + '  Heure: ' + time + '\n';
    text += '--------------------------------\n\n';
    
    // Client information
    const clientName = invoice.client ? `${invoice.client.firstName || ''} ${invoice.client.lastName || ''}`.trim() : 'Client anonyme';
    const clientMatricule = invoice.client?.matriculeFiscal || '';
    const clientAddress = invoice.client?.address || '';
    
    text += boldOn + 'CLIENT:' + boldOff + '\n';
    text += this.sanitizeForThermalPrinter(clientName) + '\n';
    if (clientMatricule) {
      text += 'Matricule fiscal: ' + this.sanitizeForThermalPrinter(clientMatricule) + '\n';
    }
    if (clientAddress) {
      text += 'Adresse: ' + this.sanitizeForThermalPrinter(clientAddress) + '\n';
    }
    text += '--------------------------------\n\n';
    
    // Items
    text += boldOn + 'ARTICLES:' + boldOff + '\n';
    text += '--------------------------------\n';
    
    const lines = invoice.lines || [];
    lines.forEach((line: any) => {
      const name = this.sanitizeForThermalPrinter(line.productName || line.name || 'Produit');
      const qty = Number(line.quantity || 0).toString();
      const unitPrice = Number(line.prixVenteTTC || line.unitPrice || 0).toFixed(3);
      const total = Number(line.total || line.amount || 0).toFixed(3);
      
      // Simple formatting for thermal printer
      const nameTruncated = name.length > 20 ? name.substring(0, 17) + '...' : name;
      text += nameTruncated.padEnd(20) + qty.padStart(3) + unitPrice.padStart(8) + total.padStart(8) + '\n';
    });
    
    text += '--------------------------------\n';
    
    // Totals
    const totalHT = Number(invoice.totalHT || 0).toFixed(3);
    const totalTVA = Number(invoice.totalTVA || 0).toFixed(3);
    const totalTTC = Number(invoice.total || 0).toFixed(3);
    
    text += 'Total HT'.padEnd(20) + totalHT.padStart(19) + ' dt\n';
    text += 'TVA'.padEnd(20) + totalTVA.padStart(19) + ' dt\n';
    text += boldOn + 'TOTAL TTC'.padEnd(20) + totalTTC.padStart(19) + ' dt' + boldOff + '\n';
    
    text += '--------------------------------\n';
    text += centerAlign + 'Merci de votre confiance!' + '\n';
    text += '==================\n\n';
    
    // Cut paper
    text += '\x1D\x56\x00';
    
    return text;
  }

}
