import { create } from 'zustand'

export type CaptureStatus = 'idle' | 'capturing' | 'result'

interface CaptureStore {
  status: CaptureStatus
  progress: number
  requestId: number
  start: () => void
  reset: () => void
  setStatus: (s: CaptureStatus) => void
  setProgress: (p: number) => void
}

export const useCaptureStore = create<CaptureStore>((set) => ({
  status: 'idle',
  progress: 0,
  requestId: 0,
  start: () => set((s) => ({ status: 'capturing', progress: 0, requestId: s.requestId + 1 })),
  reset: () => set({ status: 'idle', progress: 0 }),
  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
}))
