import axios from 'axios'

/** Axios instance nội bộ (không đọc URL API từ env/public). */
export const api = axios.create({
  baseURL: '',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})
