import { useEffect, useRef, useState } from "react";

// ---- countdown beeps (Web Audio, no sound files needed) ----
let ctx = null;
function audio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
export function beep(freq = 700, ms = 180) {
  try {
    const c = audio();
    if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + ms / 1000 + 0.02);
  } catch { /* audio blocked or unsupported */ }
}
// Browsers only allow sound after a tap/click, so unlock on the first interaction.
if (typeof window !== "undefined") {
  const unlock = () => { audio(); };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

// Beeps on 3, 2, 1 (short) and GO (long, higher). `startIn` = seconds left in the pre-round countdown.
export function useStartBeeps(startIn, roundId) {
  const prev = useRef({ id: null, v: null });
  useEffect(() => {
    const p = prev.current;
    if (p.id !== roundId) {          // a round just opened: beep for the number we first see
      prev.current = { id: roundId, v: startIn };
      if (roundId && startIn > 0) beep(700, 160);
      return;
    }
    if (startIn !== p.v) {
      if (startIn > 0) beep(700, 160);
      else if (p.v > 0) beep(1200, 500);
      p.v = startIn;
    }
  }, [startIn, roundId]);
}

const BASE = (import.meta.env.VITE_API_URL || "") + "/api";
export async function api(path, { method = "GET", body, key } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(key ? { "X-Organizer-Key": key } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const d = e.detail;
    throw new Error(typeof d === "string" ? d : Array.isArray(d) ? "Check the values you entered" : res.statusText);
  }
  return res.json();
}

// Polls `loader` every `ms`. Re-fetches immediately when `dep` changes.
// `_offset` = server clock minus browser clock, so countdowns match the server.
export function usePoll(loader, ms = 1000, dep = null) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const ref = useRef(loader);
  ref.current = loader;
  useEffect(() => {
    let live = true;
    const run = async () => {
      try {
        const d = await ref.current();
        if (live) { setData(d ? { ...d, _offset: d.server_time - Date.now() / 1000 } : null); setError(""); }
      } catch (e) { if (live) setError(e.message); }
    };
    run();
    const t = setInterval(run, ms);
    return () => { live = false; clearInterval(t); };
  }, [ms, dep]);
  return { data, error };
}

export function useCountdown(endsAt, offset = 0) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil(endsAt - (now / 1000 + (offset || 0))));
}
