import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  name: string;
  avatar: string;
}

interface User {
  id: string;
  email: string;
  isAdmin: boolean;
  profiles: Profile[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  currentProfile: Profile | null;
  hasSelectedProfile: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectProfile: (profile: Profile) => void;
  updateProfile: (profileId: string, updates: Partial<Profile>) => Promise<void>;
  clearError: () => void;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      currentProfile: null,
      hasSelectedProfile: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string, rememberMe: boolean) => {
        set({ isLoading: true, error: null });
        try {
          console.log('Attempting login for:', email);
          const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) {
            console.error('Sign in error:', signInError);
            throw signInError;
          }
          if (!authData.user) {
            console.error('No user data returned from authentication');
            throw new Error('No user data returned from authentication');
          }

          console.log('Successfully authenticated, fetching user data...');

          // Set session persistence based on rememberMe
          if (rememberMe) {
            await supabase.auth.setSession({
              access_token: authData.session?.access_token || '',
              refresh_token: authData.session?.refresh_token || ''
            });
          }

          // Fetch user data including profiles
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select(`
              id,
              email,
              is_admin,
              profiles (
                id,
                name,
                avatar_url
              )
            `)
            .eq('id', authData.user.id)
            .single();

          if (userError) {
            console.error('Error fetching user data:', userError);
            throw userError;
          }
          if (!userData) {
            console.error('User data not found after authentication');
            throw new Error('User data not found');
          }

          console.log('User data fetched:', { 
            id: userData.id,
            email: userData.email,
            isAdmin: userData.is_admin,
            profileCount: userData.profiles?.length
          });

          const profiles = userData.profiles?.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar_url
          })) || [];

          const userWithData = {
            id: userData.id,
            email: userData.email,
            isAdmin: userData.is_admin,
            profiles
          };

          set({ 
            user: userWithData,
            isAuthenticated: true,
            currentProfile: userData.is_admin ? {
              id: 'admin',
              name: 'Admin',
              avatar: 'https://i.pravatar.cc/150?img=1'
            } : null,
            hasSelectedProfile: userData.is_admin,
            isLoading: false,
            error: null
          });

          console.log('Login complete, state updated');
        } catch (error) {
          console.error('Login process failed:', error);
          set({ 
            user: null,
            isAuthenticated: false,
            currentProfile: null,
            hasSelectedProfile: false,
            error: error instanceof Error ? error.message : 'An error occurred during login', 
            isLoading: false 
          });
        }
      },

      register: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          });

          if (signUpError) throw signUpError;
          if (!authData.user) throw new Error('Registration failed');

          // The trigger will create the user and profile records
          // Just fetch the created data
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select(`
              id,
              email,
              is_admin,
              profiles (
                id,
                name,
                avatar_url
              )
            `)
            .eq('id', authData.user.id)
            .single();

          if (userError) throw userError;
          if (!userData) throw new Error('User data not found after registration');

          const profiles = userData.profiles?.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar_url
          })) || [];

          const userWithData = {
            id: userData.id,
            email: userData.email,
            isAdmin: userData.is_admin,
            profiles
          };

          set({ 
            user: userWithData,
            isAuthenticated: true,
            currentProfile: null,
            hasSelectedProfile: false,
            isLoading: false,
            error: null
          });
        } catch (error) {
          let errorMessage = 'An error occurred during registration';
          if (error instanceof Error) {
            errorMessage = error.message;
            if (error.message.includes('already registered')) {
              errorMessage = 'An account with this email already exists. Please sign in instead.';
            }
          }
          
          set({ 
            user: null,
            isAuthenticated: false,
            currentProfile: null,
            hasSelectedProfile: false,
            error: errorMessage,
            isLoading: false 
          });
        }
      },

      resetPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email);
          if (error) throw error;
          set({ isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to process password reset',
            isLoading: false
          });
        }
      },

      updatePassword: async (newPassword: string) => {
        set({ isLoading: true, error: null });
        try {
          const { error } = await supabase.auth.updateUser({
            password: newPassword
          });

          if (error) throw error;
          set({ isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update password',
            isLoading: false
          });
        }
      },

      logout: async () => {
        try {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          
          set({ 
            user: null, 
            isAuthenticated: false, 
            currentProfile: null, 
            hasSelectedProfile: false,
            error: null
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to log out',
          });
        }
      },

      selectProfile: (profile) => {
        set({ currentProfile: profile, hasSelectedProfile: true });
      },

      updateProfile: async (profileId: string, updates: Partial<Profile>) => {
        set({ isLoading: true, error: null });
        try {
          const { error } = await supabase
            .from('profiles')
            .update({
              name: updates.name,
              avatar_url: updates.avatar
            })
            .eq('id', profileId);

          if (error) throw error;

          // Update local state
          const { user, currentProfile } = get();
          if (user) {
            const updatedProfiles = user.profiles.map(p =>
              p.id === profileId ? { ...p, ...updates } : p
            );
            set({
              user: { ...user, profiles: updatedProfiles },
              currentProfile: currentProfile?.id === profileId
                ? { ...currentProfile, ...updates }
                : currentProfile,
              isLoading: false
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update profile',
            isLoading: false
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'cinewave-auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        currentProfile: state.currentProfile,
        hasSelectedProfile: state.hasSelectedProfile
      }),
    }
  )
);