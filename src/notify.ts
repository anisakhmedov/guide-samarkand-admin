// Browser notifications + a short synthesized chime, fired when polling detects new
// activity. No push server: notifications appear while the site is open (even in a
// background tab / minimised browser). System notifications go through a tiny service
// worker (public/sw.js) because Android Chrome refuses `new Notification()` without one,
// and the worker also brings the user to the right page when they tap the notification.

export type NotifyPermission = 'unsupported' | 'default' | 'granted' | 'denied';

let audioCtx: AudioContext | null = null;
let swRegistration: Promise<ServiceWorkerRegistration | null> = Promise.resolve(null);

function audio(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
}

/**
 * Browsers only allow sound after a user gesture, so the AudioContext is created/resumed on
 * the first tap/key press. Also registers the service worker and routes notification clicks
 * (posted back by sw.js) to `onNavigate`.
 */
export function initNotifications(onNavigate: (url: string) => void) {
  const unlock = () => {
    audio()?.resume().catch(() => {});
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  if ('serviceWorker' in navigator) {
    swRegistration = navigator.serviceWorker.register('/sw.js').catch(() => null);
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.url === 'string') onNavigate(e.data.url);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }
  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

export function notificationPermission(): NotifyPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotifyPermission;
}

/** Must be called from a click handler — browsers ignore/block prompts without a user gesture. */
export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return (await Notification.requestPermission()) as NotifyPermission;
  } catch {
    return notificationPermission();
  }
}

/** Two-note chime via Web Audio — no audio file needed. Silent until the first user gesture. */
export function playChime() {
  const ctx = audioCtx;
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  [880, 1174.66].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.24);
  });
}

export interface NotifyOptions {
  title: string;
  body: string;
  url: string;
  tag: string;
  sound?: boolean;
}

/**
 * Chime + a system notification when the page isn't in front. When the page is visible the
 * caller shows an in-app toast instead (a system banner on top of the open app is noise).
 */
export async function notify({ title, body, url, tag, sound = true }: NotifyOptions) {
  if (sound) playChime();
  if (document.visibilityState === 'visible' || notificationPermission() !== 'granted') return;
  const options = { body, tag, renotify: true, data: { url } } as NotificationOptions;
  try {
    const reg = await swRegistration;
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Unsupported in this browser — the in-app badge still shows the update.
  }
}
