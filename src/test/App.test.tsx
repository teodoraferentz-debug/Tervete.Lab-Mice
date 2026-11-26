import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { MockArAdapter } from '../ar/MockArAdapter';
import { GUARDIANS } from '../content/guardians';
import { PITCH } from '../content/pitchScript';
import { fakeStageFactory, type FakeStage } from './fakeStage';

function setup(arFactory = () => new MockArAdapter({ scanDelayMs: 20 })) {
  const { factory, stages } = fakeStageFactory();
  const view = render(<App stageFactory={factory} arFactory={arFactory} />);
  const stage = (): FakeStage => {
    const s = stages[stages.length - 1];
    if (!s) throw new Error('stage not created');
    return s;
  };
  return { ...view, stage };
}

const press = (key: string) => act(() => void fireEvent.keyDown(window, { key }));
const finishScene = (stage: () => FakeStage) =>
  act(() => {
    stage().clock?.seek(stage().clock?.duration ?? 0);
    vi.advanceTimersByTime(1500);
  });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Magic Mode, end to end', () => {
  it('welcome offers Start AR and Magic Mode', () => {
    setup();
    expect(screen.getByRole('button', { name: /Start AR/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Magic Mode/ })).toBeTruthy();
    expect(screen.getByText('AR Experience Preview')).toBeTruthy();
  });

  it('opens a map with five inactive zones, runs Skats and lights its zone', () => {
    const { stage } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Magic Mode/ }));

    expect(screen.getByText('0 of 5 guardians awake')).toBeTruthy();
    for (const g of GUARDIANS) {
      expect(screen.getByRole('button', { name: new RegExp(`Open ${g.name}.*Asleep`) })).toBeTruthy();
    }

    fireEvent.click(screen.getByRole('button', { name: /Open Skats/ }));
    expect(screen.getByRole('heading', { name: 'Skats' })).toBeTruthy();
    expect(stage().calls.at(-1)).toBe('attraction:skats');
    expect(screen.getByText(/Psst! I'm Skats/)).toBeTruthy(); // caption at t = 0
    expect(screen.queryByText(/Raise the leaves/)).toBeNull(); // prompt only after its cue

    act(() => stage().clock?.seek(12));
    expect(screen.getByText(/At the Hornet Garden/)).toBeTruthy();
    expect(screen.getByText('In the park')).toBeTruthy();

    act(() => stage().clock?.seek(25));
    expect(screen.getByText(/Raise the leaves, cones and seeds/)).toBeTruthy();

    finishScene(stage);
    expect(screen.getByText('1 of 5 guardians awake')).toBeTruthy();
    expect(stage().lastMap).toMatchObject({ visited: ['skats'], justActivated: 'skats' });
    expect(screen.getByRole('button', { name: /Replay Skats.*Awake/ })).toBeTruthy();
  });

  it('plays all five scenes, then awakens the Tree of Five Senses', () => {
    const { stage } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Magic Mode/ }));
    for (const g of GUARDIANS) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Open ${g.name}`) }));
      expect(stage().calls.at(-1)).toBe(`attraction:${g.id}`);
      finishScene(stage);
    }
    expect(screen.getByText(PITCH.map.allAwake)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: PITCH.map.awakenTree }));
    expect(screen.getByRole('heading', { name: 'Tree of Five Senses' })).toBeTruthy();
    expect(stage().calls.at(-1)).toBe('finale');
    act(() => stage().clock?.seek(18));
    expect(screen.getByText(/This is a preview/)).toBeTruthy();
  });

  it('shows the taste safety note once the activity starts', () => {
    const { stage } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Magic Mode/ }));
    fireEvent.click(screen.getByRole('button', { name: /Open Odziņa/ }));
    expect(screen.queryByText(/Never eat plants/)).toBeNull();
    act(() => stage().clock?.seek(6));
    expect(screen.getByText(/Never eat plants you find in the forest/)).toBeTruthy();
  });
});

describe('presenter controls', () => {
  it('opens with P, jumps to any scene, and steps with next/previous', () => {
    const { stage } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Magic Mode/ }));
    press('p');
    const panel = screen.getByRole('group', { name: 'Presenter' });
    fireEvent.click(within(panel).getByRole('button', { name: /Plaukstiņa/ }));
    expect(stage().calls.at(-1)).toBe('attraction:plaukstina');
    press('ArrowRight'); // completes the scene → map
    expect(stage().calls.at(-1)).toBe('map');
    expect(screen.getByText('1 of 5 guardians awake')).toBeTruthy();
    press('ArrowLeft'); // back into the scene it just finished
    expect(stage().calls.at(-1)).toBe('attraction:plaukstina');
    fireEvent.click(within(panel).getByRole('button', { name: /Tree of Five Senses/ }));
    expect(stage().calls.at(-1)).toBe('finale');
  });

  it('restart needs a second press and returns to a clean welcome screen', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Magic Mode/ }));
    fireEvent.click(screen.getByRole('button', { name: /Open Skats/ }));
    press('ArrowRight');
    press('p');
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(screen.queryByText('Welcome')).not.toBeNull(); // scene list still there
    expect(screen.getByText('1 of 5 guardians awake', { exact: false })).toBeTruthy(); // not reset yet
    fireEvent.click(screen.getByRole('button', { name: 'Press again to restart' }));
    expect(screen.getByRole('button', { name: /Start AR/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Welcome/ }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByText(/0\/5 awake/)).toBeTruthy();
  });

  it('mute toggles from the panel and with M', () => {
    setup();
    press('p');
    const mute = screen.getByRole('button', { name: 'Sound on' });
    fireEvent.click(mute);
    expect(screen.getByRole('button', { name: 'Sound off' }).getAttribute('aria-pressed')).toBe('true');
    press('m');
    expect(screen.getByRole('button', { name: 'Sound on' })).toBeTruthy();
  });

  it('ignores shortcuts while typing in a field', () => {
    setup();
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => void fireEvent.keyDown(input, { key: 'ArrowRight' }));
    expect(screen.getByRole('button', { name: /Start AR/ })).toBeTruthy(); // still on welcome
    input.remove();
  });
});

describe('AR mode and its fallbacks', () => {
  it('Start AR waits for the map, then opens it in AR mode', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Start AR/ }));
    expect(screen.getByRole('heading', { name: PITCH.scan.title })).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByText('0 of 5 guardians awake')).toBeTruthy();
    press('p');
    expect(screen.getByText(/AR · tracking/)).toBeTruthy();
  });

  it.each([
    ['denied', PITCH.notices.arDenied],
    ['unsupported', PITCH.notices.arUnsupported],
    ['error', PITCH.notices.arError],
  ] as const)('AR %s continues in Magic Mode with a message and no dead end', async (failWith, message) => {
    setup(() => new MockArAdapter({ scanDelayMs: 20, failWith }));
    fireEvent.click(screen.getByRole('button', { name: /Start AR/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByText('0 of 5 guardians awake')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open Skats/ }));
    expect(screen.getByRole('heading', { name: 'Skats' })).toBeTruthy();
  });

  it('the scan screen always offers Magic Mode', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Start AR/ }));
    fireEvent.click(screen.getByRole('button', { name: PITCH.scan.continueMagic }));
    expect(screen.getByText('0 of 5 guardians awake')).toBeTruthy();
  });

  it('warns when the map leaves the camera view and recovers when it returns', async () => {
    const adapter = new MockArAdapter({ scanDelayMs: 20 });
    setup(() => adapter);
    fireEvent.click(screen.getByRole('button', { name: /Start AR/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    act(() => adapter.simulateLost());
    expect(screen.getByText(PITCH.notices.arLost)).toBeTruthy();
    act(() => adapter.simulateFound());
    expect(screen.queryByText(PITCH.notices.arLost)).toBeNull();
  });

  it('the presenter can switch to Magic Mode while in AR', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Start AR/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    press('p');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Magic Mode' }));
    expect(screen.getByRole('button', { name: 'Magic Mode on' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('0 of 5 guardians awake')).toBeTruthy();
  });
});

describe('accessibility', () => {
  it('captions are announced politely and markers are real, labelled buttons', () => {
    const { stage } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Magic Mode/ }));
    fireEvent.click(screen.getByRole('button', { name: /Open Austiņa/ }));
    const caption = screen.getAllByRole('status').find((el) => el.classList.contains('subtitles'));
    expect(caption?.getAttribute('aria-live')).toBe('polite');
    expect(stage().calls.at(-1)).toBe('attraction:austina');
  });
});
