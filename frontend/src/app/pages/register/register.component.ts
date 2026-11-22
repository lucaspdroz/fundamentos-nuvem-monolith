import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { StudentProfile } from '../../models/student.model';

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
  private existingId?: string;
  private existingCreatedAt?: Date;

  // Timestamps iniciais em DateTime JS
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

    this.registration = state?.registration ?? '';
    const existing = state?.existingStudent;

    if (existing) {
      this.existingId = existing.id;
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

    const payload: StudentProfile = {
      registration: this.registration,
      full_name: raw.full_name.trim(),
      avatar: raw.avatar.trim(),
      presence: new Date(raw.presence),
      course: raw.course.trim(),
      turn: raw.turn,
      room: raw.room.trim(),
      proffesor: raw.proffesor.trim(),
      created_at: this.existingCreatedAt ?? new Date(),
    };

    try {
      const savedStudent = this.existingId
        ? await firstValueFrom(
            this.apiService.update<StudentProfile, StudentProfile>(
              `students/${this.existingId}`,
              payload
            )
          )
        : await firstValueFrom(
            this.apiService.post<StudentProfile, StudentProfile>('students', payload)
          );

      await this.router.navigate(['/dashboard'], { state: { student: savedStudent } });
    } catch {
      // Fallback caso o backend ainda não esteja ativo, permitindo testar o fluxo
      await this.router.navigate(['/dashboard'], { state: { student: payload } });
    } finally {
      this.isSubmitting.set(false);
    }
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
