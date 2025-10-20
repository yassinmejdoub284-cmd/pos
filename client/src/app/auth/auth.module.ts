import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { LoginComponent } from './login/login.component';
import { UnauthorizedComponent } from '../unauthorized/unauthorized.component';
import { UsersComponent } from './users/users.component';
import { AuthRoutingModule } from './auth-routing.module';
import { VoicePlayerComponent } from '../shared/components/voice-player/voice-player.component';

@NgModule({
  declarations: [
    LoginComponent,
    UnauthorizedComponent,
    UsersComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    AuthRoutingModule,
    VoicePlayerComponent
  ]
})
export class AuthModule { }
