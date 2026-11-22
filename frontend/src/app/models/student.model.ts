export interface AttendanceRecord {
  id: string;
  date: Date;
  className: string;
  present: boolean;
  isToday?: boolean;
  absenceReason?: string;
}

export interface StudentData {
  id: string;
  name: string;
  registration: string;
  avatarUrl?: string;
  attendanceList: AttendanceRecord[];
}

export interface StudentProfile {
  id?: string;
  registration: string;
  full_name: string;
  avatar: string;
  presence: Date;
  course: string;
  turn: string;
  room: string;
  proffesor: string;
  created_at: Date;
}

export interface ReminderNotification {
  id: string;
  title: string;
  type: 'alert' | 'info';
}
