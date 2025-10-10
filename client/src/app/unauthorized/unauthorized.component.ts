import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-unauthorized',
  template: `
    <div class="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div class="max-w-md w-full text-center">
        <!-- Icon -->
        <div class="mx-auto h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <svg class="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
        </div>

        <!-- Title -->
        <h1 class="text-3xl font-bold text-gray-900 mb-4">Accès Refusé</h1>
        
        <!-- Message -->
        <p class="text-gray-600 mb-8">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
        </p>

        <!-- User Info -->
        <div class="bg-gray-50 rounded-lg p-4 mb-8">
          <p class="text-sm text-gray-500 mb-2">Connecté en tant que:</p>
          <p class="font-semibold text-gray-800">{{ getCurrentUserDisplay() }}</p>
          <p class="text-sm text-gray-600">{{ getCurrentUserRole() }}</p>
        </div>

        <!-- Actions -->
        <div class="space-y-3">
          <button 
            (click)="goToHome()"
            class="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
            Retour à l'accueil
          </button>
          
          <button 
            (click)="logout()"
            class="w-full bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors">
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  `,
  standalone: false
})
export class UnauthorizedComponent {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  getCurrentUserDisplay(): string {
    const user = this.authService.currentUser();
    return user ? `${user.firstName} ${user.lastName}` : 'Utilisateur inconnu';
  }

  getCurrentUserRole(): string {
    const user = this.authService.currentUser();
    if (!user) return '';
    
    switch (user.role) {
      case 'ADMIN': return 'Administrateur';
      case 'MANAGER': return 'Responsable Magasin';
      case 'CASHIER': return 'Caissier';
      case 'STOCK_MANAGER': return 'Gestionnaire Stock';
      default: return user.role;
    }
  }

  goToHome(): void {
    const user = this.authService.currentUser();
    if (!user) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // Redirect based on role
    switch (user.role) {
      case 'ADMIN':
      case 'MANAGER':
        this.router.navigate(['/home']);
        break;
      case 'CASHIER':
        this.router.navigate(['/caisse']);
        break;
      case 'STOCK_MANAGER':
        this.router.navigate(['/stock']);
        break;
      default:
        this.router.navigate(['/home']);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
