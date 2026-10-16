// API base URL from environment
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || response.statusText || "An error occurred");
  }
  return response.json();
};

// Auth API functions - mimicking Supabase interface
export const apiAuth = {
  signUp: async (email: string, password: string, options: { data: { username: string; first_name?: string; last_name?: string; role?: string } }) => {
    const { username, first_name, last_name, role } = options.data;
    const response = await fetch(`${API_URL}/auth/register/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, username, first_name, last_name, role }),
    });
    const data = await handleResponse(response);
    // Return in Supabase format: { data, error }
    return { data, error: null };
  },

  signIn: async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse(response);
    // Return in Supabase format: { data, error }
    return { data, error: null };
  },

  signOut: async () => {
    const response = await fetch(`${API_URL}/auth/logout/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await handleResponse(response);
    // Return in Supabase format: { data, error }
    return { data, error: null };
  },

  getSession: async () => {
    const response = await fetch(`${API_URL}/auth/me/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });
    const data = await handleResponse(response);
    // Return in Supabase format: { data: { session } }
    return { data: { session: data } };
  },

  getUser: async () => {
    const response = await fetch(`${API_URL}/auth/me/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });
    const data = await handleResponse(response);
    // Return in Supabase format: { data: { user } }
    return { data: { user: data } };
  },

  // Note: onAuthStateChange would require websockets or polling, 
  // which is more complex to implement. For now, we'll leave it as a stub
  // that doesn't actually subscribe to changes.
  onAuthStateChange: (cb: any) => {
    // This is a simplified implementation - in a real app, you'd use
    // websockets or polling to detect auth state changes
    return {
      unsubscribe: () => {},
    };
  },
};

// Profile API functions - mimicking Supabase interface
export const apiProfiles = {
  get: async (id: string) => {
    // Try to get patient profile first
    let response = await fetch(`${API_URL}/auth/patient/profile/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    let data;
    if (response.ok) {
      data = await handleResponse(response);
    } else {
      // If not patient, try doctor profile
      response = await fetch(`${API_URL}/auth/doctor/profile/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      data = await handleResponse(response);
    }

    // Return in Supabase format: { data }
    return { data };
  },

  update: async (id: string, data: Record<string, unknown>) => {
    // Try to update patient profile first
    let response = await fetch(`${API_URL}/auth/patient/profile/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    let resultData;
    if (response.ok) {
      resultData = await handleResponse(response);
    } else {
      // If patient update fails, try doctor profile
      response = await fetch(`${API_URL}/auth/doctor/profile/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      resultData = await handleResponse(response);
    }

    // Return in Supabase format: { data }
    return { data: resultData };
  },
};
