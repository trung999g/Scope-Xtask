import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Khởi tạo client Gemini — dùng VITE_GEMINI_API_KEY trong .env
 * (chỉ gọi từ UI sau khi đã xử lý consent / guard phía product)
 */
export function createGeminiClient() {
  const key = import.meta.env.VITE_GEMINI_API_KEY
  if (!key) {
    throw new Error('Thiếu VITE_GEMINI_API_KEY trong .env')
  }
  return new GoogleGenerativeAI(key)
}
