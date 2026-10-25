import { authAPI, getToken, clearToken, setTokens } from "./api";

// API base URL from environment
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// Helper function to handle API responses with JWT token
const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || response.statusText || "An error occurred");
  }
  return response.json();
};

// Auth API functions — unified with Django SimpleJWT
export const apiAuth = {
  signUp: async (
    email: string,
    password: string,
    options: { data: { username: string; first_name?: string; last_name?: string; role?: string } }
  ) => {
    try {
      const { username, first_name, last_name, role } = options.data;
      const res = await authAPI.register({
        username,
        email,
        password,
        role,
        full_name: [first_name, last_name].filter(Boolean).join(" "),
      });
      return { data: res, error: null };
    } catch (err: unknown) {
      return { data: null, error: err instanceof Error ? err.message : String(err) };
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const res = await authAPI.login({ email, username: email, password });
      return { data: res, error: null };
    } catch (err: unknown) {
      return { data: null, error: err instanceof Error ? err.message : String(err) };
    }
  },

  signOut: async () => {
    clearToken();
    return { data: null, error: null };
  },

  getSession: async () => {
    try {
      const profile = await authAPI.getProfile();
      return { data: { session: { user: profile } } };
    } catch {
      return { data: { session: null } };
    }
  },

  getUser: async () => {
    try {
      const profile = await authAPI.getProfile();
      return { data: { user: profile } };
    } catch {
      return { data: { user: null } };
    }
  },

  onAuthStateChange: () => ({
    unsubscribe: () => {},
  }),
};

// Profile API functions
export const apiProfiles = {
  get: async (id: string) => {
    try {
      // Try patient profile first
      try {
        const data = await authFetch(`${API_URL}/auth/patient/profile/`);
        return { data };
      } catch {
        // Fallback to doctor profile
        const data = await authFetch(`${API_URL}/auth/doctor/profile/`);
        return { data };
      }
    } catch {
      return { data: null };
    }
  },

  update: async (id: string, data: Record<string, unknown>) => {
    try {
      try {
        const res = await authFetch(`${API_URL}/auth/patient/profile/`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        return { data: res };
      } catch {
        const res = await authFetch(`${API_URL}/auth/doctor/profile/`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        return { data: res };
      }
    } catch (err: unknown) {
      return { data: null, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
