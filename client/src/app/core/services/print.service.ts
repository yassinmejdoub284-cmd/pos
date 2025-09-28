import { Injectable } from '@angular/core';
import { ZReportData } from '../models/session.model';
import { Sale } from '../models/sale.model';
import { invoke } from '@tauri-apps/api/core';
import { SettingsService, AppSettings } from './settings.service';

@Injectable({
  providedIn: 'root'
})
export class PrintService {

  constructor(private settingsService: SettingsService) { }

  // Desktop-only printing via Tauri commands
  async printPlainText(text: string): Promise<void> {
    await invoke('print_text_direct', { text });
  }

  async printHtml(html: string): Promise<void> {
    await invoke('print_html', { html });
  }

  async printPdf(pdfBase64: string): Promise<void> {
    await invoke('print_pdf', { pdfBase64: pdfBase64 });
  }

  async printEscPos(escposData: string): Promise<void> {
    const base64 = this.toBase64(this.stringToBytes(escposData));
    await invoke('print_raw_bytes', { data_base64: base64 });
  }

  async openCashDrawer(): Promise<void> {
    await invoke('open_cash_drawer');
  }

  // Receipts and reports route to Tauri print
  printZReport(zReportData: ZReportData): void {
    const escposData = this.generateESCReport(zReportData, 'Z');
    void this.printEscPos(escposData);
  }

  printDailyExtractWithWithdrawal(dailyExtract: any, companyData?: any): void {
    const escposData = this.generateDailyExtractESC(dailyExtract, companyData);
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

  // Printers management (stubs wired to backend)
  getAvailablePrinters(): Promise<Array<{ name: string; isDefault: boolean }>> {
    return invoke('get_available_printers');
  }

  setDefaultPrinter(printerName: string): Promise<boolean> {
    return invoke<{ success: boolean; message: string }>('set_default_printer', { printer_name: printerName })
      .then(res => !!res?.success);
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



}
