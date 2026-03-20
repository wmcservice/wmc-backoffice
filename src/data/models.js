// Data model factories for WMC Operations Command Center

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


export const createJob = (overrides = {}) => ({
  id: uuid(),
  qtNumber: '',
  projectName: '',
  clientName: '',
  jobType: 'ติดตั้ง',
  status: 'รอคิว',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  defaultCheckIn: '09:00',
  defaultCheckOut: '18:00',
  priority: 'ปกติ',
  fixReason: '',
  fixPhoto: '',
  notes: '',
  createdBy: '', // Staff ID or Name of who added this job
  progressLogs: [], // Array of { id, date, text, author, attachments }
  attachments: [], // Array of { id, name, url, type }
  subTasks: [], // Array of { id, title, isCompleted }
  overallProgress: 0, // 0 to 100
  currentIssues: '', // Why it's not finished
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  assignedStaffIds: [],
  ...overrides,
});

export const createStaff = (overrides = {}) => ({
  id: uuid(),
  fingerprintId: '',
  fullName: '',
  nickname: '',
  role: 'ช่างหน้างาน',
  primarySkill: 'ติดตั้ง',
  isActive: true,
  phone: '',
  additionalInfo: '', // For more details like address, bank account, etc.
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createAllocation = (overrides = {}) => ({
  id: uuid(),
  jobId: '',
  staffId: '',
  date: new Date().toISOString().split('T')[0],
  assignedHours: 8,
  checkIn: '09:00',
  checkOut: '18:00',
  actualHours: 0,
  overtimeHours: 0,
  task: '',
  status: 'ได้รับมอบหมาย',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createParameter = (overrides = {}) => ({
  id: 'default-params',
  workStartTime: '09:00',
  workEndTime: '18:00',
  lunchBreakStart: '12:00',
  lunchBreakDuration: 60,
  dinnerBreakThreshold: '20:00',
  dinnerBreakDuration: 60,
  baseDailyRate: 400,
  ...overrides,
});

export const createHoliday = (overrides = {}) => ({
  id: uuid(),
  date: '',
  name: '',
  type: 'วันหยุดราชการ',
  ...overrides,
});

export const JOB_STATUSES = ['รอคิว', 'กำลังดำเนินการ', 'ตรวจสอบ', 'เสร็จสมบูรณ์', 'ต้องแก้ไข'];
export const JOB_TYPES = ['โหลด', 'ขนย้าย', 'ติดตั้ง', 'โกดัง', 'ทำของ', 'มาร์กไลน์', 'อื่นๆ'];
export const STAFF_ROLES = ['ช่างหน้างาน', 'ออฟฟิศ', 'ทีมนอก', 'หัวหน้าทีม', 'ซุปเปอร์ไวเซอร์', 'พนักงานขับรถ'];
export const STAFF_SKILLS = ['ติดตั้ง', 'ขนย้าย', 'ไฟฟ้า', 'ทั่วไป'];
export const PRIORITIES = ['ต่ำ', 'ปกติ', 'สูง', 'ด่วนที่สุด'];

export const STATUS_COLORS = {
  'รอคิว': '#6b7280',
  'กำลังดำเนินการ': '#3b82f6',
  'ตรวจสอบ': '#f59e0b',
  'เสร็จสมบูรณ์': '#10b981',
  'ต้องแก้ไข': '#ef4444',
};
