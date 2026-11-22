import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
    registration: ['', [Validators.required, Validators.minLength(4)]],
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
      const student = await firstValueFrom(
        this.apiService.post<Partial<StudentProfile>, { registration: string }>('auth/login', {
          registration,
        })
      );

      if (this.hasCompleteProfile(student)) {
        await this.router.navigate(['/dashboard'], { state: { student } });
      } else {
        // Existe, mas falta algum dado -> vai para criação/completar cadastro
        await this.router.navigate(['/register'], {
          state: { registration, existingStudent: student },
        });
      }
    } catch {
      // Usuário não encontrado (404) -> vai para criação de usuário
      await this.router.navigate(['/register'], {
        state: { registration },
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  private hasCompleteProfile(student: Partial<StudentProfile> | null | undefined): boolean {
    if (!student) return false;
    return Boolean(
      student.full_name?.trim() &&
      student.avatar?.trim() &&
      student.course?.trim() &&
      student.turn?.trim() &&
      student.room?.trim() &&
      student.proffesor?.trim()
    );
  }
}
