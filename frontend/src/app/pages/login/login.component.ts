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

    const registration = this.loginForm.controls.registration.value.trim();

    try {
      // 1. Busca a lista de usuários e filtra pela matrícula (registration)
      const response = await firstValueFrom(
        this.apiService.get<StudentProfile[] | { items?: StudentProfile[]; data?: StudentProfile[] }>('students')
      );

      const studentsList = Array.isArray(response)
        ? response
        : (response?.items ?? response?.data ?? []);

      const found = studentsList.find(
        (s) => String(s.registration).trim() === registration
      );

      if (found) {
        await this.redirectUser(found);
        return;
      }

      // Matrícula não encontrada na lista -> vai para cadastro
      localStorage.setItem('student_id', registration);
      localStorage.setItem('student_registration', registration);
      await this.router.navigate(['/register'], {
        state: { registration },
      });
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        localStorage.setItem('student_id', registration);
        localStorage.setItem('student_registration', registration);
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

  private async redirectUser(user: StudentProfile): Promise<void> {
    localStorage.setItem('student_id', String(user.id ?? user.registration));
    localStorage.setItem('student_registration', String(user.registration));

    const targetRoute = user.professor ? '/dashboard-professor' : '/dashboard';
    await this.router.navigate([targetRoute], { state: { student: user } });
  }
}
