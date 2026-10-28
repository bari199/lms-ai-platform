import axios from "axios";
import api from "./api";
import { setAccessToken, clearTokens } from "./tokenStorage";
import { store } from "@/store";
import { setUser, clearAuth } from "@/store/authSlice";

const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

interface RefreshResponse {
  success: boolean;
  data?: {
    accessToken: string;
  };
}

interface MeResponse {
  success: boolean;
  data?: {
    id: string;
    full_name: string;
    email: string;
    roles: string[];
  };
}

export async function restoreSession(): Promise<void> {
  try {
    const refreshResponse =
      await refreshClient.post<RefreshResponse>("/auth/refresh");

    const accessToken = refreshResponse.data?.data?.accessToken;

    if (!refreshResponse.data.success || !accessToken) {
      throw new Error("Session refresh failed");
    }

    setAccessToken(accessToken);

    const meResponse = await api.get<MeResponse>("/auth/me");
    const user = meResponse.data?.data;

    if (!meResponse.data.success || !user) {
      throw new Error("Unable to restore user profile");
    }

    store.dispatch(setUser(user));
  } catch {
    clearTokens();
    store.dispatch(clearAuth());
  }
}
