import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { StudentProfile } from '../models/student.model';

function getStoredUser(): Partial<StudentProfile> | null {
  const raw = localStorage.getItem('current_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<StudentProfile>;
  } catch {
    return null;
  }
}

/**
 * Libera /register SOMENTE quando há uma matrícula validada como inexistente no login.
 * Se já houver usuário logado, envia para o dashboard correspondente.
 */
export const registerGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const currentUser = getStoredUser();

  if (currentUser) {
    return router.createUrlTree([
      currentUser.professor === true ? '/dashboard-professor' : '/dashboard',
    ]);
  }

  const pendingRegistration = sessionStorage.getItem('pending_registration');
  if (!pendingRegistration) {
    return router.createUrlTree(['/']);
  }

  return true;
};

/**
 * Libera /dashboard SOMENTE para alunos autenticados (professor === false).
 */
export const studentDashboardGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const currentUser = getStoredUser();

  if (!currentUser) {
    return router.createUrlTree(['/']);
  }

  if (currentUser.professor === true) {
    return router.createUrlTree(['/dashboard-professor']);
  }

  return true;
};

/**
 * Libera /dashboard-professor SOMENTE para professores autenticados (professor === true).
 */
export const professorDashboardGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const currentUser = getStoredUser();

  if (!currentUser) {
    return router.createUrlTree(['/']);
  }

  if (currentUser.professor !== true) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
