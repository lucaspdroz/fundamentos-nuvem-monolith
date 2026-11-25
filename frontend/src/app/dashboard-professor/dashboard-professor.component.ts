import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import {
  MatDatepickerModule,
  MatCalendarCellClassFunction,
} from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { ApiService } from '../services/api.service';
import { StudentProfile } from '../models/student.model';
import { Component, computed, inject, OnInit, signal } from '@angular/core';

export interface ClassStudentRow {
  id: string | number;
  registration: string;
  full_name: string;
  avatar: string;
  presentToday: boolean;
  lastCheckIn?: Date;
}

interface PresenceApiItem {
  id: number;
  presence: string;
  room: string;
  created_at: string;
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
  readonly isLoadingClass = signal(false);

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

  onDateSelected(date: Date | null): void {
    if (!date) return;
    this.selectedDate.set(date);
    this.loadClassStudents(this.professor());
  }

  private loadProfessorAndClass(): void {
    const state = history.state as { student?: Partial<StudentProfile> };
    const storedUserRaw = localStorage.getItem('current_user');
    const cachedProf: Partial<StudentProfile> | null = storedUserRaw
      ? JSON.parse(storedUserRaw)
      : null;

    const initialProf = state?.student ?? cachedProf;
    const storedId = localStorage.getItem('student_id') ?? '';

    if (initialProf) {
      this.professor.set(initialProf);
      localStorage.setItem('current_user', JSON.stringify(initialProf));
    }

    // 1. Garante os dados atualizados do professor ANTES de filtrar a turma
    const professor$: Observable<Partial<StudentProfile> | null> = initialProf
      ? of(initialProf)
      : storedId
        ? this.apiService.get<StudentProfile>(`students/${storedId}`).pipe(
            catchError(() => of(null))
          )
        : of(null);

    this.isLoadingClass.set(true);

    professor$.subscribe((prof) => {
      if (prof) {
        this.professor.set(prof);
        localStorage.setItem('current_user', JSON.stringify(prof));
      }
      this.loadClassStudents(prof);
    });
  }

  private loadClassStudents(prof: Partial<StudentProfile> | null): void {
    const targetDate = this.selectedDate();

    this.apiService
      .get<StudentProfile[] | { items?: StudentProfile[]; data?: StudentProfile[] }>('students')
      .pipe(
        switchMap((res) => {
          const allUsers = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
          const currentCourse = prof?.course?.trim().toLowerCase();

          const filteredStudents = allUsers.filter(
            (u) =>
              !u.professor &&
              (!currentCourse || u.course?.trim().toLowerCase() === currentCourse)
          );

          if (filteredStudents.length === 0) {
            return of(this.getMockedClassStudents());
          }

          // Consulta as presenças reais de cada aluno na data selecionada
          const studentChecks$ = filteredStudents.map((u) =>
            this.apiService.get<PresenceApiItem[]>(`students/${u.registration}/presences`).pipe(
              map((presences) => {
                const list = Array.isArray(presences) ? presences : [];
                const match = list.find((p) => this.isSameDay(new Date(p.presence), targetDate));

                return {
                  id: u.id ?? u.registration,
                  registration: u.registration,
                  full_name: u.full_name,
                  avatar: u.avatar || '🎓',
                  presentToday: Boolean(match),
                  lastCheckIn: match ? new Date(match.presence) : undefined,
                } satisfies ClassStudentRow;
              }),
              catchError(() =>
                of({
                  id: u.id ?? u.registration,
                  registration: u.registration,
                  full_name: u.full_name,
                  avatar: u.avatar || '🎓',
                  presentToday: false,
                } satisfies ClassStudentRow)
              )
            )
          );

          return forkJoin(studentChecks$);
        }),
        catchError(() => of(this.getMockedClassStudents()))
      )
      .subscribe((rows) => {
        this.classStudents.set(rows);
        this.isLoadingClass.set(false);
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
        .post(`students/${student.registration}/presences`, {
          room: this.professor()?.room || 'Sala Professor',
        })
        .subscribe({ error: () => {} });
    }
  }

  formatTime(date?: Date): string {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  logout(): void {
    localStorage.removeItem('student_id');
    localStorage.removeItem('student_registration');
    localStorage.removeItem('current_user');
    sessionStorage.removeItem('partial_student');
    this.router.navigate(['/']);
  }

  private isSameDay(a: Date, b: Date): boolean {
    const d1 = new Date(a);
    const d2 = new Date(b);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
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
