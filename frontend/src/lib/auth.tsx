"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiAuth, apiProfiles } from "./apiService";

interface Profile {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "patient" | "doctor" | "admin";
  did_identifier?: string;
  wallet_address?: string;
}

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; username: string; first_name?: string; last_name?: string; role?: string }) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const publicPaths = ["/login", "/register"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const loadProfile = async (userId: string) => {
    try {
      const { data } = await apiProfiles.get(userId);
      if (data) setProfile(data as Profile);
    } catch (error) {
      console.error("Failed to load profile:", error);
    }
  };

  // BYPASS VERSION FOR DEVELOPMENT
  useEffect(() => {
    // Bypass authentication for development - always show as authenticated
    setLoading(false);
    
    // Create a mock user object matching Supabase User interface
    const mockUser = {
      id: "dev-user-id-123",
      email: "dev@example.com",
    };
    
    setUser(mockUser);
    
    // Load mock profile data
    const mockProfile: Profile = {
      id: "dev-user-id-123",
      username: "devuser",
      email: "dev@example.com",
      first_name: "Dev",
      last_name: "User",
      role: "patient",
      did_identifier: undefined,
      wallet_address: undefined,
    };
    
    setProfile(mockProfile);
    
    // No redirect needed - stay on current page
  }, []); // Empty deps means runs once on mount
  // END BYPASS VERSION

  const login = async ({ email, password }: { email: string; password: string }) => {
    setLoading(true);
    try {
      const { error } = await apiAuth.signIn(email, password);
      if (error) throw new Error(error);
      
      // After successful login, get the user session
      const { data: { session } } = await apiAuth.getSession();
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id);
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: { 
    email: string; 
    password: string; 
    username: string; 
    first_name?: string; 
    last_name?: string; 
    role?: string 
  }) => {
    setLoading(true);
    try {
      const { error } = await apiAuth.signUp(data.email, data.password, {
        data: {
          username: data.username,
          first_name: data.first_name,
          last_name: data.last_name,
          role: data.role ?? "patient",
        }
      });
      if (error) throw new Error(error);
      
      // After successful registration, redirect to login
      router.push("/login");
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const { error } = await apiAuth.signOut();
      if (error) throw new Error(error);
    } finally {
      setUser(null);
      setProfile(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export type { Profile };
