/**
 * Native input injection for remote control (B.2).
 *
 * ## Why this approach
 *
 * Electron's own `webContents.sendInputEvent()` injects into the Electron
 * window ONLY — it cannot move the real cursor or type into another
 * application, so it is useless for assisting someone with their machine.
 * Controlling the OS needs a native call.
 *
 * Options considered:
 *   - `robotjs` — the classic choice, but unmaintained and compiled per
 *     Electron ABI: every Electron bump means a rebuild toolchain on Windows.
 *   - `@nut-tree/nut-js` — maintained, but its licensing moved behind a paid
 *     tier for recent versions.
 *   - PowerShell / `SendKeys` — one process spawn per event; hopeless latency.
 *   - `koffi` calling `SendInput` in user32.dll — no compilation (prebuilt
 *     binaries), maintained, and the Win32 call is exactly the one every remote
 *     desktop tool uses. Chosen.
 *
 * ## Status — MUST BE VALIDATED ON WINDOWS BEFORE USE
 *
 * The struct layouts below follow the documented x64 Win32 ABI, but they could
 * not be exercised in this project's Linux build environment: `SendInput` does
 * not exist there. `isAvailable()` returns false anywhere but win32, so nothing
 * silently half-works — but the first real Windows run is the real test.
 */

import { platform } from 'node:os';
// One definition of the wire format, shared with the renderer: two copies of
// this shape would drift the day a field is added.
import type { RemoteInputEvent } from '../shared/api';

export type { RemoteInputEvent };

const INPUT_MOUSE = 0;
const INPUT_KEYBOARD = 1;

const MOUSEEVENTF_MOVE = 0x0001;
const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const MOUSEEVENTF_RIGHTDOWN = 0x0008;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const MOUSEEVENTF_MIDDLEDOWN = 0x0020;
const MOUSEEVENTF_MIDDLEUP = 0x0040;
const MOUSEEVENTF_WHEEL = 0x0800;
const MOUSEEVENTF_ABSOLUTE = 0x8000;
const MOUSEEVENTF_VIRTUALDESK = 0x4000;

const KEYEVENTF_KEYUP = 0x0002;

/** The absolute coordinate space Win32 uses for MOUSEEVENTF_ABSOLUTE. */
const ABS_MAX = 65535;

interface Win32Bindings {
  SendInput: (count: number, inputs: unknown, size: number) => number;
  INPUT: unknown;
  koffi: typeof import('koffi');
}

let bindings: Win32Bindings | null = null;
let loadFailed = false;

function load(): Win32Bindings | null {
  if (bindings || loadFailed) return bindings;
  if (platform() !== 'win32') {
    loadFailed = true;
    return null;
  }
  try {
    // Required lazily: on a machine that never takes control, the FFI layer is
    // never loaded at all — and on a non-Windows build it is never even
    // resolved, which is why this is a runtime require rather than an import.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require('koffi') as typeof import('koffi');
    const user32 = koffi.load('user32.dll');

    // x64 layout. MOUSEINPUT is the largest arm of the union (32 bytes), so
    // INPUT is 8 (type + padding) + 32 = 40 bytes, and the keyboard arm is
    // padded to the same size — SendInput is told 40 either way.
    const MOUSEINPUT = koffi.struct('MOUSEINPUT', {
      dx: 'int32',
      dy: 'int32',
      mouseData: 'uint32',
      dwFlags: 'uint32',
      time: 'uint32',
      _pad: 'uint32',
      dwExtraInfo: 'uint64',
    });
    const INPUT = koffi.struct('INPUT', {
      type: 'uint32',
      _pad: 'uint32',
      mi: MOUSEINPUT,
    });

    const SendInput = user32.func('uint32 __stdcall SendInput(uint32, INPUT *, int32)');
    bindings = { SendInput, INPUT, koffi };
    return bindings;
  } catch {
    loadFailed = true;
    return null;
  }
}

/** True when this machine can actually be driven remotely. */
export function isRemoteInputAvailable(): boolean {
  return load() !== null;
}

function mouseInput(dwFlags: number, dx = 0, dy = 0, mouseData = 0) {
  return {
    type: INPUT_MOUSE,
    _pad: 0,
    mi: { dx, dy, mouseData, dwFlags, time: 0, _pad: 0, dwExtraInfo: 0n },
  };
}

/**
 * A keyboard event reuses the mouse arm's memory, which is what the union does
 * anyway: wVk and wScan are the first two 16-bit fields, dwFlags the next
 * 32-bit one. Packing them into `dx` (low/high word) and `mouseData` mirrors
 * the KEYBDINPUT layout exactly.
 */
function keyInput(vk: number, pressed: boolean) {
  return {
    type: INPUT_KEYBOARD,
    _pad: 0,
    mi: {
      dx: vk & 0xffff, // wVk (+ wScan = 0 in the high word)
      dy: pressed ? 0 : KEYEVENTF_KEYUP, // dwFlags
      mouseData: 0, // time
      dwFlags: 0,
      time: 0,
      _pad: 0,
      dwExtraInfo: 0n,
    },
  };
}

const DOWN_FLAGS = [MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_RIGHTDOWN];
const UP_FLAGS = [MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MIDDLEUP, MOUSEEVENTF_RIGHTUP];

/**
 * Applies one remote event to this machine. Returns false when injection is
 * unavailable, so the caller can tell the controller honestly rather than
 * pretending the click landed.
 */
export function injectRemoteInput(event: RemoteInputEvent): boolean {
  const win = load();
  if (!win) return false;

  const inputs: unknown[] = [];
  const absX = Math.round(Math.min(Math.max(event.x ?? 0, 0), 1) * ABS_MAX);
  const absY = Math.round(Math.min(Math.max(event.y ?? 0, 0), 1) * ABS_MAX);
  const positioned = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;

  switch (event.kind) {
    case 'move':
      inputs.push(mouseInput(positioned, absX, absY));
      break;
    case 'down':
    case 'up': {
      const index = Math.min(Math.max(event.button ?? 0, 0), 2);
      const flag = event.kind === 'down' ? DOWN_FLAGS[index] : UP_FLAGS[index];
      // Position first, then the button: a click must land where the operator
      // aimed even if the cursor had drifted.
      if (event.x != null && event.y != null) {
        inputs.push(mouseInput(positioned, absX, absY));
      }
      inputs.push(mouseInput(flag));
      break;
    }
    case 'wheel':
      inputs.push(mouseInput(MOUSEEVENTF_WHEEL, 0, 0, Math.round(event.delta ?? 0)));
      break;
    case 'key':
      if (typeof event.vk !== 'number') return false;
      inputs.push(keyInput(event.vk, event.pressed !== false));
      break;
    default:
      return false;
  }

  try {
    for (const input of inputs) {
      win.SendInput(1, [input], 40);
    }
    return true;
  } catch {
    return false;
  }
}
