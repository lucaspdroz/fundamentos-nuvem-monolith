import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import {
  MatCalendar,
  MatDatepickerModule,
  MatCalendarCellClassFunction,
} from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Observable, of, delay } from 'rxjs';
import { ApiService } from '../../services/api.service';
import {
  AttendanceRecord,
  ReminderNotification,
  StudentData,
  StudentProfile,
} from '../../models/student.model';

interface PresenceApiItem {
  id: number;
  presence: string;
  room: string;
  created_at: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatDatepickerModule],
  providers: [provideNativeDateAdapter()],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly apiService = inject(ApiService);

  @ViewChild(MatCalendar) calendar?: MatCalendar<Date>;

  readonly student = signal<StudentData | null>(null);
  readonly notifications = signal<ReminderNotification[]>([]);
  readonly isCheckingIn = signal(false);
  readonly showAbsenceAlert = signal(false);
  readonly slideProgress = signal(0);

  private currentRoom = 'Sala Padrão';
  private currentCourse = 'Aula';

  readonly totalAbsences = computed(() => {
    const list = this.student()?.attendanceList ?? [];
    return list.filter((item) => !item.present && !this.isSameDay(item.date, new Date())).length;
  });

  readonly isTodayConfirmed = computed(() => {
    const today = this.student()?.attendanceList.find((item) =>
      this.isSameDay(item.date, new Date())
    );
    return today?.present ?? false;
  });

  readonly dateClass: MatCalendarCellClassFunction<Date> = (cellDate, view) => {
    if (view !== 'month') return '';

    const record = this.student()?.attendanceList.find((item) =>
      this.isSameDay(item.date, cellDate)
    );

    if (!record) return 'day-non-class';

    const isToday = this.isSameDay(cellDate, new Date());

    if (isToday) {
      return record.present ? 'day-today-confirmed' : 'day-today-pending';
    }

    return record.present ? 'day-present' : 'day-absent';
  };

  ngOnInit(): void {
    this.loadStudentData();
    this.loadMockedNotifications();
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

  private normalizePresencesResponse(response: unknown): PresenceApiItem[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (response && typeof response === 'object') {
      const obj = response as Record<string, unknown>;
      if (Array.isArray(obj['presences'])) return obj['presences'];
      if (Array.isArray(obj['items'])) return obj['items'];
      if (Array.isArray(obj['data'])) return obj['data'];
      if (Array.isArray(obj['results'])) return obj['results'];
    }

    return [];
  }

  private mapApiPresencesToRecords(rawResponse: unknown): AttendanceRecord[] {
    const items = this.normalizePresencesResponse(rawResponse);
    const today = new Date();

    const mapped: AttendanceRecord[] = items.map((item) => {
      const itemDate = new Date(item.presence);
      return {
        id: String(item.id),
        date: itemDate,
        className: `${this.currentCourse} (${item.room})`,
        present: true,
        isToday: this.isSameDay(itemDate, today),
      };
    });

    const hasTodayRecord = mapped.some((rec) => this.isSameDay(rec.date, today));
    if (!hasTodayRecord) {
      mapped.push({
        id: 'today-pending',
        date: today,
        className: `${this.currentCourse} (${this.currentRoom})`,
        present: false,
        isToday: true,
      });
    }

    return mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private loadStudentData(): void {
    const state = history.state as { student?: Partial<StudentProfile> };
    const stateStudent = state?.student;

    const registration = String(
      stateStudent?.registration ||
      stateStudent?.id ||
      localStorage.getItem('student_id') ||
      ''
    );

    if (stateStudent?.room) this.currentRoom = stateStudent.room;
    if (stateStudent?.course) this.currentCourse = stateStudent.course;

    if (!registration) {
      this.student.set(this.getFallbackStudentData());
      this.calendar?.updateTodaysDate();
      this.checkAbsenceThreshold();
      return;
    }

    // GET /api/v1/students/{registration}/presences
    this.apiService.get<PresenceApiItem[]>(`students/${registration}/presences`).subscribe({
      next: (presences) => {
        const attendanceList = this.mapApiPresencesToRecords(presences ?? []);

        this.student.set({
          id: String(stateStudent?.id ?? registration),
          name: stateStudent?.full_name ?? 'Aluno',
          registration,
          avatarUrl: stateStudent?.avatar?.startsWith('http') ? stateStudent.avatar : undefined,
          attendanceList,
        });

        this.calendar?.updateTodaysDate();
        this.checkAbsenceThreshold();
      },
      error: () => {
        this.student.set(this.getFallbackStudentData(registration, stateStudent?.full_name));
        this.calendar?.updateTodaysDate();
        this.checkAbsenceThreshold();
      },
    });
  }

  private loadMockedNotifications(): void {
    const mockRequest$: Observable<ReminderNotification[]> = of([
      { id: '1', title: 'Entrega do projeto final hoje às 23:59', type: 'alert' as const },
      { id: '2', title: 'Aula prática no Laboratório 04', type: 'info' as const },
    ]).pipe(delay(250));

    mockRequest$.subscribe((items) => this.notifications.set(items));
  }

  private checkAbsenceThreshold(): void {
    if (this.totalAbsences() > 5) {
      this.slideProgress.set(0);
      this.showAbsenceAlert.set(true);
    }
  }

  onCheckPresence(): void {
    const currentStudent = this.student();
    if (!currentStudent || this.isTodayConfirmed() || this.isCheckingIn()) return;

    this.isCheckingIn.set(true);

    // POST /api/v1/students/{registration}/presences com body { "room": "string" }
    this.apiService
      .post<PresenceApiItem, { room: string }>(
        `students/${currentStudent.registration}/presences`,
        { room: this.currentRoom }
      )
      .subscribe({
        next: (created) => this.confirmTodayPresence(created),
        error: () => this.confirmTodayPresence(),
      });
  }

  private confirmTodayPresence(created?: PresenceApiItem): void {
    const today = new Date();

    this.student.update((current) => {
      if (!current) return null;

      return {
        ...current,
        attendanceList: current.attendanceList.map((item) =>
          this.isSameDay(item.date, today)
            ? {
                ...item,
                id: created ? String(created.id) : item.id,
                date: created ? new Date(created.presence) : today,
                className: created ? `${this.currentCourse} (${created.room})` : item.className,
                present: true,
                absenceReason: undefined,
              }
            : item
        ),
      };
    });

    // Atualiza o MatCalendar para trocar a cor do dia atual de vermelho para verde-mate
    this.calendar?.updateTodaysDate();
    this.isCheckingIn.set(false);
  }

  onSlideInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.slideProgress.set(value);
    if (value >= 98) {
      this.showAbsenceAlert.set(false);
      this.slideProgress.set(0);
    }
  }

  onSlideRelease(): void {
    if (this.slideProgress() < 98) {
      this.slideProgress.set(0);
    }
  }

  formatDayLabel(date: Date): string {
    return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  private getFallbackStudentData(registration = '20261045', name = 'Lucas'): StudentData {
    const today = new Date();
    const makeDate = (offsetDays: number) => {
      const d = new Date(today);
      d.setDate(today.getDate() + offsetDays);
      return d;
    };

    return {
      id: registration,
      name,
      registration,
      attendanceList: [
        { id: '8', date: makeDate(0), className: 'Banco de Dados', present: false, isToday: true },
        { id: '7', date: makeDate(-1), className: 'Arquitetura Web', present: false, absenceReason: 'Não justificada' },
        { id: '6', date: makeDate(-3), className: 'Segurança da Informação', present: false, absenceReason: 'Não justificada' },
        { id: '5', date: makeDate(-5), className: 'DevOps & Cloud', present: false, absenceReason: 'Não justificada' },
        { id: '4', date: makeDate(-7), className: 'Redes de Computadores', present: false, absenceReason: 'Não justificada' },
        { id: '3', date: makeDate(-10), className: 'Sistemas Operacionais', present: false, absenceReason: 'Imprevisto no transporte' },
        { id: '2', date: makeDate(-12), className: 'Inteligência Artificial', present: false, absenceReason: 'Atestado médico' },
        { id: '1', date: makeDate(-14), className: 'Engenharia de Software', present: true },
      ],
    };
  }
}
