import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { StudentProfile } from '../../models/student.model';

interface StudentUpsertPayload {
  registration: string;
  full_name: string;
  avatar: string;
  course: string;
  turn: string;
  professor: boolean;
  room?: string;
  proffesor?: string;
  presence?: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private registration = '';
  private existingNumericId?: string | number;
  private isProfessor = false;
  private existingCreatedAt?: Date;

  readonly now = new Date();

  readonly registerForm = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(3)]],
    avatar: ['🧉', [Validators.required]],
    presence: [this.toDateTimeLocalString(this.now), [Validators.required]],
    course: ['', [Validators.required]],
    turn: ['Noite', [Validators.required]],
    room: ['', [Validators.required]],
    proffesor: ['', [Validators.required]],
    created_at: [{ value: this.formatDisplayDate(this.now), disabled: true }],
  });

  ngOnInit(): void {
    const state = history.state as { registration?: string };
    this.registration = String(
      state?.registration || sessionStorage.getItem('pending_registration') || ''
    ).trim();

    if (!this.registration) {
      this.router.navigate(['/']);
    }
  }

async onSubmit(): Promise<void> {
    if (this.registerForm.invalid || this.isSubmitting()) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const raw = this.registerForm.getRawValue();

    const payload: StudentUpsertPayload = {
      registration: this.registration,
      full_name: raw.full_name.trim(),
      avatar: raw.avatar.trim(),
      course: raw.course.trim(),
      turn: raw.turn,
      professor: false, // Registro exclusivo para aluno
      room: raw.room.trim(),
      proffesor: raw.proffesor.trim(),
      presence: new Date(raw.presence).toISOString(),
    };

    try {
      const savedStudent = await firstValueFrom(
        this.apiService.post<StudentProfile, StudentUpsertPayload>('students', payload)
      );

      await this.finishAndRedirect(savedStudent);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        try {
          const response = await firstValueFrom(
            this.apiService.get<StudentProfile[] | { items?: StudentProfile[]; data?: StudentProfile[] }>('students')
          );
          const list = Array.isArray(response) ? response : (response?.items ?? response?.data ?? []);
          const existing = list.find((s) => String(s.registration).trim() === this.registration);

          if (existing) {
            await this.finishAndRedirect(existing);
            return;
          }
        } catch {
          // Segue para exibição da mensagem abaixo se falhar
        }

        this.errorMessage.set('Esta matrícula já está cadastrada no sistema.');
        return;
      }

      this.errorMessage.set('Erro ao salvar os dados do aluno. Verifique a conexão com a API.');
    } finally {
      this.isSubmitting.set(false);
    }
}

  private async finishAndRedirect(user: StudentProfile): Promise<void> {
    const normalizedUser: StudentProfile = {
      ...user,
      professor: Boolean(user.professor),
    };

    sessionStorage.removeItem('pending_registration');
    sessionStorage.removeItem('partial_student');

    localStorage.setItem('current_user', JSON.stringify(normalizedUser));
    localStorage.setItem('student_id', String(normalizedUser.id ?? this.registration));
    localStorage.setItem('student_registration', String(normalizedUser.registration ?? this.registration));

    const targetRoute = normalizedUser.professor ? '/dashboard-professor' : '/dashboard';
    await this.router.navigate([targetRoute], {
      state: { student: normalizedUser },
    });
  }

  private toDateTimeLocalString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private formatDisplayDate(date: Date): string {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
