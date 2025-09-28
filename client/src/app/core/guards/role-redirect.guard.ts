import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const roleRedirectGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();
  if (!token) {
    router.navigate(['/auth/login']);
    return false;
  }

  const currentUser = authService.currentUser();
  if (currentUser?.role === 'STOCK_MANAGER') {
    router.navigate(['/stock']);
    return false;
  }

  return true;
};
