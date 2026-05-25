/** Supabase auth persistence for static web export (localStorage). */

export const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Quota or private mode
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
  },
};
