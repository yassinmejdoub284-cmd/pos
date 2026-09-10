import { firstValueFrom } from 'rxjs';
import { renderReceiptHtml, renderReceiptText, encodeReceiptLogo, receiptLogoPixels } from './receipt-renderer';
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
    // Desktop mode will be determined by settings when needed
    this.isDesktop = false;
  }

  // Method to manually set desktop mode (for testing or override)
  setDesktopMode(isDesktop: boolean): void {
    this.isDesktop = isDesktop;

  }

  // Method to get current desktop mode
  getDesktopMode(): boolean {
    return this.isDesktop;
  }

  // Method to check if Tauri is receiving orders
  async checkTauriStatus(): Promise<string> {
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      if (!tauriCore || !tauriCore.invoke) {
        return 'Tauri not available';
      }
      const status = await tauriCore.invoke<string>('check_tauri_status');

      return status;
    } catch (error) {
      console.error('Failed to check Tauri status:', error);
      return 'Tauri not available';
    }
  }

  // Print methods that work in both desktop and web environments
  async printPlainText(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.settingsService.getSettings().subscribe({
        next: async (settings) => {
          if (settings?.isDesktopVersion) {

            try {
              await this.printPlainTextDesktop(text);
              resolve();
            } catch (error) {
              console.error('Tauri print failed, falling back to web print:', error);
              this.printPlainTextWeb(text);
              resolve();
            }
          } else {

            this.printPlainTextWeb(text);
            resolve();
          }
        },
        error: () => {

          this.printPlainTextWeb(text);
          resolve();
        }
      });
    });
  }

  private async printPlainTextDesktop(text: string): Promise<void> {
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      if (!tauriCore || !tauriCore.invoke) {
        throw new Error('Tauri invoke is not available');
      }
      await tauriCore.invoke('print_text_direct', { text });

    } catch (error) {
      console.error('Tauri print error:', error);
      throw error;
    }
  }

  private printPlainTextWeb(text: string): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Print</title>
            <style>
              @page {
                margin: 0;
                size: auto;
              }
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
              }
              body { 
                font-family: monospace; 
                white-space: pre-wrap; 
                margin: 0; 
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @media print {
                @page {
                  margin: 0;
                  size: auto;
                }
                body { 
                  margin: 0; 
                  padding: 0; 
                }
                * {
                  margin: 0 !important;
                  padding: 0 !important;
                }
              }
            </style>
          </head>
          <body>${text}</body>
        </html>
      `);
      printWindow.document.close();

      let hasPrinted = false;

      printWindow.onload = () => {
        setTimeout(() => {
          if (!hasPrinted) {
            printWindow.print();
            hasPrinted = true;
          }
        }, 500);
      };

      setTimeout(() => {
        if (printWindow && !printWindow.closed && !hasPrinted) {
          try {
            printWindow.print();
            hasPrinted = true;
          } catch (error) {
            console.error('Print failed:', error);
          }
        }
      }, 1000);
    }
  }

  async printHtml(html: string): Promise<void> {
    return new Promise((resolve) => {
      this.settingsService.getSettings().subscribe({
        next: async (settings) => {
          if (settings?.isDesktopVersion) {
            try {
              await this.printHtmlDesktop(html);
              resolve();
            } catch (error) {
              console.error('Tauri HTML print failed, falling back to web print:', error);
              this.printHtmlWeb(html);
              resolve();
            }
          } else {
            this.printHtmlWeb(html);
            resolve();
          }
        },
        error: () => {
          this.printHtmlWeb(html);
          resolve();
        }
      });
    });
  }

  private async printHtmlDesktop(html: string): Promise<void> {
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      if (!tauriCore || !tauriCore.invoke) {
        throw new Error('Tauri invoke is not available');
      }
      await tauriCore.invoke('print_html', { html });

    } catch (error) {
      console.error('Tauri HTML print error:', error);
      throw error;
    }
  }

  private printHtmlWeb(html: string): void {
    // Web fallback: open print dialog with HTML
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();

      let hasPrinted = false;

      // Wait for content to load before printing
      printWindow.onload = () => {
        setTimeout(() => {
          if (!hasPrinted) {
            printWindow.print();
            hasPrinted = true;
          }
        }, 500);
      };

      // Fallback: if onload doesn't fire, try after a longer delay
      setTimeout(() => {
        if (printWindow && !printWindow.closed && !hasPrinted) {
          try {
            printWindow.print();
            hasPrinted = true;
          } catch (error) {
            console.error('Print failed:', error);
          }
        }
      }, 1000);
    }
  }

  async printPdf(pdfBase64: string): Promise<void> {
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        if (settings?.isDesktopVersion) {
          this.printPdfDesktop(pdfBase64);
        } else {
          this.printPdfWeb(pdfBase64);
        }
      },
      error: () => {
        this.printPdfWeb(pdfBase64);
      }
    });
  }

  private async printPdfDesktop(pdfBase64: string): Promise<void> {
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      if (!tauriCore || !tauriCore.invoke) {
        throw new Error('Tauri invoke is not available');
      }
      await tauriCore.invoke('print_pdf', { pdfBase64: pdfBase64 });

    } catch (error) {
      console.error('Tauri PDF print error:', error);
      throw error;
    }
  }

  private printPdfWeb(pdfBase64: string): void {
    // Web fallback: download PDF
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${pdfBase64}`;
    link.download = 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async printEscPos(escposData: string): Promise<void> {
    return new Promise((resolve) => {
      this.settingsService.getSettings().subscribe({
        next: async (settings) => {
          if (settings?.isDesktopVersion) {
            try {
              await this.printEscPosDesktop(escposData);
              resolve();
            } catch (error) {
              console.error('Tauri ESC/POS print failed, falling back to web print:', error);
              await this.printEscPosWeb(escposData);
              resolve();
            }
          } else {
            await this.printEscPosWeb(escposData);
            resolve();
          }
        },
        error: async () => {
          await this.printEscPosWeb(escposData);
          resolve();
        }
      });
    });
  }

  private async printEscPosDesktop(escposData: string): Promise<void> {
    try {
      const readableText = this.convertEscPosToReadable(escposData);
      await this.printPlainTextDesktop(readableText);
    } catch (error) {
      console.error('Tauri ESC/POS print error:', error);
      throw error;
    }
  }

  private async printEscPosWeb(escposData: string): Promise<void> {
    // Web fallback: convert ESC/POS to readable format and print
    const readableText = this.convertEscPosToReadable(escposData);
    this.printPlainTextWeb(readableText);
  }

  async openCashDrawer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.settingsService.getSettings().subscribe({
        next: async (settings) => {
          if (settings?.isDesktopVersion) {
            try {
              await this.openCashDrawerDesktop();
              resolve();
            } catch (error) {
              console.error('Desktop cash drawer failed, trying web fallback:', error);
              this.openCashDrawerWebPrinter();
              resolve();
            }
          } else {
            this.openCashDrawerWebPrinter();
            resolve();
          }
        },
        error: () => {
          this.openCashDrawerWebPrinter();
          resolve();
        }
      });
    });
  }


  private async openCashDrawerDesktop(): Promise<void> {
    try {
      const cashDrawerCommand = '\x1B\x70\x00\x19\xFA';
      await this.printPlainTextDesktop(cashDrawerCommand);
    } catch (error) {
      throw error;
    }
  }

  private openCashDrawerWebPrinter(): void {
    // In web mode, we cannot actually open the cash drawer via ESC/POS commands
    // Opening a print window would just show a blank tab, so we skip it
    // The cash drawer can only be opened in desktop/Tauri mode
  }


  printZReport(zReportData: ZReportData): void {
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        const escposData = this.generateESCReport(zReportData, 'Z', settings);
        void this.printEscPos(escposData);
      },
      error: () => {
        const escposData = this.generateESCReport(zReportData, 'Z', null);
        void this.printEscPos(escposData);
      }
    });
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

  printDetailedSessionReportWithFamilyGrouping(sessionReport: any, companyData?: any): void {
    const escposData = this.generateDailyExtractESCWithFamilyGrouping(sessionReport, companyData, 0);
    void this.printEscPos(escposData);
  }

  printDetailedSessionReportWithArticleGrouping(sessionReport: any, companyData?: any): void {
    const htmlData = this.generateDailyExtractHTMLWithFamilyGrouping(sessionReport, companyData, 0);
    this.printHtml(htmlData);
  }

  printDetailedSessionReportWithArticleGrouping80mm(sessionReport: any, companyData?: any): void {
    const htmlData = this.generateDailyExtractHTMLWithFamilyGrouping80mm(sessionReport, companyData, 0);
    this.printHtml(htmlData);
  }

  printDetailedSessionReportWithFamilyGrouping80mm(sessionReport: any, companyData?: any): void {
    const htmlData = this.generateDailyExtractHTMLWithFamilyGrouping80mm(sessionReport, companyData, 0);
    this.printHtml(htmlData);
  }

  printXReport(xReportData: ZReportData): void {
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        const escposData = this.generateESCReport(xReportData, 'X', settings);
        void this.printEscPos(escposData);
      },
      error: () => {
        const escposData = this.generateESCReport(xReportData, 'X', null);
        void this.printEscPos(escposData);
      }
    });
  }

  async printSaleReceipt(sale: Sale, options?: { openPreviewOnly?: boolean }): Promise<void> {
    // Reserve the preview during the click so browser popup blockers do not discard it.
    const preview = options?.openPreviewOnly ? window.open('', '_blank', 'width=440,height=800') : null;
    try {
      const settings = await firstValueFrom(this.settingsService.getSettings());
      const doublePrint = settings.printSettings?.doubleImpression !== false;
      if (options?.openPreviewOnly) {
        if (!preview) throw new Error('Veuillez autoriser les fenêtres de ticket');
        this.printReceiptInBrowser(sale, settings, doublePrint, preview, true);
        return;
      }
      if (settings.isDesktopVersion && '__TAURI_INTERNALS__' in window) {
        const logoDataBase64 = await this.receiptLogo(settings);
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('print_text_direct', { text: this.buildSaleReceiptText(sale, settings), logoDataBase64 });
        // Await the second job: a failure must not silently reprint the client ticket.
        if (doublePrint) await this.printPlainTextDesktop(this.buildKitchenTicketText(sale, settings));
      } else this.printReceiptInBrowser(sale, settings, doublePrint);
    } catch (error) {
      if (preview) preview.close();
      console.error('Impression du ticket impossible:', error);
      throw error;
    }
  }

  // Print invoice (different from regular receipt)
  printInvoice(invoice: any, options?: { openPreviewOnly?: boolean }): void {
    this.settingsService.getSettings().subscribe({
      next: async (settings) => {
        // Check if desktop version is enabled
        if (settings?.isDesktopVersion) {
          // Use Tauri direct printing with text format
          const text = this.buildInvoiceText(invoice, settings);
          try {
            await this.printPlainTextDesktop(text);
          } catch (error) {
            console.error('Tauri print failed, falling back to web print:', error);
            this.printInvoiceInBrowser(invoice, settings);
          }
        } else {
          // Use browser window printing with HTML format
          this.printInvoiceInBrowser(invoice, settings);
        }
      },
      error: () => {
        // Fallback to default settings if error
        const text = this.buildInvoiceText(invoice, null);
        this.printPlainTextWeb(text);
      }
    });
  }

  // Printers management (stubs wired to backend)
  async getAvailablePrinters(): Promise<Array<{ name: string; isDefault: boolean }>> {
    return new Promise((resolve) => {
      this.settingsService.getSettings().subscribe({
        next: (settings) => {
          if (settings?.isDesktopVersion) {
            this.getAvailablePrintersDesktop().then(resolve).catch(() => resolve([]));
          } else {
            resolve([]);
          }
        },
        error: () => resolve([])
      });
    });
  }

  private async getAvailablePrintersDesktop(): Promise<Array<{ name: string; isDefault: boolean }>> {
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      if (!tauriCore || !tauriCore.invoke) {
        throw new Error('Tauri invoke is not available');
      }
      return tauriCore.invoke('get_available_printers');
    } catch (error) {
      console.error('Tauri get printers failed:', error);
      return [];
    }
  }

  async setDefaultPrinter(printerName: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.settingsService.getSettings().subscribe({
        next: (settings) => {
          if (settings?.isDesktopVersion) {
            this.setDefaultPrinterDesktop(printerName).then(resolve).catch(() => resolve(false));
          } else {
            resolve(false);
          }
        },
        error: () => resolve(false)
      });
    });
  }

  private async setDefaultPrinterDesktop(printerName: string): Promise<boolean> {
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      if (!tauriCore || !tauriCore.invoke) {
        throw new Error('Tauri invoke is not available');
      }
      const res = await tauriCore.invoke<{ success: boolean; message: string }>('set_default_printer', { printer_name: printerName });
      return !!res?.success;
    } catch (error) {
      console.error('Tauri set printer failed:', error);
      return false;
    }
  }

  // One document, with a page break before the optional kitchen copy.
  private printReceiptInBrowser(sale: Sale, settings?: AppSettings | null, doublePrint = false, existingWindow?: Window, previewOnly = false): void {
    const printWindow = existingWindow || window.open('', '_blank', 'width=440,height=800');
    if (!printWindow) throw new Error('Veuillez autoriser les fenêtres de ticket');
    const html = doublePrint ? this.buildReceiptPreviewHtml(sale, settings) : this.buildSaleReceiptHtml(sale, settings);
    printWindow.document.write(html);
    printWindow.document.close();
    if (previewOnly) {
      const button = printWindow.document.createElement('button');
      button.textContent = 'Imprimer ce ticket';
      button.className = 'no-print';
      button.onclick = () => printWindow.print();
      printWindow.document.body.prepend(button);
    } else {
      void Promise.all(Array.from(printWindow.document.images).map(img => img.decode().catch(() => undefined)))
        .then(() => { if (!printWindow.closed) printWindow.print(); });
    }
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

  private generateESCReport(reportData: ZReportData, type: 'X' | 'Z', settings?: AppSettings | null): string {
    const { session, summary, closureData } = reportData;

    let escpos = '';

    escpos += '\x1B\x40';

    escpos += '\x1B\x21\x00';
    escpos += '\x1B\x61\x01';

    escpos += '==================\n';
    escpos += 'RAPPORT ' + type + '\n';
    escpos += '==================\n\n';

    // Use companyData if available (passed from method args if any, but generateESCReport sig uses settings)
    // Actually generateESCReport only takes settings. Let's rely on settings first.
    // However, the caller usually passes settings. If settings has companyName, use it.
    const companyName = settings?.companyName || 'Samurai Food';
    const companyAddress = settings?.companyAddress || '';
    const companyPhone = settings?.companyPhone || '';

    escpos += this.sanitizeForThermalPrinter(companyName) + '\n';
    if (companyAddress) escpos += this.sanitizeForThermalPrinter(companyAddress) + '\n';
    if (companyPhone) escpos += this.sanitizeForThermalPrinter(companyPhone) + '\n';
    escpos += '\n';

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
        escpos += method + ': ' + this.formatCurrency(data.amount) + ' DT\n';
        escpos += '  (' + data.count + ' tickets)\n';
      });
    }

    escpos += '\n';
    escpos += 'Total Ventes: ' + this.formatCurrency(summary.totalSales) + ' DT\n';
    escpos += 'Nombre Tickets: ' + summary.totalTickets + '\n\n';

    // Cash movements
    if (session.cashMovements && session.cashMovements.length > 0) {
      escpos += 'MOUVEMENTS CAISSE\n';
      escpos += '=================\n';

      session.cashMovements.forEach(movement => {
        escpos += this.getCashMovementTypeLabel(movement.type) + ': ' + this.formatCurrency(movement.amount) + ' DT\n';
        escpos += '  ' + movement.reason + '\n';
        escpos += '  ' + this.formatDateTime(movement.createdAt) + '\n\n';
      });
    }

    // Cash counting
    escpos += 'COMPTAGE ESPÈCES\n';
    escpos += '================\n';
    escpos += 'Fonds de caisse: ' + this.formatCurrency(session.openingFund) + ' DT\n';
    escpos += 'Espèces attendues: ' + this.formatCurrency(summary.expectedCash) + ' DT\n';

    if (session.countedCash) {
      escpos += 'Espèces comptées: ' + this.formatCurrency(session.countedCash) + ' DT\n';
      escpos += 'Écart: ' + this.formatCurrency(session.variance || 0) + ' DT\n';

      if (session.variance && session.variance !== 0) {
        escpos += '\n';
        if (session.variance > 0) {
          escpos += 'SURPLUS: ' + this.formatCurrency(session.variance) + ' DT\n';
        } else {
          escpos += 'MANQUE: ' + this.formatCurrency(Math.abs(session.variance)) + ' DT\n';
        }
      }
    }

    escpos += '\n';

    // Closing info
    if (session.closedAt) {
      escpos += 'Fonds pour prochaine session: ' + this.formatCurrency(session.openingFund) + ' DT\n';

      // Withdrawal information (only for Z reports with closure data)
      if (type === 'Z' && closureData) {
        if (closureData.withdrawalAmount > 0) {
          escpos += 'Retrait vers Caisse Centrale: ' + this.formatCurrency(closureData.withdrawalAmount) + ' DT\n';
          escpos += 'Solde restant en caisse: ' + this.formatCurrency(closureData.remainingBalance) + ' DT\n';
        }
      }

      // Calculate deposit amount
      const depositAmount = (session.countedCash || 0) - (session.openingFund || 0);
      if (depositAmount > 0) {
        escpos += 'Montant à déposer: ' + this.formatCurrency(depositAmount) + ' DT\n';
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
    escpos += 'Extr. Journalière - ' + closingTime + '\n';

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
    // Use session sales but exclude cancelled/refunded to prevent printing annulé/remboursé items
    const sales: any[] = ((sessionReport?.session?.sales || []) as any[])
      .filter(s => {
        const st = String(s?.status || '').toUpperCase();
        return st !== 'CANCELLED' && st !== 'REFUNDED';
      });
    const familyToProducts: Record<string, { name: string; quantity: number; revenue: number }[]> = {};
    const normalizeFamily = (name: any): string => (name ?? '').toString().trim();



    if (sales.length) {
      const tempMap: Record<string, Record<string, { name: string; quantity: number; revenue: number }>> = {};
      for (const sale of sales) {
        const items: any[] = (sale.items || []) as any[];

        for (const it of items) {

          const famCandidate = it.product?.famille?.name || it.product?.family?.name || it.familyName || it.categoryName || it.family || '';
          const fam = normalizeFamily(famCandidate);
          const familyName = fam && fam.length ? fam : 'AUTRES';
          const productName: string = (it.productName || it.name || 'Produit').toString();
          const qty: number = Math.round(parseFloat(String(it.quantity ?? it.qty ?? 0)) || 0);
          const lineTotal: number = Math.round((parseFloat(String(it.total ?? it.revenue ?? it.amount ?? 0)) || 0) * 1000) / 1000;

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

    }

    if (sessionReport.families && sessionReport.families.length > 0) {
      sessionReport.families.forEach((family: any) => {
        const famName: string = normalizeFamily(family.name || 'AUTRES');
        const familyTotal = Number(family.totalRevenue || family.total || family.amount || family.amountTTC || 0)
          || (familyToProducts[famName]?.reduce((s, p) => s + p.revenue, 0) || 0);
        const amount = this.formatCurrency(familyTotal);
        const totalWidth = 30; // Total line width
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
          const totalWidth = 30; // Total line width
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

    escpos += '-------------------------------\n';
    const totalAmount = this.formatCurrency(totalFamilySales);
    const totalWidth = 30;
    const usedSpace = 'TOTAL:'.length + totalAmount.length;
    const dots = '.'.repeat(Math.max(1, totalWidth - usedSpace));
    escpos += 'TOTAL:' + dots + totalAmount + '\n';

    // Calculate total discounts (remise) from all sales
    const totalDiscount = sales.reduce((sum: number, sale: any) => {
      const discount = parseFloat(sale.discount || 0) || 0;
      return sum + discount;
    }, 0);

    if (totalDiscount > 0) {
      const discountAmount = this.formatCurrency(totalDiscount);
      const discountUsedSpace = 'Total remise:'.length + discountAmount.length;
      const discountDots = '.'.repeat(Math.max(1, totalWidth - discountUsedSpace));
      escpos += 'Total remise:' + discountDots + discountAmount + '\n';
    }

    escpos += '\n';

    // Show cancelled tickets section
    const allSales: any[] = sessionReport?.session?.sales || [];
    const cancelledTickets = allSales.filter((s: any) => {
      const status = String(s?.status || '').toUpperCase();
      return status === 'CANCELLED';
    });

    if (cancelledTickets.length > 0) {
      escpos += '================================\n';
      escpos += '      TICKETS ANNULÉS\n';
      escpos += '================================\n';

      let totalCancelledAmount = 0;
      cancelledTickets.forEach((ticket: any) => {
        const ticketNumber = ticket.dailyTicketNumber || ticket.sessionTicketNumber || ticket.ticketNumber || ticket.id;
        const ticketAmount = parseFloat(ticket.finalTotal || ticket.total || 0) || 0;
        totalCancelledAmount += ticketAmount;

        const ticketLabel = `Ticket #${ticketNumber}:`;
        const amountStr = this.formatCurrency(ticketAmount);
        const labelWidth = ticketLabel.length;
        const spacesNeeded = Math.max(1, totalWidth - labelWidth - amountStr.length);
        const spaces = ' '.repeat(spacesNeeded);
        escpos += ticketLabel + spaces + amountStr + '\n';
      });

      escpos += '-------------------------------\n';
      const cancelledTotalStr = this.formatCurrency(totalCancelledAmount);
      const cancelledTotalUsedSpace = 'Total annulé:'.length + cancelledTotalStr.length;
      const cancelledTotalDots = '.'.repeat(Math.max(1, totalWidth - cancelledTotalUsedSpace));
      escpos += 'Total annulé:' + cancelledTotalDots + cancelledTotalStr + '\n';
      escpos += '\n';
    }

    // Sales summary by payment method removed per request

    // Cash movements section removed per request

    // Financial summary
    escpos += '################################\n';
    escpos += '        RÉSUMÉ FINANCIER\n';
    escpos += '################################\n';

    const expectedCash = summary.expectedCash || 0;
    const totalSales = summary.totalSales || 0;
    const financialOpeningFund = session.openingFund || 0;

    const financialTotalWidth = 32; // Increased width for better alignment
    const dtColumnPosition = 28; // Fixed position for DT column

    const formatFinancialLine = (label: string, amount: number) => {
      const amountStr = this.formatCurrency(amount);
      // Calculate spaces needed to align DT at fixed column position
      const labelWidth = label.length;
      const spacesNeeded = Math.max(1, dtColumnPosition - labelWidth - amountStr.length);
      const spaces = ' '.repeat(spacesNeeded);
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
      // Calculate cash from sales using paidAmount from each sale (more accurate)
      // This matches the server calculation which uses paidAmount for each sale
      const sales: any[] = (sessionReport?.session?.sales || []) as any[];
      const cashFromSales = sales
        .filter(s => {
          const status = (s.status || '').toUpperCase();
          return status !== 'CANCELLED' && status !== 'REFUNDED';
        })
        .reduce((sum: number, sale: any) => {
          // Use paidAmount if available (includes advance payments from credit sales)
          // Otherwise use finalTotal for cash sales
          const paidAmount = parseFloat(sale.paidAmount ?? sale.finalTotal ?? 0) || 0;
          return sum + paidAmount;
        }, 0);
      return cashFromSales;
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

    // Add admin correction calculation
    const getAdminCorrections = () => {
      const movements = session.cashMovements || [];
      return movements
        .filter((m: any) => m.type === 'ENTREE' &&
          (m.reason || '').toLowerCase().includes('correction admin'))
        .reduce((sum: number, m: any) => sum + (parseFloat(m.amount || 0) || 0), 0);
    };

    // Add balance adjustment calculation
    const getBalanceAdjustments = () => {
      const movements = session.cashMovements || [];
      return movements
        .filter((m: any) => (m.reason || '').toLowerCase().includes('ajustement solde'))
        .reduce((sum: number, m: any) => {
          const amount = parseFloat(m.amount || 0) || 0;
          // For SORTIE movements, subtract the amount; for ENTREE, add it
          return sum + (m.type === 'ENTREE' ? amount : -amount);
        }, 0);
    };

    const adminCorrections = getAdminCorrections();
    const balanceAdjustments = getBalanceAdjustments();

    const actualEntries = getClientPaymentsTotal() + getTotalOrderAdvances() + getCashFromSalesNetOfCredit() + getFundingsTotal() + adminCorrections + (balanceAdjustments > 0 ? balanceAdjustments : 0);
    const actualExits = summary.sortie || 0 + (balanceAdjustments < 0 ? Math.abs(balanceAdjustments) : 0);

    escpos += formatFinancialLine('Fonds initial:', financialOpeningFund) + '\n';
    if (adminCorrections > 0) {
      escpos += formatFinancialLine('Correction admin:', adminCorrections) + '\n';
    }
    if (balanceAdjustments !== 0) {
      escpos += formatFinancialLine('Ajustement solde:', balanceAdjustments) + '\n';
    }

    escpos += formatFinancialLine('Enc. client:', getClientPaymentsTotal()) + '\n';
    escpos += formatFinancialLine('Acomptes sur Cmd.:', getTotalOrderAdvances()) + '\n';
    escpos += formatFinancialLine('Alim. de caisse:', getFundingsTotal()) + '\n';
    // Espèces en caisse: total encaissement (sum of all encaissement items)
    const totalEncaissement = getClientPaymentsTotal() + getTotalOrderAdvances() + getFundingsTotal() + getCashFromSalesNetOfCredit();
    escpos += formatFinancialLine('Espèces en caisse:', totalEncaissement) + '\n';

    // Calculate detailed décaissements
    const getExpensesTotal = () => {
      // First try to use server-provided expensesTotal from summary (most accurate)
      const summaryExpensesTotal = parseFloat((summary as any)?.expensesTotal || 0) || 0;
      if (summaryExpensesTotal > 0) {
        return summaryExpensesTotal;
      }

      // Fallback: calculate from expensesDetails if available
      const expensesDetails = (summary as any)?.expensesDetails || [];
      if (expensesDetails.length > 0) {
        return expensesDetails.reduce((sum: number, e: any) => {
          const amount = parseFloat(e.amount || 0) || 0;
          return sum + amount;
        }, 0);
      }

      // Final fallback: calculate from cash movements that are specifically expenses
      const movements = session.cashMovements || [];
      return movements
        .filter((m: any) => {
          const reasonLower = (m.reason || '').toLowerCase();
          return m.type === 'SORTIE' &&
            (reasonLower.includes('dépense') || reasonLower.includes('depense')) &&
            !reasonLower.includes('fournisseur') &&
            !reasonLower.includes('supplier') &&
            !reasonLower.includes('remboursement') &&
            !reasonLower.includes('bon de retour');
        })
        .reduce((sum: number, m: any) => sum + (parseFloat(m.amount || 0) || 0), 0);
    };

    // Get cancelled ticket IDs
    const getCancelledTicketIds = () => {
      const allSales: any[] = sessionReport?.session?.sales || [];
      return new Set(
        allSales
          .filter((s: any) => {
            const status = String(s?.status || '').toUpperCase();
            return status === 'CANCELLED';
          })
          .map((s: any) => s.id)
      );
    };

    // Calculate canceled ticket refunds from actual cash movements
    // Only count SORTIE movements linked to canceled tickets or with "Ticket annulé" in reason
    const getCanceledTicketRefunds = () => {
      const movements = session.cashMovements || [];
      const cancelledTicketIds = getCancelledTicketIds();

      return movements
        .filter((m: any) => {
          const reason = String(m.reason || '').toLowerCase();
          const isRejected = String(m.reason || '').includes('[REJETÉ]');
          const isDeleted = String(m.reason || '').includes('[SUPPRIMÉ]');
          const isFromCancelledTicket = m.ticketId && cancelledTicketIds.has(m.ticketId);
          const isCancellationRefund = reason.includes('ticket annulé') || reason.includes('ticket annule');

          return m.type === 'SORTIE' &&
            !isRejected &&
            !isDeleted &&
            (isFromCancelledTicket || isCancellationRefund) &&
            parseFloat(m.amount || 0) > 0;
        })
        .reduce((sum: number, m: any) => sum + (parseFloat(m.amount || 0) || 0), 0);
    };

    // Calculate return refunds (bon de retour - product returns)
    const getReturnRefunds = () => {
      const movements = session.cashMovements || [];
      const cancelledTicketIds = getCancelledTicketIds();

      return movements
        .filter((m: any) => {
          const reason = String(m.reason || '').toLowerCase();
          const isRejected = String(m.reason || '').includes('[REJETÉ]');
          const isDeleted = String(m.reason || '').includes('[SUPPRIMÉ]');
          const isFromCancelledTicket = m.ticketId && cancelledTicketIds.has(m.ticketId);
          const isReturnRefund = reason.includes('remboursement retour') ||
            reason.includes('bon de retour') ||
            reason.includes('retour');
          const isCancellationRefund = reason.includes('ticket annulé') || reason.includes('ticket annule');

          // Return refunds are separate from ticket cancellation refunds
          return m.type === 'SORTIE' &&
            !isRejected &&
            !isDeleted &&
            !isFromCancelledTicket &&
            !isCancellationRefund &&
            isReturnRefund &&
            parseFloat(m.amount || 0) > 0;
        })
        .reduce((sum: number, m: any) => sum + (parseFloat(m.amount || 0) || 0), 0);
    };

    const getSupplierPayments = () => {
      const movements = session.cashMovements || [];
      return movements
        .filter((m: any) => m.type === 'SORTIE' &&
          ((m.reason || '').toLowerCase().includes('fournisseur') ||
            (m.reason || '').toLowerCase().includes('supplier')));
    };

    // Show expenses with supplier name or notes (no category name)
    escpos += 'Dépense:\n';
    const expensesDetails = (summary as any)?.expensesDetails || [];
    if (expensesDetails.length > 0) {
      expensesDetails.forEach((expense: any) => {
        const amount = parseFloat(expense.amount || 0) || 0;
        const notes = expense.notes || '';
        const supplierName = expense.supplierName || '';

        // Format: SUPPLIERNAME (notes): amount aligned to DT column
        let expenseLabel = ' ';
        if (supplierName) {
          expenseLabel += supplierName.toUpperCase();
          if (notes) {
            expenseLabel += ` (${notes})`;
          }
        } else if (notes) {
          expenseLabel += notes;
        } else {
          expenseLabel += 'Dépense';
        }
        expenseLabel += ':';
        const amountStr = this.formatCurrency(amount);
        const labelWidth = expenseLabel.length;
        const spacesNeeded = Math.max(1, dtColumnPosition - labelWidth - amountStr.length);
        const spaces = ' '.repeat(spacesNeeded);
        escpos += expenseLabel + spaces + amountStr + '\n';
      });
    } else {
      // Use getExpensesTotal() which now prioritizes summary.expensesTotal
      const expensesTotal = getExpensesTotal();
      if (expensesTotal > 0) {
        const amountStr = this.formatCurrency(expensesTotal);
        const labelWidth = 1; // Just the space
        const spacesNeeded = Math.max(1, dtColumnPosition - labelWidth - amountStr.length);
        const spaces = ' '.repeat(spacesNeeded);
        escpos += ' ' + spaces + amountStr + '\n';
      }
    }

    // Show canceled ticket refunds and return refunds combined as "Annulation ticket"
    // Only count actual cash refund movements (real data from cash movements)
    const canceledTicketRefunds = getCanceledTicketRefunds();
    const returnRefunds = getReturnRefunds();
    const totalAnnulation = canceledTicketRefunds + returnRefunds;
    if (totalAnnulation > 0) {
      escpos += formatFinancialLine('Annulation ticket:', totalAnnulation) + '\n';
    }

    // Show supplier payments section
    escpos += 'Règlement fournisseur:\n';
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

        // Format: SUPPLIERNAME: amount aligned to DT column
        let supplierLabel = ' ';
        if (supplierName && supplierName !== 'Fournisseur') {
          supplierLabel += supplierName.toUpperCase();
        } else {
          supplierLabel += 'Fournisseur';
        }
        supplierLabel += ':';
        const amountStr = this.formatCurrency(amount);
        const labelWidth = supplierLabel.length;
        const spacesNeeded = Math.max(1, dtColumnPosition - labelWidth - amountStr.length);
        const spaces = ' '.repeat(spacesNeeded);
        escpos += supplierLabel + spaces + amountStr + '\n';
      });
    } else {
      // Show total if no individual payments but total exists
      const supplierPaymentsTotal = Array.isArray(supplierDetails) && supplierDetails.length > 0
        ? supplierDetails.reduce((sum: number, p: any) => sum + (parseFloat(p.amount || 0) || 0), 0)
        : 0;

      if (supplierPaymentsTotal > 0) {
        const amountStr = this.formatCurrency(supplierPaymentsTotal);
        const labelWidth = 1; // Just the space
        const spacesNeeded = Math.max(1, dtColumnPosition - labelWidth - amountStr.length);
        const spaces = ' '.repeat(spacesNeeded);
        escpos += ' ' + spaces + amountStr + '\n';
      }
    }
    escpos += '-------------------------------\n';
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

  buildSaleReceiptHtml(sale: Sale, settings?: AppSettings | null): string {
    return renderReceiptHtml(sale, settings, this.settingsService.getAbsoluteLogoUrl(settings?.logoUrl));
  }

  buildKitchenTicketHtml(sale: Sale, settings?: AppSettings | null): string {
    return renderReceiptHtml(sale, settings, '', true);
  }

  buildSaleReceiptText(sale: Sale, settings: AppSettings | null): string {
    let text = renderReceiptText(sale, settings);
    if (settings?.devicesConfig?.enableDrawer !== false && sale.paymentMethod?.type === 'CASH') {
      text += '\x1b\x70\x00\x19\xfa';
    }
    return text;
  }

  buildKitchenTicketText(sale: Sale, settings: AppSettings | null): string {
    return renderReceiptText(sale, settings, true);
  }

  buildReceiptPreviewHtml(sale: Sale, settings?: AppSettings | null): string {
    const html = this.buildSaleReceiptHtml(sale, settings);
    if (settings?.printSettings?.doubleImpression === false) return html;
    const kitchen = this.buildKitchenTicketHtml(sale, settings).match(/<article[\s\S]*<\/article>/)?.[0] || '';
    return html.replace('</body>', kitchen + '</body>');
  }

  private async receiptLogo(settings: AppSettings): Promise<string | null> {
    if (settings.printSettings?.showLogo === false || !settings.logoUrl) return null;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Chargement du logo impossible')), 10000);
      img.onload = () => { clearTimeout(timeout); resolve(); };
      img.onerror = () => { clearTimeout(timeout); reject(new Error('Chargement du logo impossible')); };
      img.src = this.settingsService.getAbsoluteLogoUrl(settings.logoUrl);
    });
    const size = receiptLogoPixels[settings.printSettings?.logoSize || 'medium'];
    const ratio = size / Math.max(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Conversion du logo indisponible');
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return this.toBase64(encodeReceiptLogo(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height));
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
    return (isNaN(numAmount) ? 0 : numAmount).toFixed(3) + ' DT';
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

  // Get status text for printing
  private getStatusTextForPrint(status: string): string {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return 'Terminé';
      case 'TEMPORARY':
        return 'Temporaire';
      case 'PENDING':
        return 'En attente';
      case 'CANCELLED':
        return 'Annulé';
      case 'REFUNDED':
        return 'Remboursé';
      case 'PENDING_ADMIN':
        return 'En attente admin';
      case 'CADEAU':
        return 'Cadeau';
      default:
        return 'Terminé';
    }
  }

  // Get payment type text for printing
  private getPaymentTypeTextForPrint(paymentType: string, status?: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'CADEAU') {
      return 'CADEAU';
    }

    switch (paymentType.toUpperCase()) {
      case 'COMPTANT':
        return 'Comptant';
      case 'CREDIT':
        return 'Crédit';
      default:
        return 'Comptant';
    }
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

    let hasPrinted = false;

    // Wait for content to load, then print - but don't auto-close
    printWindow.onload = () => {
      // Give more time for content to render, especially on tablets
      setTimeout(() => {
        if (!hasPrinted) {
          printWindow.print();
          hasPrinted = true;
        }
      }, 500);
    };

    // Fallback: if onload doesn't fire, try after a longer delay
    setTimeout(() => {
      if (printWindow && !printWindow.closed && !hasPrinted) {
        try {
          printWindow.print();
          hasPrinted = true;
        } catch (error) {
          console.error('Print failed:', error);
        }
      }
    }, 1000);
  }

  // Build HTML invoice for browser printing
  buildInvoiceHtml(invoice: any, settings?: AppSettings | null): string {
    const createdAt = new Date(invoice.createdAt);
    const date = createdAt.toLocaleDateString('fr-FR');
    const time = createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const lines = invoice.lines || [];
    let calculatedSubtotalHTVA = 0;
    let calculatedTotalTVA = 0;
    let calculatedTotalTTC = 0;

    const itemsRows = lines.map((line: any) => {
      const name = line.productName || line.name || 'Produit';
      const qty = Number(line.quantity || 0);
      let unitPriceTTC = Number(line.prixVenteTTC || line.unitPrice || 0);
      let tvaPercent = Number(line.tvaPercent || 0);

      // Get TVA from product if not in line
      if (tvaPercent === 0 || !tvaPercent) {
        if (line.product?.tva) {
          tvaPercent = Number(line.product.tva);
        } else if (line.product?.tvaPercent) {
          tvaPercent = Number(line.product.tvaPercent);
        } else {
          // Default to 19% if no TVA info found
          tvaPercent = 19;
        }
      }

      // Calculate HTVA and TVA if not provided
      let prixVenteHTVA = Number(line.prixVenteHTVA || 0);
      let montantTVA = Number(line.montantTVA || 0);

      // Always recalculate if we have TTC price and TVA percentage
      if (unitPriceTTC > 0 && tvaPercent > 0) {
        if (prixVenteHTVA === 0 || !prixVenteHTVA) {
          // Calculate HTVA from TTC: HTVA = TTC / (1 + TVA%)
          prixVenteHTVA = unitPriceTTC / (1 + tvaPercent / 100);
        }
        // Always recalculate TVA amount
        montantTVA = unitPriceTTC - prixVenteHTVA;
      } else if (prixVenteHTVA > 0 && montantTVA === 0) {
        // If we have HTVA but no TTC, calculate TTC and TVA
        if (tvaPercent > 0) {
          unitPriceTTC = prixVenteHTVA * (1 + tvaPercent / 100);
          montantTVA = unitPriceTTC - prixVenteHTVA;
        } else {
          montantTVA = 0;
        }
      } else if (unitPriceTTC > 0 && (tvaPercent === 0 || !tvaPercent)) {
        // If no TVA info, assume HTVA = TTC (0% VAT)
        prixVenteHTVA = unitPriceTTC;
        montantTVA = 0;
      }

      const sousTotalTTC = Number(line.sousTotalTTC || (qty * unitPriceTTC) || 0);

      // Calculate totals from line
      calculatedSubtotalHTVA += qty * prixVenteHTVA;
      calculatedTotalTVA += qty * montantTVA;
      calculatedTotalTTC += sousTotalTTC;

      return `
        <tr>
          <td class="name">${this.escapeHtml(name)}</td>
          <td class="qty">${qty}</td>
          <td class="price">${unitPriceTTC.toFixed(3)}</td>
          <td class="total">${sousTotalTTC.toFixed(3)}</td>
        </tr>
      `;
    }).join('');

    // Totals - use invoice totals if available, otherwise calculate from lines
    const totalHT = Number(invoice.subtotalHTVA || calculatedSubtotalHTVA || 0).toFixed(3);
    const totalTVA = Number(invoice.totalTVA || calculatedTotalTVA || 0).toFixed(3);
    const totalTTC = Number(invoice.totalTTC || calculatedTotalTTC || 0).toFixed(3);

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

    const companyName = settings?.companyName || 'Samurai Food';
    const companyAddress = settings?.companyAddress || '';
    const companyPhone = settings?.companyPhone || '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Facture ${invoice.invoiceNumber || invoice.id}</title>
          <style>
            @page { margin: 0 !important; }
            body { 
              font-family: 'Courier New', monospace; 
              margin: 0; 
              padding: 8px; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
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
            @media print {
              body { margin: 0; padding: 4px; }
              .ticket { width: 100%; }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            ${logoHtml}
            <div class="center bold" style="margin-bottom: 8px;">${this.escapeHtml(companyName)}</div>
            ${settings?.companyAddress ? `<div class="center muted" style="margin-bottom: 4px;">${this.escapeHtml(settings.companyAddress)}</div>` : ''}
            ${settings?.companyRC ? `<div class="center muted" style="margin-bottom: 4px;">R.C: ${this.escapeHtml(settings.companyRC)}</div>` : ''}
            ${settings?.companyMF ? `<div class="center muted" style="margin-bottom: 4px;">M.F: ${this.escapeHtml(settings.companyMF)}</div>` : ''}
            ${settings?.companyPhone ? `<div class="center muted" style="margin-bottom: 4px;">Tel: ${this.escapeHtml(settings.companyPhone)}</div>` : ''}
            ${settings?.companyEmail ? `<div class="center muted" style="margin-bottom: 4px;">${this.escapeHtml(settings.companyEmail)}</div>` : ''}
            <div class="double-line" style="margin-top: 8px;"></div>
            
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

    // Company name (double bold and centered)
    // Company name (double bold and centered)
    const resolvedCompanyName = settings?.companyName || 'Samurai Food';
    text += centerAlign + boldOn + boldOn + this.sanitizeForThermalPrinter(resolvedCompanyName) + boldOff + boldOff + normalSize + '\n';
    text += '\n'; // Add spacing after company name

    // Company details (centered) - always show on invoices
    if (settings?.companyAddress) {
      text += centerAlign + this.sanitizeForThermalPrinter(settings.companyAddress) + '\n';
    }
    if (settings?.companyRC) {
      text += centerAlign + 'R.C: ' + this.sanitizeForThermalPrinter(settings.companyRC) + '\n';
    }
    if (settings?.companyMF) {
      text += centerAlign + 'M.F: ' + this.sanitizeForThermalPrinter(settings.companyMF) + '\n';
    }
    if (settings?.companyPhone) {
      text += centerAlign + 'Tel: ' + this.sanitizeForThermalPrinter(settings.companyPhone) + '\n';
    }
    if (settings?.companyEmail) {
      text += centerAlign + this.sanitizeForThermalPrinter(settings.companyEmail) + '\n';
    }

    text += '\n'; // Add spacing before separator
    text += leftAlign + '==================\n\n';

    // Invoice header
    text += centerAlign + boldOn + 'FACTURE' + boldOff + '\n';
    text += leftAlign + 'N° Facture: ' + (invoice.invoiceNumber || `FAC-${invoice.id}`) + '\n';
    text += 'Date: ' + date + '  Heure: ' + time + '\n';
    text += '-------------------------------\n\n';

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
    text += '-------------------------------\n\n';

    // Items
    text += boldOn + 'ARTICLES:' + boldOff + '\n';
    text += '-------------------------------\n';

    const lines = invoice.lines || [];
    let calculatedSubtotalHTVA = 0;
    let calculatedTotalTVA = 0;
    let calculatedTotalTTC = 0;

    lines.forEach((line: any) => {
      const name = this.sanitizeForThermalPrinter(line.productName || line.name || 'Produit');
      const qty = Number(line.quantity || 0);
      let unitPriceTTC = Number(line.prixVenteTTC || line.unitPrice || 0);
      let tvaPercent = Number(line.tvaPercent || 0);

      // Get TVA from product if not in line
      if (tvaPercent === 0 || !tvaPercent) {
        if (line.product?.tva) {
          tvaPercent = Number(line.product.tva);
        } else if (line.product?.tvaPercent) {
          tvaPercent = Number(line.product.tvaPercent);
        } else {
          // Default to 19% if no TVA info found
          tvaPercent = 19;
        }
      }

      // Calculate HTVA and TVA if not provided
      let prixVenteHTVA = Number(line.prixVenteHTVA || 0);
      let montantTVA = Number(line.montantTVA || 0);

      // Always recalculate if we have TTC price and TVA percentage
      if (unitPriceTTC > 0 && tvaPercent > 0) {
        if (prixVenteHTVA === 0 || !prixVenteHTVA) {
          // Calculate HTVA from TTC: HTVA = TTC / (1 + TVA%)
          prixVenteHTVA = unitPriceTTC / (1 + tvaPercent / 100);
        }
        // Always recalculate TVA amount
        montantTVA = unitPriceTTC - prixVenteHTVA;
      } else if (prixVenteHTVA > 0 && montantTVA === 0) {
        // If we have HTVA but no TTC, calculate TTC and TVA
        if (tvaPercent > 0) {
          unitPriceTTC = prixVenteHTVA * (1 + tvaPercent / 100);
          montantTVA = unitPriceTTC - prixVenteHTVA;
        } else {
          montantTVA = 0;
        }
      } else if (unitPriceTTC > 0 && (tvaPercent === 0 || !tvaPercent)) {
        // If no TVA info, assume HTVA = TTC (0% VAT)
        prixVenteHTVA = unitPriceTTC;
        montantTVA = 0;
      }

      const sousTotalTTC = Number(line.sousTotalTTC || (qty * unitPriceTTC) || 0);

      // Calculate totals from line
      calculatedSubtotalHTVA += qty * prixVenteHTVA;
      calculatedTotalTVA += qty * montantTVA;
      calculatedTotalTTC += sousTotalTTC;

      // Simple formatting for thermal printer
      const nameTruncated = name.length > 20 ? name.substring(0, 17) + '...' : name;
      text += nameTruncated.padEnd(20) + qty.toString().padStart(3) + unitPriceTTC.toFixed(3).padStart(8) + sousTotalTTC.toFixed(3).padStart(8) + '\n';
    });

    text += '-------------------------------\n';

    // Totals - use invoice totals if available, otherwise calculate from lines
    const totalHT = Number(invoice.subtotalHTVA || calculatedSubtotalHTVA || 0).toFixed(3);
    const totalTVA = Number(invoice.totalTVA || calculatedTotalTVA || 0).toFixed(3);
    const totalTTC = Number(invoice.totalTTC || calculatedTotalTTC || 0).toFixed(3);

    text += 'Total HT'.padEnd(20) + totalHT.padStart(19) + ' dt\n';
    text += 'TVA'.padEnd(20) + totalTVA.padStart(19) + ' dt\n';
    text += boldOn + 'TOTAL TTC'.padEnd(20) + totalTTC.padStart(19) + ' dt' + boldOff + '\n';

    text += '-------------------------------\n';
    text += centerAlign + 'Merci de votre confiance!' + '\n';
    text += '==================\n\n';

    // Cut paper
    text += '\x1D\x56\x00';

    return text;
  }

  // New methods for family and article grouping
  private generateDailyExtractESCWithFamilyGrouping(sessionReport: any, companyData?: any, withdrawalAmount: number = 0): string {
    let escpos = '';

    // Initialize printer
    escpos += '\x1B\x40';
    escpos += '\x1B\x61\x01'; // Center align for header

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
    escpos += 'Extr. Journalière - ' + closingTime + '\n';

    // Add decorative bottom border
    escpos += '================================\n\n';

    // Session info
    escpos += '\x1B\x61\x00'; // Left align
    const session = sessionReport.session;
    const summary = sessionReport.summary;

    // Build family grouping from session sales
    const sales: any[] = (sessionReport?.session?.sales || []) as any[];
    const familyTotals: Record<string, number> = {};
    const normalizeFamily = (name: any): string => (name ?? '').toString().trim();



    if (sales.length) {
      for (const sale of sales) {
        const items: any[] = (sale.items || []) as any[];
        for (const it of items) {
          const famCandidate = it.product?.famille?.name || it.product?.family?.name || it.familyName || it.categoryName || it.family || '';
          const fam = normalizeFamily(famCandidate);
          const familyName = fam && fam.length ? fam : 'AUTRES';
          const lineTotal: number = Math.round((parseFloat(String(it.total ?? it.revenue ?? it.amount ?? 0)) || 0) * 1000) / 1000;

          if (!familyTotals[familyName]) {
            familyTotals[familyName] = 0;
          }
          familyTotals[familyName] += lineTotal;
        }
      }
    }

    // Print family totals
    escpos += 'VENTES PAR FAMILLE:\n';
    escpos += '-------------------------------\n';

    const sortedFamilies = Object.entries(familyTotals)
      .filter(([_, total]) => total > 0)
      .sort(([, a], [, b]) => b - a);

    for (const [familyName, total] of sortedFamilies) {
      const amount = this.formatCurrency(total);
      const totalWidth = 30;
      const usedSpace = familyName.length + amount.length;
      const dots = '.'.repeat(Math.max(1, totalWidth - usedSpace));
      const line = familyName.toUpperCase() + dots + amount;
      escpos += line + '\n';
    }

    // Add total
    const totalFamilySales = Math.round((Object.values(familyTotals).reduce((sum, total) => sum + total, 0)) * 1000) / 1000;
    escpos += '-------------------------------\n';
    const totalAmount = this.formatCurrency(totalFamilySales);
    const totalWidth = 30;
    const usedSpace = 'TOTAL:'.length + totalAmount.length;
    const dots = '.'.repeat(Math.max(1, totalWidth - usedSpace));
    escpos += 'TOTAL:' + dots + totalAmount + '\n\n';

    // Financial summary (same as original)
    escpos += '################################\n';
    escpos += '    RÉSUMÉ FINANCIER\n';
    escpos += '################################\n';

    const expectedCash = summary.expectedCash || 0;
    const totalSales = summary.totalSales || 0;
    const financialOpeningFund = session.openingFund || 0;

    const financialTotalWidth = 30;

    const formatFinancialLine = (label: string, amount: number) => {
      const amountStr = this.formatCurrency(amount);
      const usedSpace = label.length + amountStr.length;
      const spaces = ' '.repeat(Math.max(1, financialTotalWidth - usedSpace));
      return label + spaces + amountStr;
    };

    escpos += formatFinancialLine('Fonds initial:', financialOpeningFund) + '\n';
    escpos += formatFinancialLine('Espèces attendues:', expectedCash) + '\n';
    escpos += formatFinancialLine('Total ventes:', totalSales) + '\n';

    escpos += '\n';
    escpos += '================================\n';
    escpos += '\x1B\x61\x01'; // Center align
    escpos += 'Fin du rapport\n';
    escpos += '================================\n';

    // Cut paper
    escpos += '\x1D\x56\x00'; // Full cut

    return escpos;
  }

  private generateDailyExtractESCWithArticleGrouping(sessionReport: any, companyData?: any, withdrawalAmount: number = 0): string {
    let escpos = '';

    // Initialize printer
    escpos += '\x1B\x40';
    escpos += '\x1B\x61\x01'; // Center align for header

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
    escpos += 'Extr. Journalière - ' + closingTime + '\n';

    // Add decorative bottom border
    escpos += '================================\n\n';

    // Session info
    escpos += '\x1B\x61\x00'; // Left align
    const session = sessionReport.session;
    const summary = sessionReport.summary;

    // Build article grouping from session sales with family grouping
    const sales: any[] = (sessionReport?.session?.sales || []) as any[];
    const familyArticleTotals: Record<string, Record<string, { quantity: number; total: number }>> = {};



    if (sales.length) {
      for (const sale of sales) {
        const items: any[] = (sale.items || []) as any[];
        for (const it of items) {
          const productName: string = (it.productName || it.name || 'Produit').toString();
          const familyName: string = (it.product?.famille?.name || it.product?.family?.name || it.familyName || 'Sans famille').toString();
          const qty: number = Math.round(parseFloat(String(it.quantity ?? it.qty ?? 0)) || 0);
          const lineTotal: number = Math.round((parseFloat(String(it.total ?? it.revenue ?? it.amount ?? 0)) || 0) * 1000) / 1000;

          // Initialize family if not exists
          if (!familyArticleTotals[familyName]) {
            familyArticleTotals[familyName] = {};
          }

          // Initialize article if not exists
          if (!familyArticleTotals[familyName][productName]) {
            familyArticleTotals[familyName][productName] = { quantity: 0, total: 0 };
          }

          familyArticleTotals[familyName][productName].quantity += qty;
          familyArticleTotals[familyName][productName].total += lineTotal;
        }
      }
    }

    // Print article totals grouped by family in table format
    escpos += 'VENTES PAR ARTICLE (PAR FAMILLE):\n';
    escpos += '================================\n';

    // Sort families alphabetically
    const sortedFamilies = Object.keys(familyArticleTotals).sort();
    let totalArticleSales = 0;

    for (const familyName of sortedFamilies) {
      const articles = familyArticleTotals[familyName];

      // Print family header
      escpos += `\n${familyName.toUpperCase()}:\n`;
      escpos += '-------------------------------\n';

      // Print table header
      escpos += 'Article'.padEnd(25) + 'Qty'.padStart(8) + 'Unit Price'.padStart(12) + 'Total'.padStart(12) + '\n';
      escpos += '-------------------------------\n';

      // Sort articles within family by total (descending)
      const sortedArticles = Object.entries(articles)
        .filter(([_, data]) => data.quantity > 0 && data.total > 0)
        .sort(([, a], [, b]) => b.total - a.total);

      // Print articles in this family
      for (const [productName, data] of sortedArticles) {
        const unitPrice = data.quantity > 0 ? data.total / data.quantity : 0;
        const unitPriceFormatted = this.formatCurrency(unitPrice);
        const totalFormatted = this.formatCurrency(data.total);

        const line = productName.padEnd(25) +
          data.quantity.toString().padStart(8) +
          unitPriceFormatted.padStart(12) +
          totalFormatted.padStart(12);
        escpos += line + '\n';
        totalArticleSales += data.total;
      }

      // Print family total
      const familyTotal = Object.values(articles).reduce((sum, data) => sum + data.total, 0);
      const familyTotalFormatted = this.formatCurrency(familyTotal);
      escpos += '-------------------------------\n';
      escpos += `Total ${familyName.toUpperCase()}`.padEnd(25) + ''.padStart(8) + ''.padStart(12) + familyTotalFormatted.padStart(12) + '\n';
    }

    // Add grand total
    escpos += '\n================================\n';
    const totalAmount = this.formatCurrency(Math.round(totalArticleSales * 1000) / 1000);
    escpos += 'TOTAL GENERAL'.padEnd(25) + ''.padStart(8) + ''.padStart(12) + totalAmount.padStart(12) + '\n';
    escpos += '================================\n\n';

    // Financial summary (same as original)
    escpos += '################################\n';
    escpos += '    RÉSUMÉ FINANCIER\n';
    escpos += '################################\n';

    const expectedCash = summary.expectedCash || 0;
    const totalSales = summary.totalSales || 0;
    const financialOpeningFund = session.openingFund || 0;

    const financialTotalWidth = 30;

    const formatFinancialLine = (label: string, amount: number) => {
      const amountStr = this.formatCurrency(amount);
      const usedSpace = label.length + amountStr.length;
      const spaces = ' '.repeat(Math.max(1, financialTotalWidth - usedSpace));
      return label + spaces + amountStr;
    };

    escpos += formatFinancialLine('Fonds initial:', financialOpeningFund) + '\n';
    escpos += formatFinancialLine('Espèces attendues:', expectedCash) + '\n';
    escpos += formatFinancialLine('Total ventes:', totalSales) + '\n';

    escpos += '\n';
    escpos += '================================\n';
    escpos += '\x1B\x61\x01'; // Center align
    escpos += 'Fin du rapport\n';
    escpos += '================================\n';

    // Cut paper
    escpos += '\x1D\x56\x00'; // Full cut

    return escpos;
  }

  private generateDailyExtractHTMLWithFamilyGrouping(sessionReport: any, companyData?: any, withdrawalAmount: number = 0): string {
    const session = sessionReport.session;
    const summary = sessionReport.summary;
    const closedDate = new Date();
    const formatDateNoYearWithTime = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month} ${hours}:${minutes}`;
    };
    const closingTime = formatDateNoYearWithTime(closedDate);

    // Build family grouping from session sales
    const sales: any[] = (sessionReport?.session?.sales || []) as any[];
    const familyArticleTotals: Record<string, Record<string, { quantity: number; total: number }>> = {};

    if (sales.length) {
      for (const sale of sales) {
        const items: any[] = (sale.items || []) as any[];
        for (const it of items) {
          const productName: string = (it.productName || it.name || 'Produit').toString();
          const familyName: string = (it.product?.famille?.name || it.product?.family?.name || it.familyName || 'Sans famille').toString();
          const qty: number = parseFloat(String(it.quantity ?? it.qty ?? 0)) || 0;
          const lineTotal: number = parseFloat(String(it.total ?? it.revenue ?? it.amount ?? 0)) || 0;

          // Initialize family if not exists
          if (!familyArticleTotals[familyName]) {
            familyArticleTotals[familyName] = {};
          }

          // Initialize article if not exists
          if (!familyArticleTotals[familyName][productName]) {
            familyArticleTotals[familyName][productName] = { quantity: 0, total: 0 };
          }

          familyArticleTotals[familyName][productName].quantity += qty;
          familyArticleTotals[familyName][productName].total += lineTotal;
        }
      }
    }

    // Sort families alphabetically
    const sortedFamilies = Object.keys(familyArticleTotals).sort();
    let totalArticleSales = 0;

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>EXTRait JOURNALIÈRE - ${closingTime}</title>
        <style>
            @page {
                size: A4;
                margin: 0.5cm;
            }
            * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            body { 
                font-family: 'Arial', sans-serif; 
                margin: 0; 
                padding: 8px; 
                font-size: 12px;
                line-height: 1.2;
                width: 100%;
                min-height: 100vh;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
            }
            .title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 5px;
            }
            .date {
                font-size: 12px;
            }
            .family-section {
                margin-bottom: 15px;
            }
            .family-title {
                font-weight: bold;
                font-size: 14px;
                margin-bottom: 5px;
                text-transform: uppercase;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 5px;
            }
            th, td {
                border: 1px solid #000;
                padding: 3px 5px;
                text-align: left;
                font-size: 11px;
            }
            th {
                background-color: #f0f0f0;
                font-weight: bold;
                text-align: center;
                font-size: 11px;
            }
            .article-col {
                width: 40%;
            }
            .qty-col {
                width: 15%;
                text-align: right;
            }
            .unit-price-col {
                width: 20%;
                text-align: right;
            }
            .total-col {
                width: 25%;
                text-align: right;
            }
            .family-total {
                font-weight: bold;
                background-color: #f8f8f8;
                font-size: 11px;
            }
            .financial-summary {
                margin-top: 20px;
                border: 2px solid #000;
                padding: 10px;
            }
            .financial-summary h3 {
                text-align: center;
                margin: 0 0 10px 0;
                font-size: 14px;
                font-weight: bold;
            }
            .financial-summary table {
                width: 100%;
                border: none;
            }
            .financial-summary td {
                border: none;
                padding: 2px 5px;
                font-size: 11px;
            }
            .financial-summary .label {
                text-align: left;
            }
            .financial-summary .amount {
                text-align: right;
                font-weight: bold;
            }
            .separator {
                border-top: 1px solid #000;
                margin: 5px 0;
            }
            @media print {
                @page {
                    size: A4 !important;
                    margin: 0.5cm !important;
                }
                * {
                    -webkit-print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }
                body { 
                    font-size: 12px !important;
                    padding: 8px !important;
                    margin: 0 !important;
                    width: 100% !important;
                    min-height: 100vh !important;
                    transform: scale(1) !important;
                }
                html {
                    width: 100% !important;
                    height: 100% !important;
                }
                th, td {
                    padding: 3px 5px !important;
                    font-size: 11px !important;
                }
                .title {
                    font-size: 18px !important;
                }
                table {
                    width: 100% !important;
                    page-break-inside: avoid !important;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">EXTRait JOURNALIÈRE</div>
            <div class="date">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>`;

    // Generate family sections
    for (const familyName of sortedFamilies) {
      const articles = familyArticleTotals[familyName];
      const sortedArticles = Object.keys(articles).sort();
      let familyTotal = 0;

      html += `
        <div class="family-section">
            <div class="family-title">${familyName}</div>
            <table>
                <thead>
                    <tr>
                        <th class="article-col">Article</th>
                        <th class="qty-col">Qty</th>
                        <th class="unit-price-col">Unit Price</th>
                        <th class="total-col">Total</th>
                    </tr>
                </thead>
                <tbody>`;

      for (const articleName of sortedArticles) {
        const articleData = articles[articleName];
        const unitPrice = articleData.quantity > 0 ? articleData.total / articleData.quantity : 0;
        familyTotal += articleData.total;
        totalArticleSales += articleData.total;

        html += `
                    <tr>
                        <td class="article-col">${articleName}</td>
                        <td class="qty-col">${articleData.quantity.toFixed(3)}</td>
                        <td class="unit-price-col">${unitPrice.toFixed(3)} DT</td>
                        <td class="total-col">${articleData.total.toFixed(3)} DT</td>
                    </tr>`;
      }

      html += `
                    <tr class="family-total">
                        <td class="article-col">Total ${familyName}</td>
                        <td class="qty-col"></td>
                        <td class="unit-price-col"></td>
                        <td class="total-col">${familyTotal.toFixed(3)} DT</td>
                    </tr>
                </tbody>
            </table>
        </div>`;
    }

    // Show cancelled tickets section
    const allSales: any[] = sessionReport?.session?.sales || [];
    const cancelledTickets = allSales.filter((s: any) => {
      const status = String(s?.status || '').toUpperCase();
      return status === 'CANCELLED';
    });

    if (cancelledTickets.length > 0) {
      let totalCancelledAmount = 0;
      let cancelledTicketsRows = '';

      cancelledTickets.forEach((ticket: any) => {
        const ticketNumber = ticket.dailyTicketNumber || ticket.sessionTicketNumber || ticket.ticketNumber || ticket.id;
        const ticketAmount = parseFloat(ticket.finalTotal || ticket.total || 0) || 0;
        totalCancelledAmount += ticketAmount;

        cancelledTicketsRows += `
                    <tr>
                        <td class="article-col">Ticket #${ticketNumber}</td>
                        <td class="qty-col"></td>
                        <td class="unit-price-col"></td>
                        <td class="total-col">${ticketAmount.toFixed(3)} DT</td>
                    </tr>`;
      });

      html += `
        <div class="family-section">
            <div class="family-title">TICKETS ANNULÉS</div>
            <table>
                <thead>
                    <tr>
                        <th class="article-col">Article</th>
                        <th class="qty-col">Qty</th>
                        <th class="unit-price-col">Unit Price</th>
                        <th class="total-col">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${cancelledTicketsRows}
                    <tr class="family-total">
                        <td class="article-col">Total annulé</td>
                        <td class="qty-col"></td>
                        <td class="unit-price-col"></td>
                        <td class="total-col">${totalCancelledAmount.toFixed(3)} DT</td>
                    </tr>
                </tbody>
            </table>
        </div>`;
    }

    // Financial summary
    // Calculate total discounts from all sales
    const totalDiscount = sales.reduce((sum: number, sale: any) => {
      const discount = parseFloat(sale.discount || 0) || 0;
      return sum + discount;
    }, 0);
    const totalExpenses = summary?.expensesTotal || 0;
    // Use summary.totalSales (total of all ticket amounts) instead of totalArticleSales
    const totalCaisse = summary?.totalSales || totalArticleSales;
    const remainingCash = totalCaisse - withdrawalAmount;

    html += `
        <div class="financial-summary">
            <h3>Résumé Financier</h3>
            <table>
                <tr>
                    <td class="label">Totale Remise</td>
                    <td class="amount">${totalDiscount.toFixed(3)} DT</td>
                </tr>
                <tr>
                    <td class="label">Totale Recette</td>
                    <td class="amount"><strong>${totalArticleSales.toFixed(3)} DT</strong></td>
                </tr>
                <tr>
                    <td class="label">Totale Caisse (Solde Débit)</td>
                    <td class="amount"><strong>${totalCaisse.toFixed(3)} DT</strong></td>
                </tr>
                <tr>
                    <td class="label">Dépense</td>
                    <td class="amount">${totalExpenses.toFixed(3)} DT</td>
                </tr>`;

    // Calculate supplier payments total
    const supplierPayments = (session.cashMovements || []).filter((m: any) =>
      m.type === 'SORTIE' &&
      ((m.reason || '').toLowerCase().includes('fournisseur') ||
        (m.reason || '').toLowerCase().includes('supplier'))
    );
    const supplierDetails = (summary as any)?.supplierPaymentsDetails || [];
    let supplierPaymentsTotal = 0;
    let supplierRows = '';

    if (supplierPayments.length > 0) {
      supplierPayments.forEach((payment: any) => {
        const amount = parseFloat(payment.amount || 0) || 0;
        supplierPaymentsTotal += amount;
        const reason = payment.reason || '';
        let supplierName = 'Fournisseur';

        const idMatch = reason.match(/#(\d+)/);
        const paymentId = idMatch ? parseInt(idMatch[1], 10) : null;

        if (supplierDetails && supplierDetails.length && paymentId) {
          const match = supplierDetails.find((d: any) => Number(d.id) === paymentId);
          if (match && match.supplierName) {
            supplierName = match.supplierName;
          }
        }

        if (supplierName === 'Fournisseur') {
          const paren = reason.match(/\(([^)]+)\)/);
          if (paren && paren[1] && !/^FOURN:/i.test(paren[1])) {
            supplierName = paren[1].trim();
          }
        }

        supplierRows += `
                <tr>
                    <td class="label">${supplierName}</td>
                    <td class="amount">${amount.toFixed(3)} DT</td>
                </tr>`;
      });
    } else if (supplierDetails.length > 0) {
      supplierDetails.forEach((detail: any) => {
        const amount = parseFloat(detail.amount || 0) || 0;
        supplierPaymentsTotal += amount;
        const supplierName = detail.supplierName || 'Fournisseur';
        supplierRows += `
                <tr>
                    <td class="label">${supplierName}</td>
                    <td class="amount">${amount.toFixed(3)} DT</td>
                </tr>`;
      });
    }

    if (supplierPaymentsTotal > 0) {
      // Only show individual supplier rows, not a total row to avoid duplication
      html += supplierRows;
    }

    html += `
                <tr><td colspan="2" class="separator"></td></tr>
                <tr>
                    <td class="label">Totale Caisse</td>
                    <td class="amount"><strong>${totalCaisse.toFixed(3)} DT</strong></td>
                </tr>
                <tr>
                    <td class="label">Retrait</td>
                    <td class="amount">${withdrawalAmount.toFixed(3)} DT</td>
                </tr>
                <tr>
                    <td class="label">Montant Crédit Client</td>
                    <td class="amount">${((summary as any)?.creditOutstanding || 0).toFixed(3)} DT</td>
                </tr>
                <tr>
                    <td class="label">Montant Règlement Client</td>
                    <td class="amount">${((summary as any)?.clientPaymentsTotal || 0).toFixed(3)} DT</td>
                </tr>
                <tr>
                    <td class="label">Totale Reste Caisse</td>
                    <td class="amount"><strong>${remainingCash.toFixed(3)} DT</strong></td>
                </tr>
            </table>
        </div>
    </body>
    </html>`;

    return html;
  }

  private generateDailyExtractHTMLWithArticleGrouping(sessionReport: any, companyData?: any, withdrawalAmount: number = 0): string {
    const closedDate = new Date();
    const formatDateNoYearWithTime = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month} ${hours}:${minutes}`;
    };
    const closingTime = formatDateNoYearWithTime(closedDate);

    const session = sessionReport.session;
    const summary = sessionReport.summary;

    // Build article grouping from session sales with family grouping
    const sales: any[] = (sessionReport?.session?.sales || []) as any[];
    const familyArticleTotals: Record<string, Record<string, { quantity: number; total: number }>> = {};

    if (sales.length) {
      for (const sale of sales) {
        const items: any[] = (sale.items || []) as any[];
        for (const it of items) {
          const productName: string = (it.productName || it.name || 'Produit').toString();
          const familyName: string = (it.product?.famille?.name || it.product?.family?.name || it.familyName || 'Sans famille').toString();
          const qty: number = Math.round(parseFloat(String(it.quantity ?? it.qty ?? 0)) || 0);
          const lineTotal: number = Math.round((parseFloat(String(it.total ?? it.revenue ?? it.amount ?? 0)) || 0) * 1000) / 1000;

          // Initialize family if not exists
          if (!familyArticleTotals[familyName]) {
            familyArticleTotals[familyName] = {};
          }

          // Initialize article if not exists
          if (!familyArticleTotals[familyName][productName]) {
            familyArticleTotals[familyName][productName] = { quantity: 0, total: 0 };
          }

          familyArticleTotals[familyName][productName].quantity += qty;
          familyArticleTotals[familyName][productName].total += lineTotal;
        }
      }
    }

    // Sort families alphabetically
    const sortedFamilies = Object.keys(familyArticleTotals).sort();
    let totalArticleSales = 0;

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Extr. Journalière - ${closingTime}</title>
        <style>
            @page {
                size: A4;
                margin: 0.5cm;
            }
            * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            body { 
                font-family: 'Arial', sans-serif; 
                margin: 0; 
                padding: 8px; 
                font-size: 14px;
                line-height: 1.3;
                width: 100%;
                min-height: 100vh;
            }
            .header {
                text-align: center;
                margin-bottom: 16px;
                border-bottom: 2px solid #000;
                padding-bottom: 8px;
            }
            .title {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 4px;
            }
            .date {
                font-size: 12px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 8px;
            }
            th, td {
                border: 1px solid #000;
                padding: 4px 6px;
                text-align: left;
                font-size: 11px;
            }
            th {
                background-color: #e0e0e0;
                font-weight: bold;
                text-align: center;
                font-size: 11px;
            }
            .qty, .unit-price, .total {
                text-align: right;
            }
            .category {
                text-align: left;
                width: 25%;
                font-weight: bold;
                background-color: #f0f0f0;
            }
            .article {
                text-align: left;
                width: 35%;
            }
            .qty {
                width: 12%;
            }
            .unit-price {
                width: 15%;
            }
            .total {
                width: 13%;
            }
            .family-total {
                font-weight: bold;
                background-color: #f8f8f8;
                font-size: 11px;
            }
            .grand-total {
                margin-top: 16px;
                border-top: 2px solid #000;
                padding-top: 8px;
            }
            .grand-total table {
                border: 1px solid #000;
            }
            .grand-total td {
                font-weight: bold;
                font-size: 12px;
            }
            .financial-summary {
                margin-top: 16px;
                border: 1px solid #000;
                padding: 12px;
            }
            .financial-summary h3 {
                text-align: center;
                margin: 0 0 8px 0;
                font-size: 14px;
            }
            .financial-summary table {
                width: 100%;
            }
            .financial-summary td {
                border: none;
                padding: 2px 8px;
                font-size: 11px;
            }
            .financial-summary .label {
                text-align: left;
            }
            .financial-summary .amount {
                text-align: right;
                font-weight: bold;
            }
            h2 {
                font-size: 14px;
                margin: 8px 0 16px 0;
                text-align: center;
            }
            @media print {
                @page {
                    size: A4 !important;
                    margin: 0.5cm !important;
                }
                * {
                    -webkit-print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }
                body { 
                    font-size: 14px !important;
                    padding: 8px !important;
                    margin: 0 !important;
                    width: 100% !important;
                    min-height: 100vh !important;
                    transform: scale(1) !important;
                }
                html {
                    width: 100% !important;
                    height: 100% !important;
                }
                th, td {
                    padding: 4px 6px !important;
                    font-size: 12px !important;
                }
                .header {
                    margin-bottom: 12px !important;
                }
                .title {
                    font-size: 18px !important;
                }
                .grand-total {
                    margin-top: 12px !important;
                    padding-top: 6px !important;
                }
                .financial-summary {
                    margin-top: 12px !important;
                    padding: 8px !important;
                }
                table {
                    width: 100% !important;
                    page-break-inside: avoid !important;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">Extr. Journalière - ${closingTime}</div>
        </div>
        
        <h2>VENTES PAR ARTICLE (PAR FAMILLE)</h2>
        
        <table>
            <thead>
                <tr>
                    <th class="category">Category</th>
                    <th class="article">Article</th>
                    <th class="qty">Qty</th>
                    <th class="unit-price">Unit Price</th>
                    <th class="total">Total</th>
                </tr>
            </thead>
            <tbody>`;

    for (const familyName of sortedFamilies) {
      const articles = familyArticleTotals[familyName];

      // Sort articles within family by total (descending)
      const sortedArticles = Object.entries(articles)
        .filter(([_, data]) => data.quantity > 0 && data.total > 0)
        .sort(([, a], [, b]) => b.total - a.total);

      // Print articles in this family
      for (const [productName, data] of sortedArticles) {
        const unitPrice = data.quantity > 0 ? data.total / data.quantity : 0;
        const unitPriceFormatted = this.formatCurrency(unitPrice);
        const totalFormatted = this.formatCurrency(data.total);

        html += `
                <tr>
                    <td class="category">${familyName.toUpperCase()}</td>
                    <td class="article">${productName}</td>
                    <td class="qty">${data.quantity}</td>
                    <td class="unit-price">${unitPriceFormatted}</td>
                    <td class="total">${totalFormatted}</td>
                </tr>`;
        totalArticleSales += data.total;
      }

      // Print family total
      const familyTotal = Object.values(articles).reduce((sum, data) => sum + data.total, 0);
      const familyTotalFormatted = this.formatCurrency(familyTotal);

      html += `
                <tr class="family-total">
                    <td class="category">Total ${familyName.toUpperCase()}</td>
                    <td class="article"></td>
                    <td class="qty"></td>
                    <td class="unit-price"></td>
                    <td class="total">${familyTotalFormatted}</td>
                </tr>`;
    }

    // Add grand total
    const totalAmount = this.formatCurrency(Math.round(totalArticleSales * 1000) / 1000);
    html += `
            </tbody>
        </table>
        
        <div class="grand-total">
            <table>
                <tr>
                    <td class="category">TOTAL GENERAL</td>
                    <td class="article"></td>
                    <td class="qty"></td>
                    <td class="unit-price"></td>
                    <td class="total">${totalAmount}</td>
                </tr>
            </table>
        </div>`;

    // Financial summary
    const expectedCash = summary.expectedCash || 0;
    const totalSales = summary.totalSales || 0;
    const financialOpeningFund = session.openingFund || 0;

    html += `
        <div class="financial-summary">
            <h3>RÉSUMÉ FINANCIER</h3>
            <table>
                <tr>
                    <td class="label">Fonds initial:</td>
                    <td class="amount">${this.formatCurrency(financialOpeningFund)}</td>
                </tr>
                <tr>
                    <td class="label">Espèces attendues:</td>
                    <td class="amount">${this.formatCurrency(expectedCash)}</td>
                </tr>
                <tr>
                    <td class="label">Total ventes:</td>
                    <td class="amount">${this.formatCurrency(totalSales)}</td>
                </tr>
            </table>
        </div>
    </body>
    </html>`;

    return html;
  }

  private generateDailyExtractHTMLWithFamilyGrouping80mm(sessionReport: any, companyData?: any, withdrawalAmount: number = 0): string {
    const closedDate = new Date();
    const formatDateNoYearWithTime = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month} ${hours}:${minutes}`;
    };
    const closingTime = formatDateNoYearWithTime(closedDate);

    const session = sessionReport.session;
    const summary = sessionReport.summary;

    // Build family grouping from session sales (same logic as A4 version)
    const sales: any[] = (sessionReport?.session?.sales || []) as any[];
    const familyArticleTotals: Record<string, Record<string, { quantity: number; total: number }>> = {};

    if (sales.length) {
      for (const sale of sales) {
        const items: any[] = (sale.items || []) as any[];
        for (const it of items) {
          const productName: string = (it.productName || it.name || 'Produit').toString();
          const familyName: string = (it.product?.famille?.name || it.product?.family?.name || it.familyName || 'Sans famille').toString();
          const qty: number = parseFloat(String(it.quantity ?? it.qty ?? 0)) || 0;
          const lineTotal: number = parseFloat(String(it.total ?? it.revenue ?? it.amount ?? 0)) || 0;

          // Initialize family if not exists
          if (!familyArticleTotals[familyName]) {
            familyArticleTotals[familyName] = {};
          }

          // Initialize article if not exists
          if (!familyArticleTotals[familyName][productName]) {
            familyArticleTotals[familyName][productName] = { quantity: 0, total: 0 };
          }

          familyArticleTotals[familyName][productName].quantity += qty;
          familyArticleTotals[familyName][productName].total += lineTotal;
        }
      }
    }

    // Sort families alphabetically
    const sortedFamilies = Object.keys(familyArticleTotals).sort();
    let totalArticleSales = 0;

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>EXTRait JOURNALIÈRE - ${closingTime}</title>
        <style>
            @page {
                size: 80mm auto;
                margin: 2mm;
            }
            * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            body {
                font-family: 'Arial', sans-serif;
                margin: 0;
                padding: 2px;
                font-size: 8px;
                line-height: 1.1;
                width: 76mm;
                max-width: 76mm;
            }
            .header {
                text-align: center;
                margin-bottom: 8px;
                border-bottom: 1px solid #000;
                padding-bottom: 4px;
            }
            .title {
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 2px;
            }
            .date {
                font-size: 8px;
            }
            .family-section {
                margin-bottom: 6px;
            }
            .family-title {
                font-weight: bold;
                font-size: 9px;
                margin-bottom: 2px;
                text-transform: uppercase;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 2px;
            }
            th, td {
                border: 1px solid #000;
                padding: 1px 2px;
                text-align: left;
                font-size: 7px;
            }
            th {
                background-color: #f0f0f0;
                font-weight: bold;
                text-align: center;
                font-size: 7px;
            }
            .article-col { width: 45%; }
            .qty-col { width: 15%; text-align: right; }
            .unit-price-col { width: 20%; text-align: right; }
            .total-col { width: 20%; text-align: right; }
            .family-total {
                font-weight: bold;
                background-color: #f8f8f8;
                font-size: 7px;
            }
            .financial-summary {
                margin-top: 8px;
                border: 1px solid #000;
                padding: 4px;
            }
            .financial-summary h3 {
                text-align: center;
                margin: 0 0 4px 0;
                font-size: 9px;
                font-weight: bold;
            }
            .financial-summary table { width: 100%; border: none; }
            .financial-summary td { border: none; padding: 1px 2px; font-size: 7px; }
            .financial-summary .label { text-align: left; }
            .financial-summary .amount { text-align: right; font-weight: bold; }
            .separator { border-top: 1px solid #000; margin: 2px 0; }
            @media print {
                @page { size: 80mm auto !important; margin: 2mm !important; }
                * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
                body {
                    font-size: 8px !important; padding: 2px !important; margin: 0 !important;
                    width: 76mm !important; max-width: 76mm !important; transform: scale(1) !important;
                }
                html { width: 76mm !important; }
                th, td { padding: 1px 2px !important; font-size: 7px !important; }
                .title { font-size: 12px !important; }
                table { width: 100% !important; page-break-inside: avoid !important; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">EXTRait JOURNALIÈRE</div>
            <div class="date">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>`;

    // Generate family sections (same logic as A4 version)
    for (const familyName of sortedFamilies) {
      const articles = familyArticleTotals[familyName];
      const sortedArticles = Object.keys(articles).sort();
      let familyTotal = 0;

      html += `
        <div class="family-section">
            <div class="family-title">${familyName}</div>
            <table>
                <thead>
                    <tr>
                        <th class="article-col">Article</th>
                        <th class="qty-col">Qty</th>
                        <th class="unit-price-col">Unit Price</th>
                        <th class="total-col">Total</th>
                    </tr>
                </thead>
                <tbody>`;

      for (const articleName of sortedArticles) {
        const articleData = articles[articleName];
        const unitPrice = articleData.quantity > 0 ? articleData.total / articleData.quantity : 0;
        familyTotal += articleData.total;
        totalArticleSales += articleData.total;

        html += `
                    <tr>
                        <td class="article-col">${articleName}</td>
                        <td class="qty-col">${articleData.quantity.toFixed(3)}</td>
                        <td class="unit-price-col">${unitPrice.toFixed(3)} DT</td>
                        <td class="total-col">${articleData.total.toFixed(3)} DT</td>
                    </tr>`;
      }

      html += `
                    <tr class="family-total">
                        <td class="article-col">Total ${familyName}</td>
                        <td class="qty-col"></td>
                        <td class="unit-price-col"></td>
                        <td class="total-col">${familyTotal.toFixed(3)} DT</td>
                    </tr>
                </tbody>
            </table>
        </div>`;
    }

    // Show cancelled tickets section
    const allSales: any[] = sessionReport?.session?.sales || [];
    const cancelledTickets = allSales.filter((s: any) => {
      const status = String(s?.status || '').toUpperCase();
      return status === 'CANCELLED';
    });

    if (cancelledTickets.length > 0) {
      let totalCancelledAmount = 0;
      let cancelledTicketsRows = '';

      cancelledTickets.forEach((ticket: any) => {
        const ticketNumber = ticket.dailyTicketNumber || ticket.sessionTicketNumber || ticket.ticketNumber || ticket.id;
        const ticketAmount = parseFloat(ticket.finalTotal || ticket.total || 0) || 0;
        totalCancelledAmount += ticketAmount;

        cancelledTicketsRows += `
                    <tr>
                        <td class="article-col">Ticket #${ticketNumber}</td>
                        <td class="qty-col"></td>
                        <td class="unit-price-col"></td>
                        <td class="total-col">${ticketAmount.toFixed(3)} DT</td>
                    </tr>`;
      });

      html += `
        <div class="family-section">
            <div class="family-title">TICKETS ANNULÉS</div>
            <table>
                <thead>
                    <tr>
                        <th class="article-col">Article</th>
                        <th class="qty-col">Qty</th>
                        <th class="unit-price-col">Unit Price</th>
                        <th class="total-col">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${cancelledTicketsRows}
                    <tr class="family-total">
                        <td class="article-col">Total annulé</td>
                        <td class="qty-col"></td>
                        <td class="unit-price-col"></td>
                        <td class="total-col">${totalCancelledAmount.toFixed(3)} DT</td>
                    </tr>
                </tbody>
            </table>
        </div>`;
    }

    // Financial summary (same logic as A4 version)
    // Calculate total discounts from all sales
    const totalDiscount = sales.reduce((sum: number, sale: any) => {
      const discount = parseFloat(sale.discount || 0) || 0;
      return sum + discount;
    }, 0);
    const totalExpenses = summary?.expensesTotal || 0;
    // Use summary.totalSales (total of all ticket amounts) instead of totalArticleSales
    const totalCaisse = summary?.totalSales || totalArticleSales;
    const remainingCash = totalCaisse - withdrawalAmount;

    html += `
        <div class="financial-summary">
            <h3>Résumé Financier</h3>
            <table>
                <tr>
                    <td class="label">Totale Remise</td>
                    <td class="amount">${totalDiscount.toFixed(3)} DT</td>
                </tr>
                <tr>
                    <td class="label">Totale Recette</td>
                    <td class="amount"><strong>${totalArticleSales.toFixed(3)} DT</strong></td>
                </tr>
                <tr>
                    <td class="label">Totale Caisse (Solde Débit)</td>
                    <td class="amount"><strong>${totalCaisse.toFixed(3)} DT</strong></td>
                </tr>
                <tr>
                    <td class="label">Dépense</td>
                    <td class="amount">${totalExpenses.toFixed(3)} DT</td>
                </tr>
                <tr><td colspan="2" class="separator"></td></tr>
                <tr>
                    <td class="label">Totale Caisse</td>
                    <td class="amount"><strong>${totalCaisse.toFixed(3)} DT</strong></td>
                </tr>
                <tr>
                    <td class="label">Retrait</td>
                    <td class="amount">${withdrawalAmount.toFixed(3)} DT</td>
                </tr>
                <tr>
                    <td class="label">Montant Crédit Client</td>
                    <td class="amount">${((summary as any)?.creditOutstanding || 0).toFixed(3)} DT</td>
                </tr>
                <tr>
                    <td class="label">Montant Règlement Client</td>
                    <td class="amount">${((summary as any)?.clientPaymentsTotal || 0).toFixed(3)} DT</td>
                </tr>
                <tr>
                    <td class="label">Totale Reste Caisse</td>
                    <td class="amount"><strong>${remainingCash.toFixed(3)} DT</strong></td>
                </tr>
            </table>
        </div>`;

    html += `</body></html>`;
    return html;
  }

  /**
   * Print A4 formatted report from HTML content or selector
   * @param content HTML content string or CSS selector
   * @param title Report title
   */
  printA4Report(content: string | HTMLElement, title: string = 'Rapport'): void {
    let htmlContent = '';

    if (typeof content === 'string') {
      // If it's a selector, get the element
      if (content.startsWith('#')) {
        const element = document.querySelector(content);
        if (element) {
          htmlContent = element.innerHTML;
        } else {
          // If selector not found, treat as HTML string
          htmlContent = content;
        }
      } else {
        // Treat as HTML string
        htmlContent = content;
      }
    } else {
      // It's an HTMLElement
      htmlContent = content.innerHTML;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      return;
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          @page {
            size: A4;
            margin: 0.5cm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 8px;
            font-size: 12px;
            line-height: 1.4;
            width: 100%;
            min-height: 100vh;
            color: #000;
            background: #fff;
          }
          .header {
            text-align: center;
            margin-bottom: 16px;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
          }
          .title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .subtitle {
            font-size: 12px;
            color: #333;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            page-break-inside: avoid;
          }
          th, td {
            border: 1px solid #000;
            padding: 6px 8px;
            text-align: left;
            font-size: 11px;
          }
          th {
            background-color: #e0e0e0;
            font-weight: bold;
            text-align: center;
            font-size: 11px;
          }
          .total-row {
            font-weight: bold;
            background-color: #f0f0f0;
          }
          .summary {
            margin-bottom: 16px;
            padding: 8px;
            border: 1px solid #ccc;
            background-color: #f9f9f9;
          }
          .summary p {
            margin: 4px 0;
            font-size: 11px;
          }
          @media print {
            @page {
              size: A4 !important;
              margin: 0.5cm !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-size: 12px !important;
              padding: 8px !important;
              margin: 0 !important;
              width: 100% !important;
              min-height: 100vh !important;
              transform: scale(1) !important;
            }
            html {
              width: 100% !important;
              height: 100% !important;
            }
            th, td {
              padding: 6px 8px !important;
              font-size: 11px !important;
            }
            table {
              width: 100% !important;
              page-break-inside: avoid !important;
            }
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();

    let hasPrinted = false;

    printWindow.onload = () => {
      setTimeout(() => {
        if (!hasPrinted) {
          printWindow.print();
          hasPrinted = true;
        }
      }, 500);
    };

    setTimeout(() => {
      if (printWindow && !printWindow.closed && !hasPrinted) {
        try {
          printWindow.print();
          hasPrinted = true;
        } catch (error) {
          console.error('Print failed:', error);
        }
      }
    }, 1000);
  }

  // Build thermal text for supplier statement (80mm width = 48 characters)
  buildSupplierStatementText(
    statement: any,
    supplier: any,
    startDate: string | null,
    endDate: string | null
  ): string {
    let text = '';
    const LINE_WIDTH = 48; // 80mm thermal printer width

    // ESC/POS commands for formatting
    const ESC = '\x1B';
    const centerAlign = ESC + '\x61\x01'; // Center alignment
    const leftAlign = ESC + '\x61\x00';   // Left alignment
    const boldOn = ESC + '\x45\x01';      // Bold on
    const boldOff = ESC + '\x45\x00';     // Bold off
    const monospaceFont = ESC + '\x4D\x00'; // Select font A (monospace)
    const noTopMargin = ESC + '\x4C\x00\x00'; // Set top margin to 0
    const noBottomMargin = ESC + '\x4E\x00\x00'; // Set bottom margin to 0

    // Eliminate margins and set monospace font
    text += noTopMargin + noBottomMargin + monospaceFont;

    // Header
    text += '='.repeat(LINE_WIDTH) + '\n';
    text += leftAlign + 'FOURNISSEUR' + '\n';
    text += leftAlign + '\n';

    // Supplier information
    const supplierName = this.sanitizeForThermalPrinter(supplier.name || 'N/A');
    text += supplierName.substring(0, LINE_WIDTH) + '\n';
    if (supplier.contactName) {
      const contact = 'Contact: ' + this.sanitizeForThermalPrinter(supplier.contactName);
      text += contact.substring(0, LINE_WIDTH) + '\n';
    }
    if (supplier.phone) {
      text += 'Tel: ' + this.sanitizeForThermalPrinter(supplier.phone) + '\n';
    }
    if (supplier.email) {
      const email = 'Email: ' + this.sanitizeForThermalPrinter(supplier.email);
      text += email.substring(0, LINE_WIDTH) + '\n';
    }

    // Period
    text += '-'.repeat(LINE_WIDTH) + '\n';
    const periodStart = startDate ? new Date(startDate).toLocaleDateString('fr-FR') : 'Début';
    const periodEnd = endDate ? new Date(endDate).toLocaleDateString('fr-FR') : 'Aujourd\'hui';
    const periodLine = 'Periode: ' + periodStart + ' - ' + periodEnd;
    text += periodLine.substring(0, LINE_WIDTH) + '\n';
    text += 'Date: ' + new Date().toLocaleDateString('fr-FR') + '\n';
    text += '-'.repeat(LINE_WIDTH) + '\n';
    text += '\n';

    // Transactions
    text += 'DETAIL DES OPERATIONS:' + '\n';
    text += '-'.repeat(LINE_WIDTH) + '\n';

    if (!statement.statement || statement.statement.length === 0) {
      text += 'Aucune operation pour cette periode\n';
    } else {
      // Header row - Date(6) + Ref(12) + Debit(10) + Credit(10) + Solde(10) = 48 chars
      text += 'Date       Ref       Debit     Credit       Solde\n';
      text += '-'.repeat(LINE_WIDTH) + '\n';

      statement.statement.forEach((item: any) => {
        const date = new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        const ref = (item.reference || '').substring(0, 12).padEnd(12);
        const debit = item.debit > 0 ? item.debit.toFixed(3).padStart(10) : ''.padStart(10);
        const credit = item.credit > 0 ? item.credit.toFixed(3).padStart(10) : ''.padStart(10);
        const balanceValue = item.balance;
        // Negative balances show value with "-" at the end (e.g., "500.000-")
        // Positive balances show just the value
        const balance = balanceValue < 0
          ? Math.abs(balanceValue).toFixed(3).padStart(9) + '-'
          : balanceValue.toFixed(3).padStart(10);

        // Format: Date(6) + Ref(12) + Debit(10) + Credit(10) + Solde(10) = 48 chars
        const line = date.padEnd(6) + ref + debit + credit + balance;
        text += line.substring(0, LINE_WIDTH) + '\n';
      });
    }

    text += '-'.repeat(LINE_WIDTH) + '\n';
    text += centerAlign + 'Merci!' + '\n';
    text += leftAlign + '='.repeat(LINE_WIDTH) + '\n\n\n\n';

    // Cut paper
    text += '\x1D\x56\x00';

    return text;
  }

  buildClientStatementText(
    statement: any,
    client: any,
    startDate: string | null,
    endDate: string | null
  ): string {
    let text = '';
    const LINE_WIDTH = 48;

    text += '='.repeat(LINE_WIDTH) + '\n';
    text += 'CLIENT\n';
    text += '\n';

    const clientName = this.sanitizeForThermalPrinter((client.firstName || '') + ' ' + (client.lastName || '')).trim() || 'N/A';
    text += clientName.substring(0, LINE_WIDTH) + '\n';
    if (client.code) {
      text += 'Code: ' + this.sanitizeForThermalPrinter(client.code) + '\n';
    }

    text += '-'.repeat(LINE_WIDTH) + '\n';
    const periodStart = startDate ? new Date(startDate).toLocaleDateString('fr-FR') : 'Début';
    const periodEnd = endDate ? new Date(endDate).toLocaleDateString('fr-FR') : 'Aujourd\'hui';
    const periodLine = 'Periode: ' + periodStart + ' - ' + periodEnd;
    text += periodLine.substring(0, LINE_WIDTH) + '\n';
    text += 'Date: ' + new Date().toLocaleDateString('fr-FR') + '\n';
    text += '-'.repeat(LINE_WIDTH) + '\n';
    text += '\n';

    text += 'DETAIL DES OPERATIONS:\n';
    text += '-'.repeat(LINE_WIDTH) + '\n';

    if (!statement.statement || statement.statement.length === 0) {
      text += 'Aucune operation pour cette periode\n';
    } else {
      text += 'Date       Ref       Debit     Credit       Solde\n';
      text += '-'.repeat(LINE_WIDTH) + '\n';

      // Add opening balance row if date filter is applied
      if (startDate && statement.openingBalance !== undefined) {
        const date = new Date(startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        const ref = 'Solde Init.'.padEnd(12);
        const debit = ''.padStart(10);
        const credit = ''.padStart(10);
        const balanceValue = statement.openingBalance;
        const balance = balanceValue < 0
          ? Math.abs(balanceValue).toFixed(3).padStart(9) + '-'
          : balanceValue.toFixed(3).padStart(10);

        const line = date.padEnd(6) + ref + debit + credit + balance;
        text += line.substring(0, LINE_WIDTH) + '\n';
      }

      statement.statement.forEach((item: any) => {
        const date = new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        const ref = (item.reference || '').substring(0, 12).padEnd(12);
        const debit = item.debit > 0 ? item.debit.toFixed(3).padStart(10) : ''.padStart(10);
        const credit = item.credit > 0 ? item.credit.toFixed(3).padStart(10) : ''.padStart(10);
        const balanceValue = item.balance;
        const balance = balanceValue < 0
          ? Math.abs(balanceValue).toFixed(3).padStart(9) + '-'
          : balanceValue.toFixed(3).padStart(10);

        const line = date.padEnd(6) + ref + debit + credit + balance;
        text += line.substring(0, LINE_WIDTH) + '\n';
      });
    }

    text += '-'.repeat(LINE_WIDTH) + '\n';
    const merciLine = 'Merci!';
    const padding = Math.floor((LINE_WIDTH - merciLine.length) / 2);
    text += ' '.repeat(padding) + merciLine + '\n';
    text += '='.repeat(LINE_WIDTH) + '\n\n\n\n';

    return text;
  }

  private getTransactionTypeLabelShort(type: string): string {
    const types: { [key: string]: string } = {
      'expense': 'Depense',
      'payment': 'Reglement',
      'bon_entree': 'Bon Entree',
      'credit': 'Credit',
      'advance': 'Acompte',
      'paid': 'Paye',
      'unpaid': 'Impaye',
      'debt': 'Dette'
    };
    return types[type] || type.substring(0, 12);
  }

}
