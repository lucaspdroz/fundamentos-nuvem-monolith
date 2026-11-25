import { Routes } from '@angular/router';
import { DashboardProfessorComponent } from './dashboard-professor/dashboard-professor.component';
import {
  professorDashboardGuard,
  registerGuard,
  studentDashboardGuard,
} from './guards/auth.guards';
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
    canActivate: [registerGuard],
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [studentDashboardGuard],
  },
  {
    path: 'dashboard-professor',
    component: DashboardProfessorComponent,
    canActivate: [professorDashboardGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
