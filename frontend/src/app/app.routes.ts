import { Routes } from '@angular/router';
import { DashboardProfessorComponent } from './dashboard-professor/dashboard-professor.component';
import { registerGateGuard } from './guards/register-gate.guard';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';

export const routes: Routes = [
  {
    path: '',
    component: LoginComponent,
  },
  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [registerGateGuard],
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
  },
  {
    path: 'dashboard-professor',
    component: DashboardProfessorComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
