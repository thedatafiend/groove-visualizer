import { create } from 'zustand'

interface AudioStore {
  started: boolean
  setStarted: (v: boolean) => void
}

export const useAudioStore = create<AudioStore>((set) => ({
  started: false,
  setStarted: (v) => set({ started: v }),
}))
