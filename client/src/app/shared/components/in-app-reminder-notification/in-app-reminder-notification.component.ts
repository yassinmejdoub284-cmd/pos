import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RemindersService } from '../../../core/services/reminders.service';
import { Reminder } from '../../../core/models/reminder.model';
import { VoicePlayerComponent } from '../voice-player/voice-player.component';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-in-app-reminder-notification',
  template: `
    <!-- In-App Reminder Notification -->
    <div *ngIf="showNotification() && currentReminder()" 
         class="fixed top-4 right-4 z-50 max-w-md w-full animate-slide-in">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5zM9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-800">{{ currentReminder()?.title }}</h3>
              <p class="text-sm text-slate-600">Rappel en cours</p>
            </div>
          </div>
          <button (click)="dismissNotification()" 
                  class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="mb-4">
          <p class="text-slate-700 mb-3">{{ currentReminder()?.description }}</p>
          
          <!-- Status badges -->
          <div class="flex flex-wrap gap-2 mb-3">
            <span class="px-3 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-sm">
              {{ formatDue(currentReminder()?.dueAt) }}
            </span>
            <span *ngIf="isOverdue(currentReminder()?.dueAt)" 
                  class="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm">
              En retard
            </span>
            <span class="px-3 py-1 rounded-xl bg-lime-50 text-lime-700 border border-lime-200 text-sm">
              {{ formatPriority(currentReminder()?.priority) }}
            </span>
          </div>

          <!-- Voice message -->
          <div *ngIf="currentReminder()?.voiceMessageUrl" class="mb-4">
            <app-voice-player 
              [audioUrl]="currentReminder()?.voiceMessageUrl"
              (playbackComplete)="onVoicePlaybackComplete()">
            </app-voice-player>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3">
          <button (click)="markAsRead()" 
                  class="flex-1 h-11 rounded-xl text-white font-medium bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition-all">
            <span>Marquer comme lu</span>
          </button>
          <div class="relative">
            <button (click)="toggleSnoozeMenu()" 
                    class="h-11 px-4 rounded-xl border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 transition-colors">
              <span>Plus tard</span>
            </button>
            <div *ngIf="showSnoozeMenu" 
                 class="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl p-1 z-10">
              <button (click)="onSnooze(10)" 
                      class="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                <span>10 min</span>
              </button>
              <button (click)="onSnooze(30)" 
                      class="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                <span>30 min</span>
              </button>
              <button (click)="onSnooze(120)" 
                      class="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                <span>120 min</span>
              </button>
              <button (click)="onSnoozeDemain()" 
                      class="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                <span>Demain matin</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  standalone: true,
  imports: [CommonModule, VoicePlayerComponent]
})
export class InAppReminderNotificationComponent implements OnInit, OnDestroy {
  public showNotification = signal<boolean>(false);
  public currentReminder = signal<Reminder | null>(null);
  public showSnoozeMenu = signal<boolean>(false);
  
  private checkInterval: Subscription | null = null;
  private lastCheckTime = 0;

  constructor(private remindersService: RemindersService) {}

  ngOnInit(): void {
    // Check for reminders immediately (for any that are already due)
    this.checkForReminders();
    
    // For testing: expose checkForReminders globally
    (window as any).checkReminders = () => this.checkForReminders();
  }

  ngOnDestroy(): void {
    if (this.checkInterval) {
      this.checkInterval.unsubscribe();
    }
  }

  private checkForReminders(): void {
    // Only check if we're not already showing a notification
    if (this.showNotification()) {
      return;
    }

    this.remindersService.fetchDueRespectSnooze().subscribe({
      next: (reminders) => {
        if (reminders && reminders.length > 0) {
          // Show the first reminder
          this.currentReminder.set(reminders[0]);
          this.showNotification.set(true);
          this.showSnoozeMenu.set(false);
        } else {
          // No reminders due now, check for snoozed reminders and set timer for next one
          this.scheduleNextReminderCheck();
        }
      },
      error: (error) => {
        console.error('Error checking for reminders:', error);
        // On error, check again in 5 minutes
        this.scheduleNextReminderCheck(5 * 60 * 1000);
      }
    });
  }

  private scheduleNextReminderCheck(delayMs: number = 0): void {
    // Clear any existing timer
    if (this.checkInterval) {
      this.checkInterval.unsubscribe();
    }

    if (delayMs === 0) {
      // Get the next snooze expiration time from backend
      this.remindersService.getNextSnoozeTime().subscribe({
        next: (snoozeInfo) => {
          if (snoozeInfo.nextSnoozeTime) {
            const nextSnoozeTime = new Date(snoozeInfo.nextSnoozeTime);
            const now = new Date();
            const delay = nextSnoozeTime.getTime() - now.getTime();
            
            if (delay > 0) {
              console.log(`Scheduling next reminder check in ${Math.round(delay / 1000)} seconds (at ${nextSnoozeTime.toLocaleTimeString()})`);
              this.checkInterval = interval(delay).subscribe(() => {
                this.checkForReminders();
              });
            } else {
              // Snooze time has already passed, check immediately
              this.checkForReminders();
            }
          } else {
            // No snoozed reminders, check in 5 minutes as fallback
            console.log('No snoozed reminders found, checking again in 5 minutes');
            this.scheduleNextReminderCheck(5 * 60 * 1000);
          }
        },
        error: (error) => {
          console.error('Error getting next snooze time:', error);
          // Fallback: check in 5 minutes
          this.scheduleNextReminderCheck(5 * 60 * 1000);
        }
      });
    } else {
      // Use provided delay
      console.log(`Scheduling reminder check in ${Math.round(delayMs / 1000)} seconds`);
      this.checkInterval = interval(delayMs).subscribe(() => {
        this.checkForReminders();
      });
    }
  }

  dismissNotification(): void {
    this.showNotification.set(false);
    this.currentReminder.set(null);
    this.showSnoozeMenu.set(false);
  }

  markAsRead(): void {
    const reminder = this.currentReminder();
    if (!reminder) return;

    this.remindersService.markRead(reminder.id).subscribe({
      next: () => {
        this.dismissNotification();
        // Reschedule next check for any remaining reminders
        this.scheduleNextReminderCheck();
      },
      error: (error) => {
        console.error('Error marking reminder as read:', error);
        alert('Erreur lors du marquage comme lu');
      }
    });
  }

  toggleSnoozeMenu(): void {
    this.showSnoozeMenu.set(!this.showSnoozeMenu());
  }

  onSnooze(minutes: number): void {
    const reminder = this.currentReminder();
    if (!reminder) return;

    this.remindersService.snooze(reminder.id, minutes).subscribe({
      next: () => {
        this.dismissNotification();
        this.showSnoozeMenu.set(false);
        // Reschedule next check based on new snooze time
        this.scheduleNextReminderCheck();
      },
      error: (error) => {
        console.error('Error snoozing reminder:', error);
        alert('Erreur lors du report du rappel');
      }
    });
  }

  onSnoozeDemain(): void {
    const reminder = this.currentReminder();
    if (!reminder) return;

    this.remindersService.snooze(reminder.id, undefined, true).subscribe({
      next: () => {
        this.dismissNotification();
        this.showSnoozeMenu.set(false);
        // Reschedule next check based on new snooze time
        this.scheduleNextReminderCheck();
      },
      error: (error) => {
        console.error('Error snoozing reminder:', error);
        alert('Erreur lors du report du rappel');
      }
    });
  }

  onVoicePlaybackComplete(): void {
    // Optional: Auto-dismiss after voice playback
    // this.dismissNotification();
  }

  formatDue(dueAt: string | undefined): string {
    if (!dueAt) return '';
    const date = new Date(dueAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Maintenant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString('fr-FR');
  }

  isOverdue(dueAt: string | undefined): boolean {
    if (!dueAt) return false;
    return new Date(dueAt) < new Date();
  }

  formatPriority(priority: string | undefined): string {
    if (!priority) return 'Normal';
    const map: { [key: string]: string } = {
      'ELEVEE': 'Élevée',
      'NORMAL': 'Normal',
      'FAIBLE': 'Faible'
    };
    return map[priority] || priority;
  }
}
