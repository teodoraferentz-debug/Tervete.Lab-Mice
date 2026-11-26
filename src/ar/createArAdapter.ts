import type { ArAdapter } from './ArAdapter';
import { MindArAdapter } from './MindArAdapter';
import { MockArAdapter } from './MockArAdapter';

/**
 * `?ar=mock` swaps in simulated tracking, for rehearsing the AR flow without a camera.
 * Anything else uses MindAR (and falls back to Magic Mode if it cannot run).
 */
export function createArAdapter(search: string = window.location.search): ArAdapter {
  const flag = new URLSearchParams(search).get('ar');
  return flag === 'mock' ? new MockArAdapter() : new MindArAdapter();
}
