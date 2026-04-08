/** Các khối prompt do người dùng chỉnh trên tab "Prompt AI" — ghép vào AIService. */

export type AiPromptConfig = {
  roleAndMission: string
  difficultyRubric: string
  taskTypeRubric: string
  scoringRubric: string
  integrityRules: string
  /** Hướng dẫn cố định về schema JSON — có thể sửa để thêm trường phụ (phải cập nhật code parse nếu đổi key bắt buộc). */
  jsonOutputContract: string
}
