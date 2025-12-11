import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { AttendanceService } from '../core/services/attendance.service';
import { AuthService } from '../core/services/auth.service';
import { Router } from '@angular/router';

interface TodayStatus {
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  isCheckedIn: boolean;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  workedSeconds: number;
  overtimeSeconds: number;
  isLate: boolean;
  isComplete: boolean;
  punches: Array<{
    type: string;
    timestamp: string;
    time: string;
  }>;
}

interface UserTodayStatus {
  userId: number;
  firstName: string;
  lastName: string;
  depotId: number | null;
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  isCheckedIn: boolean;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  workedSeconds: number;
  overtimeSeconds: number;
  isLate: boolean;
  isComplete: boolean;
  punches: Array<{
    type: string;
    timestamp: string;
    time: string;
  }>;
}

@Component({
  selector: 'app-pointage',
  templateUrl: './pointage.component.html',
  standalone: false
})
export class PointageComponent implements OnInit, OnDestroy {
  private attendanceService = inject(AttendanceService);
  private authService = inject(AuthService);
  private router = inject(Router);

  todayStatus: TodayStatus | null = null;
  allUsersStatus: UserTodayStatus[] = [];
  loading = false;
  error = '';
  currentUser = this.authService.currentUser();
  currentTime = new Date();
  private timeInterval: any;

  ngOnInit(): void {
    this.loadTodayStatus();
    this.timeInterval = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  loadTodayStatus(): void {
    this.loading = true;
    this.error = '';
    this.attendanceService.getTodayStatus().subscribe({
      next: (data) => {
        this.todayStatus = data;
        this.loadAllUsersStatus();
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement du statut';
        this.loading = false;
      }
    });
  }

  loadAllUsersStatus(): void {
    this.attendanceService.getAllUsersTodayStatus().subscribe({
      next: (data) => {
        this.allUsersStatus = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
      }
    });
  }

  checkIn(): void {
    this.loading = true;
    this.attendanceService.punch('CHECK_IN').subscribe({
      next: () => {
        this.loadTodayStatus();
        this.loadAllUsersStatus();
      },
      error: (err) => {
        this.error = 'Erreur lors de l\'enregistrement de l\'entrée';
        this.loading = false;
      }
    });
  }

  checkOut(): void {
    this.loading = true;
    this.attendanceService.punch('CHECK_OUT').subscribe({
      next: () => {
        this.loadTodayStatus();
        this.loadAllUsersStatus();
      },
      error: (err) => {
        this.error = 'Erreur lors de l\'enregistrement de la sortie';
        this.loading = false;
      }
    });
  }

  formatTime(value: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0h 00m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }

  formatCurrentDate(): string {
    return this.currentTime.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  formatCurrentTime(): string {
    return this.currentTime.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }

  get todayPunches(): Array<{ type: string; timestamp: string; time: string }> {
    return this.todayStatus?.punches || [];
  }

  goToHistory(): void {
    this.router.navigate(['/pointage/history']);
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }
}

