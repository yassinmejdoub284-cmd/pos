import { Component, OnInit, HostListener } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { FullscreenService } from './core/services/fullscreen.service';
import { LoadingOverlayComponent } from './shared/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, LoadingOverlayComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Samurai Food';

  constructor(
    private authService: AuthService,
    private fullscreenService: FullscreenService
  ) {}

  ngOnInit(): void {
    // Ensure auth is initialized on app start - loadStoredAuth is called in constructor
    // but we also ensure token is available and signals are properly set
    const token = this.authService.getToken();
    const userStr = sessionStorage.getItem('user');
    
    if (token && userStr) {
      // Double-check that signals are set
      if (!this.authService.isAuthenticated() || !this.authService.currentUser()) {
        try {
          const user = JSON.parse(userStr);
          const permissionsStr = sessionStorage.getItem('permissions');
          const permissions = permissionsStr ? JSON.parse(permissionsStr) : null;
          
          // Set signals immediately
          this.authService.currentUser.set(user);
          this.authService.isAuthenticated.set(true);
          
          // Also update subjects if available
          const service = this.authService as any;
          if (service.currentUserSubject) {
            service.currentUserSubject.next(user);
          }
          if (service.permissionsSubject && permissions) {
            service.permissionsSubject.next(permissions);
          }
        } catch (error) {
          console.error('Error reloading auth state in app component:', error);
          // If parsing fails, auth service will handle it
        }
      }
    }
    
    // Initialize fullscreen service and request fullscreen if user previously chose it
    this.fullscreenService.requestFullscreenOnStartup();
  }

}
