import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Reminder, ReminderVoiceResponse } from '../models/reminder.model';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RemindersService {
  private readonly API_URL = `${environment.apiUrl}/reminders`;

  public pendingReminders = signal<Reminder[]>([]);
  public showing = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  fetchDue(): Observable<Reminder[]> {
    return this.http.get<Reminder[]>(`${this.API_URL}/me/due`).pipe(
      map(reminders => reminders ?? [])
    );
  }

  fetchDueRespectSnooze(): Observable<Reminder[]> {
    return this.http.get<Reminder[]>(`${this.API_URL}/me/due-respect-snooze`).pipe(
      map(reminders => reminders ?? [])
    );
  }

  fetchAll(): Observable<Reminder[]> {
    return this.http.get<Reminder[]>(`${this.API_URL}`).pipe(
      map(reminders => reminders ?? [])
    );
  }

  getNextSnoozeTime(): Observable<{ nextSnoozeTime: string | null; hasSnoozedReminders: boolean }> {
    return this.http.get<{ nextSnoozeTime: string | null; hasSnoozedReminders: boolean }>(`${this.API_URL}/me/next-snooze`);
  }

  markRead(id: number): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/${id}/read`, {});
  }

  snooze(id: number, minutes?: number, demainMatin?: boolean): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/${id}/snooze`, { minutes, demainMatin });
  }

  uploadVoice(id: number, voiceFile: File): Observable<any> {
    const formData = new FormData();
    formData.append('voice', voiceFile);
    return this.http.post(`${this.API_URL}/${id}/voice`, formData);
  }

  postVoiceResponse(id: number, voiceFile: File, duration: number): Observable<ReminderVoiceResponse> {
    const formData = new FormData();
    formData.append('voice', voiceFile);
    formData.append('duration', duration.toString());
    return this.http.post<ReminderVoiceResponse>(`${this.API_URL}/${id}/voice-response`, formData);
  }

  getVoiceResponses(id: number): Observable<ReminderVoiceResponse[]> {
    return this.http.get<ReminderVoiceResponse[]>(`${this.API_URL}/${id}/voice-responses`);
  }
}


