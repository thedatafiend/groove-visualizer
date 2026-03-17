const overlay = new URLSearchParams(window.location.search).has('overlay')

export function isOverlayMode(): boolean {
  return overlay
}
