import axios from "axios";

const defaultHeader = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

// In dev Vite proxies /api → localhost:5001, so baseURL can be empty.
// In the packaged Electron app (loaded from app://-) there is no proxy,
// so we must point directly at the Railway backend.
const backendBase = import.meta.env.VITE_BACKEND_URL ?? "https://api-prod.sahudhaba.in";
const baseURL = import.meta.env.DEV ? "" : backendBase;

export const axiosWrapper = axios.create({
  baseURL,
  withCredentials: true,
  headers: { ...defaultHeader },
  timeout: 15_000,
});
