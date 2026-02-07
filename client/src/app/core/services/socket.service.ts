import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface SocketEvent {
  type: string;
  data: any;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;
  private readonly SOCKET_URL = environment.socketUrl;
  private isConnecting = false;
  private lastErrorLogTs = 0;
  
  public isConnected = signal(false);
  public connectionStatus = new BehaviorSubject<'connected' | 'disconnected' | 'connecting'>('disconnected');

  constructor(private authService: AuthService) {}

  connect(): void {
    if (!environment.enableRealtime) return;
    if (this.socket?.connected || this.isConnecting) return;

    const token = this.authService.getToken();
    if (!token) return;

    this.connectionStatus.next('connecting');
    this.isConnecting = true;
    
    this.socket = io(this.SOCKET_URL, {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 6,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 8000
    });

    this.socket.on('connect', () => {
      this.isConnected.set(true);
      this.connectionStatus.next('connected');
      this.isConnecting = false;
    });

    this.socket.on('disconnect', () => {
      this.isConnected.set(false);
      this.connectionStatus.next('disconnected');
      this.isConnecting = false;
    });

    this.socket.on('connect_error', (error) => {
      // Throttle noisy error logging (max once per 5s)
      const now = Date.now();
      if (now - this.lastErrorLogTs > 5000) {
        try { console.warn('Socket connection error:', error?.message || error); } catch {}
        this.lastErrorLogTs = now;
      }
      this.connectionStatus.next('disconnected');
      this.isConnecting = false;
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected.set(false);
      this.connectionStatus.next('disconnected');
    }
  }

  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event: string): Observable<any> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on(event, (data) => {
          observer.next(data);
        });
      }
    });
  }

  onStockUpdate(): Observable<any> {
    return this.on('stock_update');
  }

  onSaleCreated(): Observable<any> {
    return this.on('sale_created');
  }

  onTicketCreated(): Observable<any> {
    return this.on('ticket_created');
  }



  onNotification(): Observable<any> {
    return this.on('notification');
  }

  joinDepot(depotId: number): void {
    this.emit('join_depot', { depotId });
  }

  leaveDepot(depotId: number): void {
    this.emit('leave_depot', { depotId });
  }


} 