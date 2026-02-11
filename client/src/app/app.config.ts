import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, withInterceptors } from '@angular/common/http';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptorsFromDi(),
      withInterceptors([loadingInterceptor, authInterceptor])
    ),
    provideCharts(withDefaultRegisterables()),
    provideServiceWorker('custom-sw.js', {
      enabled: true, // Enable in all environments for PWA testing
      registrationStrategy: 'registerWhenStable:3000'
    })
  ]
};
