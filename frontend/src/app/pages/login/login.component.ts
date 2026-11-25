import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { StudentProfile } from '../../models/student.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    registration: ['', [Validators.required, Validators.minLength(1)]],
  });

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid || this.isLoading()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Limpa estado anterior antes de validar a nova matrícula
    localStorage.removeItem('current_user');
    localStorage.removeItem('student_id');
    localStorage.removeItem('student_registration');
    sessionStorage.removeItem('pending_registration');

    const registration = this.loginForm.controls.registration.value.trim();

    try {
      // 1. Tenta buscar diretamente por ID / matrícula
      const user = await firstValueFrom(
        this.apiService.get<StudentProfile>(`students/${registration}`)
      );

      await this.enterDashboard(user);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        // 2. Fallback: busca na listagem caso o endpoint /students/{id} aceite apenas ID numérico
        try {
          const response = await firstValueFrom(
            this.apiService.get<StudentProfile[] | { items?: StudentProfile[]; data?: StudentProfile[] }>('students')
          );
          const list = Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);
          const found = list.find((s) => String(s.registration).trim() === registration);

          if (found) {
            await this.enterDashboard(found);
            return;
          }
        } catch {
          // Segue para registro se não existir na listagem
        }

        // 3. Não existe na base -> libera /register exclusivamente para cadastro de aluno
        sessionStorage.setItem('pending_registration', registration);
        await this.router.navigate(['/register'], {
          state: { registration },
        });
      } else {
        this.errorMessage.set('Não foi possível conectar ao servidor. Verifique a API.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private async enterDashboard(user: StudentProfile): Promise<void> {
    localStorage.setItem('current_user', JSON.stringify(user));
    localStorage.setItem('student_id', String(user.id ?? user.registration));
    localStorage.setItem('student_registration', String(user.registration));

    const targetRoute = user.professor === true ? '/dashboard-professor' : '/dashboard';
    await this.router.navigate([targetRoute], { state: { student: user } });
  }
}
