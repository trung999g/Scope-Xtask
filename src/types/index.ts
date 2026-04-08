export interface Employee {
  id: string;
  name: string;
  leaveDays?: number;
}

export type TaskType =
  | "feature"
  | "improvement"
  | "bug"
  | "fixbug"
  | "maintenance"
  | "leave";

/** Theo cột Sheet: task chính (phiếu/epic) vs task phụ (sub-task có id riêng). */
export type XtaskRole = "main" | "sub";

export interface Task {
  mainTaskId: string;
  subTaskId: string;
  /** Phân loại từ cột A/B export: sub có id khác main → phụ; còn lại → chính. */
  xtaskRole: XtaskRole;
  title: string;
  description: string;
  assigneeName: string;
  assigneeId: string;
  createdDate: Date;
  startDate: Date;
  endDate: Date;
  completedDate?: Date;
  baseScore: number;
  finalScore: number;
  type: TaskType;
  difficulty: 1 | 2 | 3 | 4;
  isDuplicate?: boolean;
  duplicateTaskId?: string;
  lateDays: number;
  penaltyPercent: number;
  notes: string;
  source?: "FE" | "API" | "Both";
  workingHours?: number;
  // AI Audit Fields
  aiQualityScore?: number;
  aiComment?: string;
  isAiFraud?: boolean;
}

export interface ScoringRule {
  level: 1 | 2 | 3 | 4;
  description: string;
  points: number;
}
