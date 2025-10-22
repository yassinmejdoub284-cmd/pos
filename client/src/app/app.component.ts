import { Component, OnInit, HostListener } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { AttendanceService } from './core/services/attendance.service';
import { FullscreenService } from './core/services/fullscreen.service';
import { InAppReminderNotificationComponent } from './shared/components/in-app-reminder-notification/in-app-reminder-notification.component';
import { LoadingOverlayComponent } from './shared/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, InAppReminderNotificationComponent, LoadingOverlayComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'pos-patisserie';
  private punchSent = false;

  constructor(
    private authService: AuthService,
    private attendanceService: AttendanceService,
    private fullscreenService: FullscreenService
  ) {}

  ngOnInit(): void {
    // Ensure auth is initialized on app start
    this.authService.getToken();
    
    // Initialize fullscreen service and request fullscreen if user previously chose it
    this.fullscreenService.requestFullscreenOnStartup();
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: BeforeUnloadEvent): void {
    // Fire check-out punch when user closes browser/tab (best effort)
    if (this.authService.isAuthenticated() && !this.punchSent) {
      this.punchSent = true;
      try {
        // Use synchronous XMLHttpRequest for reliable delivery during page unload
        const currentUser = this.authService.currentUser();
        if (currentUser?.id) {
          const data = JSON.stringify({ type: 'CHECK_OUT', userId: currentUser.id });
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${window.location.origin}/api/attendance/punch`, false);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(data);
        }
      } catch (error) {
        console.log('Error calling punch on beforeunload:', error);
      }
    }
  }
}
