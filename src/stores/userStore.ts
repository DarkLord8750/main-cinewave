import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  name: string;
  avatar_url: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  is_admin: boolean;
  status: 'active' | 'inactive' | 'suspended';
  notes: string;
  created_at: string;
  profiles: Profile[];
  watch_history_count: number;
  last_active: string | null;
}

interface UserState {
  users: User[];
  isLoading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  isLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select(`
          *,
          profiles (*)
        `)
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      const { data: watchHistory, error: watchHistoryError } = await supabase
        .from('watch_history')
        .select('id, last_watched, profile_id')
        .in('profile_id', users.flatMap(user => user.profiles.map(profile => profile.id)));

      if (watchHistoryError) throw watchHistoryError;

      const formattedUsers = users.map(user => {
        const userWatchHistory = watchHistory?.filter(history => 
          user.profiles.some(profile => profile.id === history.profile_id)
        ) || [];

        const lastActive = userWatchHistory.length > 0
          ? userWatchHistory.reduce((latest, current) => {
              return !latest || new Date(current.last_watched) > new Date(latest)
                ? current.last_watched
                : latest;
            }, null as string | null)
          : null;

        return {
          id: user.id,
          email: user.email,
          is_admin: user.is_admin,
          status: user.status || 'active',
          notes: user.notes || '',
          created_at: user.created_at,
          profiles: user.profiles,
          watch_history_count: userWatchHistory.length,
          last_active: lastActive
        };
      });

      set({ users: formattedUsers, isLoading: false });
    } catch (error) {
      console.error('Error fetching users:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch users',
        isLoading: false 
      });
    }
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_admin: updates.is_admin,
          status: updates.status,
          notes: updates.notes
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      set(state => ({
        users: state.users.map(user => 
          user.id === id ? { ...user, ...updates } : user
        )
      }));

      // Refresh users to get latest data
      await get().fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  deleteUser: async (id: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        users: state.users.filter(user => user.id !== id)
      }));
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}));