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
    const state = history.state as {
      registration?: string;
      existingStudent?: Partial<StudentProfile>;
    };

    this.registration = String(
      state?.registration || localStorage.getItem('student_id') || ''
    );

    if (!this.registration) {
      this.router.navigate(['/']);
      return;
    }

    const storedPartial = sessionStorage.getItem('partial_student');
    const existing: Partial<StudentProfile> | undefined =
      state?.existingStudent ?? (storedPartial ? JSON.parse(storedPartial) : undefined);

    if (existing && Object.keys(existing).length > 0) {
      this.existingNumericId = existing.id;
      this.isProfessor = Boolean(existing.professor);
      this.existingCreatedAt = existing.created_at ? new Date(existing.created_at) : this.now;

      this.registerForm.patchValue({
        full_name: existing.full_name ?? '',
        avatar: existing.avatar ?? '🧉',
        presence: existing.presence
          ? this.toDateTimeLocalString(new Date(existing.presence))
          : this.toDateTimeLocalString(this.now),
        course: existing.course ?? '',
        turn: existing.turn ?? 'Noite',
        room: existing.room ?? '',
        proffesor: existing.proffesor ?? '',
        created_at: this.formatDisplayDate(this.existingCreatedAt),
      });
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
      professor: this.isProfessor,
      room: raw.room.trim(),
      proffesor: raw.proffesor.trim(),
      presence: new Date(raw.presence).toISOString(),
    };

    try {
      const savedStudent =
        this.existingNumericId !== undefined
          ? await firstValueFrom(
              this.apiService.update<StudentProfile, StudentUpsertPayload>(
                `students/${this.existingNumericId}`,
                payload
              )
            )
          : await firstValueFrom(
              this.apiService.post<StudentProfile, StudentUpsertPayload>('students', payload)
            );

      await this.finishAndRedirect(savedStudent);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        try {
          const allStudents = await firstValueFrom(
            this.apiService.get<StudentProfile[]>('students')
          );
          const existing = allStudents?.find((s) => s.registration === this.registration);

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
    sessionStorage.removeItem('partial_student');
    localStorage.setItem('student_id', String(user.id ?? this.registration));
    localStorage.setItem('student_registration', user.registration ?? this.registration);

    const targetRoute = user.professor ? '/dashboard-professor' : '/dashboard';
    await this.router.navigate([targetRoute], {
      state: { student: user },
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
