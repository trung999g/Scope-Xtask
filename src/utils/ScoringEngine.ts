import type { Task, TaskType } from "../types";

/** Họp triển khai / kickoff — phối hợp, không tương đương dev FE nặng; rule: độ khó 1–2. */
export function isDeploymentMeetingTask(
  title: string,
  description: string = "",
): boolean {
  const combined = `${title} ${description}`.trim();
  if (!combined) return false;
  const lower = combined.toLowerCase();
  const unaccent = lower
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    lower.includes("họp triển khai") ||
    unaccent.includes("hop trien khai") ||
    lower.includes("meeting triển khai") ||
    unaccent.includes("meeting trien khai")
  );
}

const REVIEW_CODE_MARKERS = [
  "review task",
  "review code",
  "code review",
  "rà soát code",
  "review pr",
  "merge request",
  "peer review",
  "review spec",
  "review ac",
] as const;

const OPTIMIZE_MARKERS = [
  "optimize",
  "tối ưu code",
  "tối ưu bundle",
  "tối ưu hiệu năng",
] as const;

/** Review / PR có trong phiếu và không có tín hiệu optimize/tối ưu code — rubric: tối đa mức 3. */
export function taskTextSuggestsReviewWithoutOptimize(
  title: string,
  description = "",
): boolean {
  const text = `${title} ${description}`.toLowerCase();
  const hasReview = REVIEW_CODE_MARKERS.some((k) => text.includes(k));
  if (!hasReview) return false;
  const hasOptimize = OPTIMIZE_MARKERS.some((k) => text.includes(k));
  return !hasOptimize;
}

export const KEYWORDS = {
  LEVEL_1: [
    "ui đơn giản",
    "typo",
    "css",
    "hiển thị",
    "màu sắc",
    "icon",
    "text",
    "font",
    "gắn ui",
    "update ui",
    "làm ui",
    "viết ui",
    "màn hình đơn",
  ],
  LEVEL_2: [
    "state",
    "call api",
    "validate",
    "logic phụ",
    "cơ bản",
    "form",
    "mapping",
    "phụ kiện",
    "filter",
    "tích hợp ui",
  ],
  LEVEL_3: [
    "error handling",
    "nhiều case",
    "logic chính",
    "ảnh hưởng flow",
    "nâng cấp",
    "integration",
    "hotfix",
    "quan trọng",
    "quy trình",
    "review task",
    "review code",
    "code review",
    "rà soát code",
    "review pr",
    "merge request",
    "peer review",
  ],
  LEVEL_4: [
    "kiến trúc",
    "performance",
    "reusable",
    "optimize",
    "tối ưu code",
    "tối ưu bundle",
    "tối ưu hiệu năng",
    "refactor lớn",
    "re-architect",
    "core",
    "module",
    "library",
  ],
  BUG_LIGHT: ["nhẹ", "css", "typo"],
  BUG_MEDIUM: ["trung bình", "sai logic phụ", "mô tả"],
  BUG_SEVERE: ["nặng", "sai logic chính", "crash"],
};

export const ScoringEngine = {
  /**
   * Guess difficulty level (1-4) based on title and description
   */
  guessDifficulty(title: string, description: string = ""): 1 | 2 | 3 | 4 {
    const text = (title + " " + description).toLowerCase();

    if (isDeploymentMeetingTask(title, description)) {
      return 2;
    }

    // Optimize/tối ưu → mức 4; review → mức 3. Xét LEVEL_4 trước để "optimize code" không rơi vào nhánh review.
    if (KEYWORDS.LEVEL_4.some((k) => text.includes(k))) return 4;
    if (KEYWORDS.LEVEL_3.some((k) => text.includes(k))) return 3;
    if (KEYWORDS.LEVEL_2.some((k) => text.includes(k))) return 2;
    return 1;
  },

  /**
   * Guess task type based on title
   */
  guessTaskType(title: string): TaskType {
    const text = title.toLowerCase();
    if (text.includes("bug") || text.includes("fix")) return "bug";
    if (
      text.includes("support") ||
      text.includes("maintenance") ||
      text.includes("vận hành")
    )
      return "maintenance";
    if (text.includes("phép") || text.includes("nghỉ")) return "leave";
    return "feature";
  },

  /**
   * Calculate score for a single task including penalties
   */
  calculateTaskScore(task: Task): number {
    let baseScore =
      task.baseScore !== undefined && !Number.isNaN(task.baseScore)
        ? task.baseScore
        : task.difficulty; // fallback to difficulty points ONLY if undefined

    // 1. Rule: No points if no description
    const hasDescription = task.title && task.title.trim().length > 2;
    if (!hasDescription) return 0;

    // Applying source multiplier for bug
    if (task.type === "bug") {
      if (task.source === "API") baseScore *= 0.5;
    }

    // CAP: Max 4.0 points per task
    if (baseScore > 4.0) {
      baseScore = 4.0;
      task.notes =
        (task.notes ? task.notes + " | " : "") + "Vượt trần 4đ (Đã cắt)";
    }

    // Applying late penalty: 2% per day
    const penaltyRate = 0.02 * (task.lateDays || 0);
    const calculatedScore = baseScore * (1 - penaltyRate);

    // Final Integer Rounding (No decimals)
    let finalScore = Math.round(calculatedScore);

    // FLOOR Rule: No valid task under 1 point
    if (finalScore === 0 && calculatedScore > 0) {
      finalScore = 1;
    }

    return Math.max(0, finalScore);
  },

  /**
   * Rounding as per rules (>= 0.5 up, < 0.5 down)
   */
  roundScore(score: number): number {
    return Math.round(score);
  },

  /**
   * Calculate total monthly score with Maintenance thresholding
   */
  calculateMonthlyTotal(tasks: Task[]): number {
    const featureTasks = tasks.filter(
      (t) => t.type === "feature" || t.type === "improvement",
    );
    const bugTasks = tasks.filter((t) => t.type === "bug");
    const maintenanceTasks = tasks.filter((t) => t.type === "maintenance");
    const leaveTasks = tasks.filter((t) => t.type === "leave");

    const basicTotal =
      featureTasks.reduce((acc, t) => acc + t.finalScore, 0) +
      bugTasks.reduce((acc, t) => acc + t.finalScore, 0);

    // Maintenance limit: MIN(MaintScore, basicTotal * 0.2)
    const maintTotalRaw = maintenanceTasks.reduce(
      (acc, t) => acc + t.finalScore,
      0,
    );
    const maintActual = Math.min(
      maintTotalRaw,
      this.roundScore(basicTotal * 0.2),
    );

    const skipLeaveTotal = leaveTasks.reduce((acc, t) => acc + t.finalScore, 0);

    return this.roundScore(basicTotal) + maintActual + skipLeaveTotal;
  },
};
