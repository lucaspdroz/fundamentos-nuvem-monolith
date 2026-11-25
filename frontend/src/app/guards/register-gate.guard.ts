import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { ApiService } from '../services/api.service';
import { StudentProfile } from '../models/student.model';

function hasCompleteProfile(user: Partial<StudentProfile> | null | undefined): boolean {
  if (!user) return false;
  return Boolean(
    user.full_name?.trim() &&
    user.avatar?.trim() &&
    user.course?.trim() &&
    user.turn?.trim()
  );
}

export const registerGateGuard: CanActivateFn = () => {
  const apiService = inject(ApiService);
  const router = inject(Router);

  const navState = router.getCurrentNavigation()?.extras.state as
    | { registration?: string }
    | undefined;

  const studentId = navState?.registration || localStorage.getItem('student_id') || '';

  // Sem matrícula informada -> bloqueia /register e volta para o login
  if (!studentId) {
    return router.createUrlTree(['/']);
  }

  // Faz o GET /api/v1/students/{student_id} para validar o gate
  return apiService.get<Partial<StudentProfile>>(`students/${studentId}`).pipe(
    map((user) => {
      if (hasCompleteProfile(user)) {
        // Usuário já existe e está completo -> redireciona para o dashboard correto
        const target = user.professor ? '/dashboard-professor' : '/dashboard';
        return router.createUrlTree([target]);
      }

      // Usuário existe mas faltam dados -> libera acesso ao /register e guarda dados parciais
      sessionStorage.setItem('partial_student', JSON.stringify(user));
      return true;
    }),
    catchError((error: unknown) => {
      // 404 (usuário não existe) -> libera acesso ao /register para criação
      if (error instanceof HttpErrorResponse && error.status === 404) {
        sessionStorage.removeItem('partial_student');
        return of(true);
      }

      // Erro de rede/servidor -> volta para o login
      return of(router.createUrlTree(['/']));
    })
  );
};
