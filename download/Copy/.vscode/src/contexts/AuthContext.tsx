
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string; // Typically email or a unique ID from backend
  email: string;
  restaurantName?: string;
}

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<boolean>; // pass is unused in prototype
  signup: (email: string, pass: string, restaurantName?: string) => Promise<boolean>; // pass is unused
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'gastronomeCurrentUser';
const LOCAL_STORAGE_USERS_LIST_KEY = 'gastronomeUsersList'; // To simulate a user database

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Error loading user from localStorage:", error);
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY); // Clear corrupted data
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, pass: string): Promise<boolean> => {
    setIsLoading(true);
    // Simulate checking user credentials
    const usersListStr = localStorage.getItem(LOCAL_STORAGE_USERS_LIST_KEY);
    const usersList: User[] = usersListStr ? JSON.parse(usersListStr) : [];
    const existingUser = usersList.find(u => u.email === email); // In real app, also check password hash

    if (existingUser) {
      setCurrentUser(existingUser);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(existingUser));
      setIsLoading(false);
      return true;
    }
    setIsLoading(false);
    return false;
  };

  const signup = async (email: string, pass: string, restaurantName?: string): Promise<boolean> => {
    setIsLoading(true);
    const usersListStr = localStorage.getItem(LOCAL_STORAGE_USERS_LIST_KEY);
    const usersList: User[] = usersListStr ? JSON.parse(usersListStr) : [];
    
    if (usersList.find(u => u.email === email)) {
      setIsLoading(false);
      return false; // User already exists
    }

    const newUser: User = { id: email, email, restaurantName }; // Using email as ID for simplicity
    usersList.push(newUser);
    localStorage.setItem(LOCAL_STORAGE_USERS_LIST_KEY, JSON.stringify(usersList));
    
    // For this prototype, we don't auto-login after signup to keep it simple
    // User will be redirected to login page
    setIsLoading(false);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    // Clear user-specific data from other services if needed, or let them handle it.
    // For now, just redirect.
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
