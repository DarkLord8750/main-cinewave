import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Genre {
  id: string;
  name: string;
}

interface GenreState {
  genres: Genre[];
  isLoading: boolean;
  error: string | null;
  fetchGenres: () => Promise<void>;
}

export const useGenreStore = create<GenreState>((set) => ({
  genres: [],
  isLoading: false,
  error: null,

  fetchGenres: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: genres, error } = await supabase
        .from('genres')
        .select('*')
        .order('name');

      if (error) throw error;

      set({ genres, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch genres', 
        isLoading: false 
      });
    }
  }
}));