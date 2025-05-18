import { create } from 'zustand';

interface UIState {
  isVideoPlaying: boolean;
  setIsVideoPlaying: (isPlaying: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isVideoPlaying: false,
  setIsVideoPlaying: (isPlaying) => set({ isVideoPlaying: isPlaying }),
}));
