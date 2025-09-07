import { Component } from '@angular/core';

@Component({
  selector: 'app-documents',
  template: `
    <div class="min-h-screen bg-gradient-to-br from-amber-50 via-blue-50 to-purple-50 p-4">
      <div class="bg-white/90 rounded-xl p-4 border border-gray-200 shadow-lg">
        <h1 class="text-2xl font-bold text-gray-800">Documents & Traces</h1>
        <p class="text-gray-600 text-sm">Liste et filtres à implémenter</p>
      </div>
    </div>
  `,
  standalone: false
})
export class DocumentsComponent {} 