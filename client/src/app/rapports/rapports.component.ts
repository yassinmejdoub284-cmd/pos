import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-rapports',
  templateUrl: './rapports.component.html',
  standalone: false
})
export class RapportsComponent {

  constructor(private router: Router) {}

  navigateToDailyExtract() {
    this.router.navigate(['/rapports/daily-extract']);
  }

  navigateToGeneralReports() {
    // For now, show a placeholder message
    alert('Les rapports généraux seront disponibles prochainement.');
  }
} 