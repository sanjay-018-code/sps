import { useEffect, useRef, useState } from "react";

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
