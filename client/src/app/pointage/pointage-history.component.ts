import { Component } from '@angular/core';
import { AttendanceService, AttendanceFilters } from '../core/services/attendance.service';
import { UsersService, User } from '../core/services/users.service';

@Component({
  selector: 'app-pointage-history',
  templateUrl: './pointage-history.component.html',
  standalone: false
})
export class PointageHistoryComponent {
  // Filters (skeleton)
  period: 'TODAY' | 'WEEK' | 'CUSTOM' = 'TODAY';
  startDate = '';
  endDate = '';
  employeeId: number | null = null;
  departmentId: number | null = null;
  quickToggle: 'PRESENCES' | 'RETARDS' | 'ABSENCES' | 'OVERTIME' | null = null;
  // Top bar controls
  searchQuery = '';
  departmentFilter: string | null = null;

  // Summary totals (placeholder)
  totals = {
    workedHours: 0,
    overtimeHours: 0,
    lateCount: 0,
    absenceCount: 0,
    pausesHours: 0
  };

  // Table data placeholder
  rows: Array<{
    employeeId: number;
    employeeName: string;
    department?: string;
    date: string;
    firstCheckIn?: string;
    lastCheckOut?: string;
    pausesSeconds?: number;
    workedSeconds?: number;
    overtimeSeconds?: number;
    isLate?: boolean;
    isAbsent?: boolean;
    isComplete?: boolean;
    status?: 'COMPLET' | 'INCOMPLET' | 'ABSENCE';
  }> = [];

  // UI state
  loading = false;
  error = '';
  showDetailsFor: { 
    employeeId: number; 
    employeeName: string;
    firstLogin?: string;
    lastLogout?: string;
    loginHistory: Array<{
      date: string;
      loginTime: string;
      logoutTime?: string;
    }>;
  } | null = null;
  showCorrectionModal = false;
  correctionComment = '';
  correctionProposal = { firstIn: '', lastOut: '', pauses: '' };

  allUsers: User[] = [];

  constructor(private attendanceService: AttendanceService, private usersService: UsersService) {}

  refresh(): void {
    this.loading = true;
    const filters: AttendanceFilters = {
      startDate: this.startDate || new Date().toISOString().slice(0, 10),
      endDate: this.endDate || new Date().toISOString().slice(0, 10),
      employeeId: this.employeeId,
      department: this.departmentId ? String(this.departmentId) : null,
      view: this.quickToggle
    };
    this.attendanceService.getHistory(filters).subscribe({
      next: (data) => {
        this.totals = data?.totals || this.totals;
        this.rows = data?.rows || [];
        // hydrate departments/names from users if missing
        this.hydrateFromUsers();
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur lors du chargement du pointage';
        this.loading = false;
      }
    });
  }

  goBackToChoice(): void {
    history.back();
  }

  ngOnInit(): void {
    this.usersService.getUsers().subscribe({
      next: (users) => { this.allUsers = users || []; this.hydrateFromUsers(); },
      error: () => {}
    });
  }

  private hydrateFromUsers(): void {
    if (!this.allUsers?.length || !this.rows?.length) return;
    const byId: Record<number, User> = {} as any;
    for (const u of this.allUsers) byId[u.id] = u as any;
    for (const r of this.rows) {
      const u = byId[r.employeeId];
      if (u) {
        r.employeeName = r.employeeName || `${u.firstName} ${u.lastName}`;
        r.department = r.department || (u as any).department || undefined;
      }
    }
  }

  setPeriod(p: 'TODAY' | 'WEEK' | 'CUSTOM'): void {
    this.period = p;
    const today = new Date();
    if (p === 'TODAY') {
      const d = today.toISOString().slice(0, 10);
      this.startDate = d;
      this.endDate = d;
    } else if (p === 'WEEK') {
      const day = today.getDay() || 7; // Monday as 1
      const monday = new Date(today);
      monday.setDate(today.getDate() - (day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      this.startDate = monday.toISOString().slice(0, 10);
      this.endDate = sunday.toISOString().slice(0, 10);
    }
  }

  private getTotalDaysInRange(): number {
    if (!this.startDate || !this.endDate) return 0;
    const a = new Date(this.startDate + 'T00:00:00');
    const b = new Date(this.endDate + 'T00:00:00');
    const millis = b.getTime() - a.getTime();
    if (millis < 0) return 0;
    return Math.floor(millis / (1000 * 60 * 60 * 24)) + 1;
  }

  exportCsv(): void {
    const filters: AttendanceFilters = {
      startDate: this.startDate,
      endDate: this.endDate,
      employeeId: this.employeeId,
      department: this.departmentId ? String(this.departmentId) : null,
      view: this.quickToggle
    };
    this.attendanceService.export('csv', filters).subscribe((blob) => this.saveBlob(blob, 'pointage.csv'));
  }

  exportPdf(): void {
    const filters: AttendanceFilters = {
      startDate: this.startDate,
      endDate: this.endDate,
      employeeId: this.employeeId,
      department: this.departmentId ? String(this.departmentId) : null,
      view: this.quickToggle
    };
    this.attendanceService.export('pdf', filters).subscribe((blob) => this.saveBlob(blob, 'pointage.pdf'));
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  openDetails(emp: any): void {
    // Mock data for login/logout details - replace with actual API call
    const mockLoginHistory = [
      { date: '2024-01-15', loginTime: '08:30', logoutTime: '17:45' },
      { date: '2024-01-14', loginTime: '08:45', logoutTime: '18:00' },
      { date: '2024-01-13', loginTime: '09:00', logoutTime: '17:30' },
      { date: '2024-01-12', loginTime: '08:15', logoutTime: '17:15' },
      { date: '2024-01-11', loginTime: '08:30', logoutTime: '18:30' }
    ];
    
    this.showDetailsFor = { 
      employeeId: emp.employeeId, 
      employeeName: emp.employeeName,
      firstLogin: '08:30',
      lastLogout: '17:45',
      loginHistory: mockLoginHistory
    };
  }

  closeDetails(): void {
    this.showDetailsFor = null;
  }

  openCorrection(): void {
    this.showCorrectionModal = true;
  }

  submitCorrection(): void {
    if (!this.showDetailsFor || !this.correctionComment.trim()) return;
    const payload = {
      employeeId: this.showDetailsFor.employeeId,
      date: new Date().toISOString().slice(0, 10), // Use current date as fallback
      comment: this.correctionComment,
      proposed: this.correctionProposal
    };
    this.attendanceService.requestCorrection(payload).subscribe({
      next: () => {
        this.showCorrectionModal = false;
        this.correctionComment = '';
        this.correctionProposal = { firstIn: '', lastOut: '', pauses: '' };
      },
      error: () => {
        // keep modal open; could show error toast
      }
    });
  }

  // Formatters
  formatTime(value?: string): string {
    if (!value) return '-';
    const d = new Date(value);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatH(seconds?: number): string {
    if (!seconds || seconds <= 0) return '0h';
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
  }

  // Grid card aggregation view (like employee tiles)
  get employeeCards(): Array<{
    employeeId: number;
    employeeName: string;
    avatarUrl?: string;
    department?: string;
    attendancePct: number;
    presentDays: number;
    totalDays: number;
    lateCount: number;
    overtimeHours: number;
    status: 'good' | 'warn' | 'bad';
    displayId: string;
  }> {
    // Aggregate attendance rows by employee
    const agg = new Map<number, { name?: string; dept?: string; present: number; total: number; late: number; overtimeSec: number }>();
    for (const r of this.rows) {
      const rec = agg.get(r.employeeId) || { name: r.employeeName, dept: r.department, present: 0, total: 0, late: 0, overtimeSec: 0 };
      rec.total += 1;
      if (!r.isAbsent) rec.present += 1;
      if (r.isLate) rec.late += 1;
      rec.overtimeSec += r.overtimeSeconds || 0;
      if (!rec.dept && r.department) rec.dept = r.department;
      if (!rec.name && r.employeeName) rec.name = r.employeeName;
      agg.set(r.employeeId, rec);
    }

    const totalDaysInRange = this.getTotalDaysInRange();

    // Build cards for ALL users (even without rows)
    return (this.allUsers || []).map(u => {
      const a = agg.get(u.id);
      const present = a?.present || 0;
      const total = a?.total || totalDaysInRange; // show the period length even if no rows
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;
      const status: 'good' | 'warn' | 'bad' = total === 0 ? 'warn' : (pct >= 95 ? 'good' : pct >= 80 ? 'warn' : 'bad');
      return {
        employeeId: u.id,
        employeeName: `${u.firstName} ${u.lastName}`.trim(),
        department: a?.dept,
        attendancePct: pct,
        presentDays: present,
        totalDays: total,
        lateCount: a?.late || 0,
        overtimeHours: Math.round(((a?.overtimeSec || 0) / 3600) * 10) / 10,
        status,
        displayId: `#${String(u.id).padStart(5, '0')}`
      };
    });
  }

  get departments(): string[] {
    const set = new Set<string>();
    for (const r of this.rows) {
      if (r.department) set.add(r.department);
    }
    return Array.from(set.values()).sort();
  }

  get filteredEmployeeCards() {
    const q = this.searchQuery.trim().toLowerCase();
    const empId = this.employeeId;
    return this.employeeCards.filter(e => {
      const matchesQ = !q || e.employeeName.toLowerCase().includes(q) || e.displayId.toLowerCase().includes(q);
      const matchesEmp = !empId || (e.employeeId === empId);
      return matchesQ && matchesEmp;
    });
  }
}

