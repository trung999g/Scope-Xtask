import axios from 'axios'

/** Axios instance — gắn baseURL từ env khi team có backend */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})
