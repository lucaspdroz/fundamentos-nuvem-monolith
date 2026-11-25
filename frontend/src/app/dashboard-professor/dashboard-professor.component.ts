import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  MatDatepickerModule,
  MatCalendarCellClassFunction,
} from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { ApiService } from '../services/api.service';
import { StudentProfile } from '../models/student.model';

export interface ClassStudentRow {
  id: string | number;
  registration: string;
  full_name: string;
  avatar: string;
  presentToday: boolean;
  lastCheckIn?: Date;
}

@Component({
  selector: 'app-dashboard-professor',
  standalone: true,
  imports: [MatDatepickerModule],
  providers: [provideNativeDateAdapter()],
  templateUrl: './dashboard-professor.component.html',
  styleUrl: './dashboard-professor.component.scss',
})
export class DashboardProfessorComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);

  readonly professor = signal<Partial<StudentProfile> | null>(null);
  readonly classStudents = signal<ClassStudentRow[]>([]);
  readonly selectedDate = signal<Date>(new Date());

  readonly presentCount = computed(
    () => this.classStudents().filter((s) => s.presentToday).length
  );

  readonly totalStudents = computed(() => this.classStudents().length);

  readonly dateClass: MatCalendarCellClassFunction<Date> = (cellDate, view) => {
    if (view !== 'month') return '';
    const isToday = this.isSameDay(cellDate, new Date());
    return isToday ? 'day-today-professor' : '';
  };

  ngOnInit(): void {
    this.loadProfessorAndClass();
  }

  private loadProfessorAndClass(): void {
    const state = history.state as { student?: Partial<StudentProfile> };
    const storedId = localStorage.getItem('student_id') ?? '';

    if (state?.student) {
      this.professor.set(state.student);
    } else if (storedId) {
      this.apiService.get<StudentProfile>(`students/${storedId}`).subscribe({
        next: (prof) => this.professor.set(prof),
      });
    }

    // Busca a lista de alunos da turma (com fallback mockado caso o endpoint ainda não exista)
    this.apiService.get<StudentProfile[]>('students').subscribe({
      next: (allUsers) => {
        const currentCourse = this.professor()?.course;
        const studentsOnly: ClassStudentRow[] = (allUsers ?? [])
          .filter((u) => !u.professor && (!currentCourse || u.course === currentCourse))
          .map((u) => ({
            id: u.id ?? u.registration,
            registration: u.registration,
            full_name: u.full_name,
            avatar: u.avatar || '🎓',
            presentToday: false,
          }));

        this.classStudents.set(
          studentsOnly.length > 0 ? studentsOnly : this.getMockedClassStudents()
        );
      },
      error: () => {
        this.classStudents.set(this.getMockedClassStudents());
      },
    });
  }

  toggleStudentPresence(student: ClassStudentRow): void {
    const updatedStatus = !student.presentToday;

    this.classStudents.update((list) =>
      list.map((item) =>
        item.registration === student.registration
          ? {
              ...item,
              presentToday: updatedStatus,
              lastCheckIn: updatedStatus ? new Date() : undefined,
            }
          : item
      )
    );

    if (updatedStatus) {
      this.apiService
        .post(`students/${student.registration}/presences`, { room: 'Sala Professor' })
        .subscribe({ error: () => {} });
    }
  }

  formatTime(date?: Date): string {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  logout(): void {
    localStorage.removeItem('student_id');
    this.router.navigate(['/']);
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private getMockedClassStudents(): ClassStudentRow[] {
    return [
      {
        id: 101,
        registration: '20261001',
        full_name: 'Ana Clara Souza',
        avatar: '👩‍💻',
        presentToday: true,
        lastCheckIn: new Date(),
      },
      {
        id: 102,
        registration: '20261002',
        full_name: 'Pedro Henrique Lima',
        avatar: '🧑‍🎓',
        presentToday: true,
        lastCheckIn: new Date(),
      },
      {
        id: 103,
        registration: '20261003',
        full_name: 'Mariana Costa',
        avatar: '🧉',
        presentToday: false,
      },
      {
        id: 104,
        registration: '20261004',
        full_name: 'Rafael Oliveira',
        avatar: '🎧',
        presentToday: false,
      },
    ];
  }
}
