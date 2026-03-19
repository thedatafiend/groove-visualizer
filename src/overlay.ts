const params = new URLSearchParams(window.location.search)
const overlay = params.has('overlay')

export function isOverlayMode(): boolean {
  return overlay
}

/** Optional audio device name override, e.g. ?overlay&device=BlackHole */
export function getOverlayDevice(): string | null {
  return params.get('device')
}
