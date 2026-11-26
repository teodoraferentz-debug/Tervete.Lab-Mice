import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MindArAdapter } from '../ar/MindArAdapter';
import { MockArAdapter } from '../ar/MockArAdapter';
import { createArAdapter } from '../ar/createArAdapter';
import type { ArStatus } from '../experience/sceneTypes';

describe('MockArAdapter', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it('simulates starting → scanning → tracking without a camera', async () => {
    const adapter = new MockArAdapter({ scanDelayMs: 1000 });
    const seen: ArStatus[] = [];
    adapter.subscribe((s) => seen.push(s));
    expect(await adapter.start()).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen).toEqual(['starting', 'scanning', 'tracking']);
  });

  it('can simulate failures and lost/found', async () => {
    const adapter = new MockArAdapter({ scanDelayMs: 100, failWith: 'denied' });
    await adapter.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(adapter.status).toBe('denied');
    adapter.simulateFound();
    adapter.simulateLost();
    expect(adapter.status).toBe('lost');
  });

  it('stop cancels pending timers and unsubscribes cleanly', async () => {
    const adapter = new MockArAdapter({ scanDelayMs: 500 });
    const seen: ArStatus[] = [];
    const off = adapter.subscribe((s) => seen.push(s));
    await adapter.start();
    await adapter.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(adapter.status).toBe('idle');
    off();
    expect(seen).not.toContain('tracking');
  });

  it('is selected with ?ar=mock; real MindAR otherwise', () => {
    expect(createArAdapter('?ar=mock').kind).toBe('mock');
    expect(createArAdapter('').kind).toBe('mindar');
  });
});

describe('MindArAdapter fallbacks (nothing is loaded unless AR can really run)', () => {
  const nav = navigator as Navigator & { mediaDevices?: unknown };
  const secure = (value: boolean) => Object.defineProperty(window, 'isSecureContext', { value, configurable: true });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(nav, 'mediaDevices');
    secure(false);
  });

  it('reports unsupported without camera APIs or a secure context, and never imports MindAR', async () => {
    const adapter = new MindArAdapter();
    expect(await adapter.start(document.createElement('div'))).toBeNull();
    expect(adapter.status).toBe('unsupported');
  });

  it('reports an error (not a crash) when the compiled marker file is missing', async () => {
    secure(true);
    Object.defineProperty(nav, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new MindArAdapter('/assets/markers/missing.mind');
    expect(await adapter.start(document.createElement('div'))).toBeNull();
    expect(adapter.status).toBe('error');
    expect(warn).toHaveBeenCalled();
  });

  it('reports an error when the marker request fails outright', async () => {
    secure(true);
    Object.defineProperty(nav, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true });
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new MindArAdapter();
    await adapter.start(document.createElement('div'));
    expect(adapter.status).toBe('error');
  });
});
