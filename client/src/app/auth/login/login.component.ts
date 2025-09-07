import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: false
})
export class LoginComponent implements OnInit {
  credentials = {
    pin: ''
  };
  
  loading = false;
  error = '';
  showPassword = false;
  isShiftPressed = false;
  
  // QWERTY keyboard layout
  qwertyRow1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
  qwertyRow2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
  qwertyRow3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Redirect if already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
    }
  }

  onSubmit(): void {
    if (!this.credentials.pin) {
      this.error = 'Veuillez saisir votre code PIN';
      return;
    }

    if (this.credentials.pin.length < 4) {
      this.error = 'Le code PIN doit contenir au moins 4 chiffres';
      return;
    }

    this.loading = true;
    this.error = '';

    this.authService.login(this.credentials).subscribe({
      next: (response) => {
        console.log('Login successful:', response);
        this.loading = false;
        // Redirect based on user role
        this.redirectBasedOnRole(response.user.role);
      },
      error: (error) => {
        console.error('Login error:', error);
        this.loading = false;
        this.error = error.error?.error || 'Code PIN invalide';
      }
    });
  }

  private redirectBasedOnRole(role: string): void {
    switch (role) {
      case 'ADMIN':
        this.router.navigate(['/home']);
        break;
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

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  getRoleDisplayName(role: string): string {
    switch (role) {
      case 'ADMIN': return 'Administrateur';
      case 'MANAGER': return 'Responsable Magasin';
      case 'CASHIER': return 'Caissier';
      case 'STOCK_MANAGER': return 'Gestionnaire Stock';
      default: return role;
    }
  }

  // Virtual keyboard methods
  addToInput(char: string): void {
    // Only allow numbers for PIN
    if (!/^\d$/.test(char)) {
      return;
    }
    
    // Limit PIN to 8 digits
    if (this.credentials.pin.length >= 8) {
      return;
    }
    
    this.credentials.pin += char;
  }

  backspace(): void {
    if (this.credentials.pin.length > 0) {
      this.credentials.pin = this.credentials.pin.slice(0, -1);
    }
  }

  clearAll(): void {
    this.credentials.pin = '';
  }

  toggleShift(): void {
    this.isShiftPressed = !this.isShiftPressed;
  }
}
