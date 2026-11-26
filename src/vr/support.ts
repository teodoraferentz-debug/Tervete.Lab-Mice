/** True when this browser can start an immersive VR session (needs HTTPS or localhost). */
export async function vrSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.isSecureContext) return false;
    const xr = (navigator as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } }).xr;
    return xr ? await xr.isSessionSupported('immersive-vr') : false;
  } catch {
    return false;
  }
}
