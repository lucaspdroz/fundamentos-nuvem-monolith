import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiService } from '../services/api.service';
import { StudentProfile } from '../models/student.model';

export const registerGateGuard: CanActivateFn = (): Observable<boolean | UrlTree> | UrlTree => {
  const apiService = inject(ApiService);
  const router = inject(Router);

  const navState = router.getCurrentNavigation()?.extras.state as
    | { registration?: string }
    | undefined;

  const identifier = String(
    navState?.registration ||
    localStorage.getItem('student_registration') ||
    localStorage.getItem('student_id') ||
    ''
  ).trim();

  if (!identifier) {
    return router.createUrlTree(['/']);
  }

  const resolveUserRedirect = (user: Partial<StudentProfile>): UrlTree => {
    localStorage.setItem('student_id', String(user.id ?? identifier));
    localStorage.setItem('student_registration', String(user.registration ?? identifier));
    localStorage.setItem('current_user', JSON.stringify(user));
    sessionStorage.removeItem('partial_student');

    const target = user.professor === true ? '/dashboard-professor' : '/dashboard';
    return router.createUrlTree([target]);
  };

  // 1. Tenta buscar diretamente em GET /api/v1/students/{identifier}
  return apiService.get<Partial<StudentProfile>>(`students/${identifier}`).pipe(
    map((user) => resolveUserRedirect(user)),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        // 2. Se deu 404 (porque identifier é 'registration' e não o 'id' numérico),
        // busca na listagem GET /api/v1/students
        return apiService
          .get<StudentProfile[] | { items?: StudentProfile[]; data?: StudentProfile[] }>('students')
          .pipe(
            map((res) => {
              const list = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
              const found = list.find(
                (u) =>
                  String(u.registration).trim() === identifier ||
                  String(u.id).trim() === identifier
              );

              if (found) {
                return resolveUserRedirect(found);
              }

              // Realmente não existe na base -> libera /register para cadastro
              sessionStorage.removeItem('partial_student');
              return true;
            }),
            catchError(() => {
              sessionStorage.removeItem('partial_student');
              return of(true);
            })
          );
      }

      return of(router.createUrlTree(['/']));
    })
  );
};