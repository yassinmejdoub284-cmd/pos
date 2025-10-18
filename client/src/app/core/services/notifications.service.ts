import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  data?: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private readonly API_URL = `${environment.apiUrl}/notifications`;

  public unreadCount = signal<number>(0);
  public notifications = signal<Notification[]>([]);

  constructor(private http: HttpClient) {}

  fetchUnread(): Observable<Notification[]> {
    console.log('NotificationsService: fetchUnread called, API_URL:', this.API_URL);
    return this.http.get<Notification[]>(`${this.API_URL}/unread`).pipe(
      tap(notifications => console.log('NotificationsService: fetchUnread success:', notifications)),
      catchError(error => {
        console.error('NotificationsService: fetchUnread error:', error);
        throw error;
      })
    );
  }

  fetchAll(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.API_URL}`);
  }

  markAsRead(id: number): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/${id}/read`, {});
  }

  markAllAsRead(): Observable<void> {
    return this.http.post<void>(`${this.API_URL}/read-all`, {});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  updateUnreadCount(): void {
    console.log('NotificationsService: updateUnreadCount called');
    this.fetchUnread().subscribe({
      next: (notifications) => {
        console.log('NotificationsService: updateUnreadCount success, count:', notifications.length, 'notifications:', notifications);
        this.unreadCount.set(notifications.length);
        this.notifications.set(notifications);
      },
      error: (error) => {
        console.error('NotificationsService: updateUnreadCount error:', error);
        this.unreadCount.set(0);
        this.notifications.set([]);
      }
    });
  }
}
