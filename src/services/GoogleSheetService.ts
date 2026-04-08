import Papa from "papaparse";
import { Task } from "../types";
import { normalizeXtaskId } from "../utils/taskIds";

export const CSV_COLUMNS = {
  MAIN_ID: 0, // A: Task ID
  SUB_ID: 1, // B: Sub-task ID
  TITLE: 2, // C: Task Name
  DESCRIPTION: 2, // C: Task Name
  ASSIGNEE: 3, // D: Người phụ trách
  CREATED: 5, // F: Thời gian tạo
  START: 6, // G: Thời gian bắt đầu
  END: 7, // H: Thời gian kết thúc
  COMPLETED: 8, // I: Thời gian hoàn thành
  POINTS: 11, // L: Điểm
  WORKING_HOURS: 12, // M: Giờ công / Tổng số giờ
};

const XTASK_BASE_URL = "https://xtask.tgdd.vn/group/136380817";

export const GoogleSheetService = {
  async parseTasksFromCsv(
    csvText: string,
    blockedHashtags: string[] = [],
  ): Promise<Task[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        skipEmptyLines: true,
        complete: (results: Papa.ParseResult<string[]>) => {
          const rawData = results.data as string[][];
          const tasks: Task[] = [];

          for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            const mainId = normalizeXtaskId(row[CSV_COLUMNS.MAIN_ID] || "");
            const rawSubCell = (row[CSV_COLUMNS.SUB_ID] || "").trim();
            const subId = normalizeXtaskId(rawSubCell);
            const title = (row[CSV_COLUMNS.TITLE] || "").trim();
            if (title === "Task Name" || (!mainId && !title)) continue;

            const assigneeRaw = row[CSV_COLUMNS.ASSIGNEE] || "";
            const assigneeMatch = assigneeRaw.match(/^(\d+)/);
            const assigneeId = (assigneeMatch ? assigneeMatch[1] : "").trim();
            const assigneeName = assigneeRaw.replace(/^\d+[- ]*/, "").trim();

            const hasDistinctSub =
              subId !== "" && subId !== mainId;
            const xtaskRole = hasDistinctSub ? "sub" : "main";

            const task: Task = {
              mainTaskId: mainId,
              subTaskId: subId || mainId, // Fallback if no subId
              xtaskRole,
              title: title,
              description: title,
              assigneeId: assigneeId,
              assigneeName: assigneeName,
              createdDate:
                this.parseDate(row[CSV_COLUMNS.CREATED]) || new Date(),
              startDate: this.parseDate(row[CSV_COLUMNS.START]) || new Date(),
              endDate: this.parseDate(row[CSV_COLUMNS.END]) || new Date(),
              completedDate: this.parseDate(row[CSV_COLUMNS.COMPLETED]),
              type: "feature",
              difficulty: 1,
              baseScore: 0,
              finalScore: 0,
              lateDays: 0,
              penaltyPercent: 0,
              notes: "Chưa chấm AI",
              workingHours: parseFloat(row[CSV_COLUMNS.WORKING_HOURS]) || 0,
            };

            const endDate = this.parseDate(row[CSV_COLUMNS.END]);
            const completedDate = this.parseDate(row[CSV_COLUMNS.COMPLETED]);
            if (completedDate && endDate && completedDate > endDate) {
              task.lateDays = Math.ceil(
                (completedDate.getTime() - endDate.getTime()) /
                  (1000 * 60 * 60 * 24),
              );
              task.penaltyPercent = task.lateDays * 2;
            }

            tasks.push(task);
          }

          this.detectDuplicates(tasks, blockedHashtags);
          resolve(tasks);
        },
        error: (error: unknown) => reject(error),
      });
    });
  },

  parseDate(dateStr: string): Date | undefined {
    if (!dateStr || dateStr.trim() === "") return undefined;
    const cleanDate = dateStr.split(" ")[0].replace(/\//g, "-");
    const parts = cleanDate.split("-");
    if (parts.length !== 3) return undefined;
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    return new Date(year, month - 1, day);
  },

  detectDuplicates(tasks: Task[], blockedHashtags: string[] = []) {
    tasks.forEach((task) => {
      const titleLower = task.title.toLowerCase();
      const matchedKey = blockedHashtags.find((tag) =>
        titleLower.includes(tag.toLowerCase()),
      );
      if (matchedKey) {
        task.finalScore = 0;
        task.isDuplicate = true;
        task.notes = `Bị chặn hashtag: ${matchedKey} (0đ)`;
      }

      if (
        task.mainTaskId === "LEAVE" ||
        !task.assigneeId ||
        task.assigneeId === ""
      )
        return;

      const internalTitleMatch = tasks.filter(
        (t) =>
          t !== task &&
          t.assigneeId === task.assigneeId &&
          t.title.toLowerCase() === task.title.toLowerCase() &&
          task.title.length > 5,
      );

      if (internalTitleMatch.length > 0) {
        task.finalScore = 0;
        task.isDuplicate = true;
        task.notes =
          (task.notes ? task.notes + " | " : "") +
          `REJECT: Trùng lặp nội dung phiếu (0đ)`;
      }
    });
  },

  async parseLeaveFromCsv(csvText: string): Promise<Record<string, number>> {
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        skipEmptyLines: true,
        complete: (results: Papa.ParseResult<string[]>) => {
          const rawData = results.data as string[][];
          const leaveData: Record<string, number> = {};
          for (let i = 2; i < rawData.length; i++) {
            const row = rawData[i];
            const userRaw = row[0] || "";
            const idMatch = userRaw.match(/^(\d+)/);
            const id = idMatch ? idMatch[1] : "";
            const days = parseFloat(row[1]) || 0;
            if (id) leaveData[id.trim()] = days;
          }
          resolve(leaveData);
        },
        error: (error: unknown) => reject(error),
      });
    });
  },

  getTaskUrl(mainId: string, subId: string): string {
    if (subId && subId !== mainId) {
      return `${XTASK_BASE_URL}?task-id=${mainId}&sub-task-id=${subId}`;
    }
    return `${XTASK_BASE_URL}?task-id=${mainId}`;
  },
};
