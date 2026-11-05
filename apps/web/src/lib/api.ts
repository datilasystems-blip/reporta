// REPORTA API client — shared by web, admin, officer frontends
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_URL =
  (typeof window !== "undefined" && (window as any).REPORTA_API_URL) ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export async function friendlyError(err: unknown): Promise<string> {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<any>;
    const serverMsg = e.response?.data?.message ?? e.response?.data?.error;
    if (e.response) {
      if (e.response.status === 401) return serverMsg ?? "Incorrect email or password.";
      if (e.response.status === 403) return serverMsg ?? "You do not have permission for this action.";
      if (e.response.status === 429) return "Too many attempts. Please wait and try again.";
      if (e.response.status >= 500) return "The REPORTA server is having trouble. Please try again shortly.";
      return serverMsg ?? e.message;
    }
    if (e.code === "ECONNABORTED") return "The request timed out. Check your connection.";
    return "Cannot reach the REPORTA server. Check your internet connection.";
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

// Attach bearer token (stored in memory; refresh cookie keeps session alive)
let accessToken: string | null = null;
export function setAccessToken(t: string | null) { accessToken = t; }
export function getAccessToken() { return accessToken; }

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers["Authorization"] = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        const res = await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true });
        setAccessToken(res.data.accessToken);
        return api(original);
      } catch {
        setAccessToken(null);
        window.dispatchEvent(new CustomEvent("auth:expired"));
      }
    }
    return Promise.reject(error);
  }
);
