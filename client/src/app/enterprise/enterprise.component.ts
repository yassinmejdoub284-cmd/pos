import { Component } from '@angular/core';

@Component({
  selector: 'app-enterprise',
  standalone: false,
  template: `
    <div class="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <!-- Header -->
      <div class="bg-white/80 border-b border-gray-200/50 sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-6 py-4">
          <div class="flex items-center justify-between">
            <!-- Breadcrumb -->
            <nav class="flex items-center space-x-2 text-sm">
              <span class="text-gray-500">Entreprise</span>
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
              <span class="text-gray-700 font-medium">Sociétés</span>
            </nav>
            
            <!-- Title -->
            <h1 class="text-2xl font-bold text-gray-800">Gestion d'Entreprise</h1>
            
            <!-- Actions will be handled by child components -->
            <div class="w-32"></div>
          </div>
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="max-w-7xl mx-auto px-6 py-8">
        <router-outlet></router-outlet>
      </div>
    </div>
  `
})
export class EnterpriseComponent { }
