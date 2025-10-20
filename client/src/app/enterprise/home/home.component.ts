import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-enterprise-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: false
})
export class EnterpriseHomeComponent implements OnInit, OnDestroy {
  // Sidebar state
  sidebarCollapsed = false;
  activeSection = 'dashboard';
  invoicesMenuOpen = true;

  // User info
  currentUser: any = null;

  // Billing Software theme colors (pastel palette)
  readonly BILLING_THEME = {
    primaryColor: '#E8F4FD', // Light blue
    secondaryColor: '#F0F8FF', // Alice blue
    accentColor: '#B8E6B8', // Light green
    textColor: '#4A5568', // Dark gray
    sidebarBg: '#F7FAFC', // Very light gray
    sidebarHover: '#EDF2F7', // Light gray
    cardBg: '#FFFFFF', // White
    borderColor: '#E2E8F0', // Light border
    successColor: '#C6F6D5', // Light green
    warningColor: '#FEF5E7', // Light orange
    errorColor: '#FED7D7', // Light red
    infoColor: '#BEE3F8' // Light blue
  };

  private readonly document = inject(DOCUMENT);
  private originalFaviconHref: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Apply billing theme favicon
    this.applyBillingFavicon();

    // Get current user
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.userType !== 'enterprise') {
        // Redirect to regular home if not enterprise user
        this.router.navigate(['/home']);
      }
    });

    // Check if user is authenticated
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login']);
    }
  }

  ngOnDestroy(): void {
    this.restoreOriginalFavicon();
  }

  // Sidebar navigation methods
  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  navigateToSection(section: string): void {
    this.activeSection = section;
    // TODO: Implement navigation logic for each section
    console.log('Navigating to:', section);
  }

  toggleInvoicesMenu(event?: Event): void {
    if (event) event.stopPropagation();
    this.invoicesMenuOpen = !this.invoicesMenuOpen;
  }

  // Navigation methods for each section

  goToClients(): void {
    this.navigateToSection('clients');
  }

  goToPurchases(): void {
    this.navigateToSection('purchases');
  }

  goToInvoices(): void {
    this.navigateToSection('invoices');
  }

  goToImportDailyExtract(): void {
    this.navigateToSection('import-daily-extract');
  }

  goToCreateInvoice(): void {
    this.navigateToSection('create-invoice');
  }

  goToApprovedInvoices(): void {
    this.navigateToSection('approved-invoices');
  }

  goToStock(): void {
    this.navigateToSection('stock');
  }

  goToArticles(): void {
    this.navigateToSection('articles');
  }

  // User actions
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  // Favicon management
  private applyBillingFavicon(): void {
    const head = this.document.head;
    let linkEl = head.querySelector<HTMLLinkElement>("link[rel='icon']");

    if (!linkEl) {
      linkEl = this.document.createElement('link');
      linkEl.setAttribute('rel', 'icon');
      head.appendChild(linkEl);
    }

    this.originalFaviconHref = linkEl.getAttribute('href');
    linkEl.setAttribute('href', '/logo_billing.svg');
  }

  private restoreOriginalFavicon(): void {
    if (this.originalFaviconHref == null) return;
    const head = this.document.head;
    const linkEl = head.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (linkEl) {
      linkEl.setAttribute('href', this.originalFaviconHref);
    }
    this.originalFaviconHref = null;
  }
}
