import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { MatCalendar, MatDatepickerModule, MatCalendarCellClassFunction } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Observable, of, delay } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AttendanceRecord, ReminderNotification, StudentData } from '../../models/student.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatDatepickerModule],
  providers: [provideNativeDateAdapter()], // Usa o Date nativo do JavaScript
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

  readonly totalAbsences = computed(() => {
    const list = this.student()?.attendanceList ?? [];
    return list.filter((item) => !item.present && !this.isSameDay(item.date, new Date())).length;
  });

  readonly isTodayConfirmed = computed(() => {
    const today = this.student()?.attendanceList.find((item) => this.isSameDay(item.date, new Date()));
    return today?.present ?? false;
  });

  // Função chamada pelo MatCalendar para cada dia (Date)
  readonly dateClass: MatCalendarCellClassFunction<Date> = (cellDate, view) => {
    if (view !== 'month') return '';

    const record = this.student()?.attendanceList.find((item) =>
      this.isSameDay(item.date, cellDate)
    );

    // Se não é dia de aula, deixa neutro/apagado para focar nos dias letivos
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

  private loadStudentData(): void {
    const registration = (history.state as { student?: { registration?: string } })?.student
      ?.registration;
    this.apiService.get<StudentData>(`students/${registration}/presences`).subscribe({
      next: (data) => {
        // Garante conversão caso a API retorne string ISO
        data.attendanceList = data.attendanceList.map((item) => ({
          ...item,
          date: new Date(item.date),
        }));
        this.student.set(data);
        this.calendar?.updateTodaysDate();
        this.checkAbsenceThreshold();
      },
      error: () => {
        this.student.set(this.getFallbackStudentData());
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

    const todayRecord = currentStudent.attendanceList.find((item) =>
      this.isSameDay(item.date, new Date())
    );
    if (!todayRecord) return;

    this.isCheckingIn.set(true);

    this.apiService
      .update<AttendanceRecord, { present: boolean }>(
        `students/${currentStudent.id}/attendance/${todayRecord.id}`,
        { present: true }
      )
      .subscribe({
        next: () => this.markTodayAsPresent(todayRecord.id),
        error: () => this.markTodayAsPresent(todayRecord.id),
      });
  }

  private markTodayAsPresent(recordId: string): void {
    this.student.update((current) => {
      if (!current) return null;
      return {
        ...current,
        attendanceList: current.attendanceList.map((item) =>
          item.id === recordId ? { ...item, present: true, absenceReason: undefined } : item
        ),
      };
    });
    // Força o MatCalendar a reavaliar o dateClass (vermelho -> verde mate)
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

  private getFallbackStudentData(): StudentData {
    const today = new Date();
    const makeDate = (offsetDays: number) => {
      const d = new Date(today);
      d.setDate(today.getDate() + offsetDays);
      return d;
    };

    return {
      id: 'stu-01',
      name: 'Lucas',
      registration: '20261045',
      attendanceList: [
        { id: '1', date: makeDate(-14), className: 'Engenharia de Software', present: true },
        { id: '2', date: makeDate(-12), className: 'Inteligência Artificial', present: false, absenceReason: 'Atestado médico' },
        { id: '3', date: makeDate(-10), className: 'Sistemas Operacionais', present: false, absenceReason: 'Imprevisto no transporte' },
        { id: '4', date: makeDate(-7), className: 'Redes de Computadores', present: false, absenceReason: 'Não justificada' },
        { id: '5', date: makeDate(-5), className: 'DevOps & Cloud', present: false, absenceReason: 'Não justificada' },
        { id: '6', date: makeDate(-3), className: 'Segurança da Informação', present: false, absenceReason: 'Não justificada' },
        { id: '7', date: makeDate(-1), className: 'Arquitetura Web', present: false, absenceReason: 'Não justificada' },
        { id: '8', date: makeDate(0), className: 'Banco de Dados', present: false, isToday: true },
      ],
    };
  }
}
