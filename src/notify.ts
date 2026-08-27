// Browser notifications (Notification API) + a short synthesized chime, fired when the
// sidebar bell's polling detects new unread chat/requests. "Simple" on purpose — works
// only while the tab is open (even backgrounded), no service worker/push involved.
// Desktop-only concern in practice (admin panel is a desktop dashboard).

export function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

/** Two-note chime via Web Audio — no audio file/asset needed. */
export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
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
    setTimeout(() => ctx.close(), 700);
  } catch {
    // Audio blocked (no user interaction yet) or unsupported — silently skip.
  }
}

export function notifyBrowser(title: string, body: string) {
  playChime();
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag: 'guide-admin-notification' });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // ignore
  }
}
