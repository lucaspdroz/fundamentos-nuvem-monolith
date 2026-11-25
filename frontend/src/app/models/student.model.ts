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
  id?: string | number;
  registration: string;
  full_name: string;
  avatar: string;
  course: string;
  turn: string;
  professor?: boolean;
  proffesor?: string;
  room?: string;
  presence?: Date | string;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface ReminderNotification {
  id: string;
  title: string;
  type: 'alert' | 'info';
}

export interface ClassStudentRow {
  id: string | number;
  registration: string;
  full_name: string;
  avatar: string;
  presentToday: boolean;
  lastCheckIn?: Date;
}
