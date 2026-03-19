import { useState, useCallback, useEffect, useRef } from 'react'
import Scene from './components/Scene'
import DebugOverlay from './components/DebugOverlay'
import { initAudio, initAudioFromElement } from './audio/AudioAnalyser'
import { isOverlayMode, getOverlayDevice } from './overlay'

export default function App() {
  const overlay = isOverlayMode()
  const [started, setStarted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debug, setDebug] = useState(false)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioInitedRef = useRef(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'd' || e.key === 'D') setDebug((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleOverlayStart = useCallback(async () => {
    try {
      const device = getOverlayDevice() ?? 'BlackHole'
      await initAudio(device)
      console.log('[overlay] audio initialized, preferred device:', device)
      setStarted(true)
    } catch (e) {
      console.error('[overlay] audio init failed:', e)
      setError(e instanceof Error ? e.message : 'Failed to init audio')
    }
  }, [])

  const handleStart = useCallback(async () => {
    try {
      await initAudio()
      setStarted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to access microphone')
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoSrc(URL.createObjectURL(file))
  }, [])

  const handleVideoCanPlay = useCallback(async () => {
    if (audioInitedRef.current) return
    const video = videoRef.current
    if (!video) return
    audioInitedRef.current = true
    try {
      await initAudioFromElement(video)
      await video.play()
      setStarted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load video')
    }
  }, [])

  // The video element is always rendered (when videoSrc exists) so it
  // persists across the started transition — the MediaElementSource stays valid.
  return (
    <>
      {/* Video element — always in DOM once loaded, styled based on state */}
      {videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          onCanPlay={handleVideoCanPlay}
          style={started ? {
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            width: '25vw',
            minWidth: '200px',
            maxWidth: '400px',
            borderRadius: '8px',
            border: '1px solid rgba(0, 255, 255, 0.3)',
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)',
            zIndex: 10,
          } : {
            display: 'none',
          }}
        />
      )}

      {started ? (
        <>
          <Scene />
          {debug && <DebugOverlay />}
        </>
      ) : (
        <div style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          gap: '1rem',
        }}>
          <button
            onClick={overlay ? handleOverlayStart : handleStart}
            style={{
              fontSize: '1.4rem',
              padding: '1rem 2.5rem',
              cursor: 'pointer',
              background: '#111',
              color: '#0ff',
              border: '1px solid #0ff',
              borderRadius: '8px',
              fontFamily: 'monospace',
            }}
          >
            {overlay ? 'Start Overlay' : 'Start Visualizer'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              fontSize: '1.4rem',
              padding: '1rem 2.5rem',
              cursor: 'pointer',
              background: '#111',
              color: '#f0f',
              border: '1px solid #f0f',
              borderRadius: '8px',
              fontFamily: 'monospace',
            }}
          >
            Load Video
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {error && (
            <p style={{ color: '#f44', marginTop: '1rem', fontFamily: 'monospace' }}>
              {error}
            </p>
          )}
        </div>
      )}
    </>
  )
}
