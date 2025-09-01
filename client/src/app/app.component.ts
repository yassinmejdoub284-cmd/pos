import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'pos-patisserie';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Ensure auth is initialized on app start
    this.authService.getToken();
  }
}
