'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.user) {
          const emailPrefix = data.user.email ? data.user.email.split('@')[0] : 'User';
          setUser({
            ...data.user,
            name: data.user.name || emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1),
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const signIn = async (email: string, password?: string, mode: 'login' | 'signup' = 'login') => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, mode }),
    });

    const data = await res.json();
    if (!res.ok || data.status === 'error') {
      throw new Error(data.error || 'Authentication failed');
    }

    if (data.user) {
      const emailPrefix = data.user.email ? data.user.email.split('@')[0] : 'User';
      setUser({
        ...data.user,
        name: data.user.name || emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1),
      });
    }
    return data;
  };

  const signOut = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  return {
    user,
    isLoading,
    signIn,
    signOut,
    refresh: fetchUser,
  };
}
