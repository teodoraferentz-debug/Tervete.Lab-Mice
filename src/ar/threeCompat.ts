// Build-time shim used ONLY for imports that originate inside `mind-ar` (see vite.config.ts).
// mind-ar still imports `sRGBEncoding`, which was removed from three in r162.
// The numeric value is the legacy constant; modern three ignores `renderer.outputEncoding`.
export * from 'three';
export const sRGBEncoding = 3001;
