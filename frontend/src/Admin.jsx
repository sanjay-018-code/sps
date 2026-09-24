import { useState } from "react";
import { api, usePoll, useCountdown, useStartBeeps } from "./api.js";
import { SYMBOLS, Pts, Leaderboard } from "./ui.jsx";

const blank = { title: "", description: "", duration: 30, organizer_symbol: "random", win: 5, draw: 2, lose: 0 };

function RoundForm({ initial, onSave, onCancel, label }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF({ ...f, [k]: v });
  const num = (k) => ({ type: "number", min: 0, value: f[k], onChange: (e) => set(k, Number(e.target.value)) });
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <label>Title<input required maxLength={80} value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
      <label>Description (shown on the notice board)
        <textarea rows={3} maxLength={500} value={f.description} onChange={(e) => set("description", e.target.value)} />
      </label>
      <div className="grid">
        <label>Time (seconds)<input {...num("duration")} min={5} max={600} /></label>
        <label>My symbol
          <select value={f.organizer_symbol} onChange={(e) => set("organizer_symbol", e.target.value)}>
            {["random", "rock", "paper", "scissors"].map((s) => <option key={s} value={s}>{SYMBOLS[s].icon} {SYMBOLS[s].label}</option>)}
          </select>
        </label>
        <label>Points for a win<input {...num("win")} /></label>
        <label>Points for a draw<input {...num("draw")} /></label>
        <label>Points for a loss<input {...num("lose")} /></label>
      </div>
      <div className="row">
        <button className="btn">{label}</button>
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function Live({ r, offset, onEnd }) {
  const left = useCountdown(r.ends_at, offset);
  const startIn = useCountdown(r.starts_at, offset);
  useStartBeeps(startIn, r.id);
  return (
    <>
      <b className="big">{startIn > 0 ? `Starting in ${startIn}...` : `${left}s left`}</b>
      <span className="mut">{r.move_count} moves in. {SYMBOLS[r.organizer_symbol] ? `You are playing ${SYMBOLS[r.organizer_symbol].icon} ${SYMBOLS[r.organizer_symbol].label}` : ""}</span>
      <button className="btn danger" onClick={onEnd}>End round now</button>
    </>
  );
}

export default function Admin() {
  const [key, setKey] = useState(sessionStorage.getItem("rps_key") || "");
  const [pw, setPw] = useState("");
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState("");
  const { data, error } = usePoll(() => (key ? api("/admin/state", { key }) : Promise.resolve(null)), 1000, key);
  const rounds = data?.rounds || [];
  const last = rounds[rounds.length - 1];

  const run = async (fn) => { try { await fn(); setMsg(""); } catch (e) { setMsg(e.message); } };
  const call = (path, method = "POST", body) => api(path, { method, key, body });
  const step = (id, action) => run(() => call(`/admin/rounds/${id}/${action}`));

  if (!key || error === "Wrong organizer password") {
    return (
      <div className="wrap">
        <form className="card form" onSubmit={(e) => { e.preventDefault(); sessionStorage.setItem("rps_key", pw); setKey(pw); }}>
          <h2>Organizer login</h2>
          <label>Password<input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <button className="btn">Log in</button>
          {key && error && <p className="err">{error}</p>}
          <a href="#/">Back to the game</a>
        </form>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header>
        <h1>Organizer console</h1>
        <div className="row">
          <span className="mut">{data?.player_count ?? 0} players</span>
          <button className="btn ghost" onClick={() => { sessionStorage.removeItem("rps_key"); setKey(""); }}>Log out</button>
        </div>
      </header>
      {msg && <p className="err">{msg}</p>}

      <section className="card">
        <h2>Add a round</h2>
        <RoundForm
          key={rounds.length}
          label="Add round"
          initial={{ ...blank, ...(last ? { duration: last.duration, win: last.win, draw: last.draw, lose: last.lose } : {}) }}
          onSave={(b) => run(() => call("/admin/rounds", "POST", b))}
        />
      </section>

      {rounds.map((r) => {
        const idle = r.status === "draft" || r.status === "announced";
        return (
          <section key={r.id} className="card">
            <div className="row">
              <b className="big">Round {r.number}: {r.title}</b>
              <span className={`pill ${r.status}`}>{r.status}</span>
            </div>
            {editing === r.id ? (
              <RoundForm
                label="Save changes"
                initial={r}
                onCancel={() => setEditing(null)}
                onSave={(b) => run(async () => { await call(`/admin/rounds/${r.id}`, "PUT", b); setEditing(null); })}
              />
            ) : (
              <>
                <p>{r.description || <span className="mut">No description</span>}</p>
                <Pts r={r} />
                <div className="mut">{r.duration}s · My symbol: {SYMBOLS[r.organizer_symbol].icon} {SYMBOLS[r.organizer_symbol].label}</div>
                <div className="row" style={{ marginTop: 10 }}>
                  {r.status === "draft" && <button className="btn ghost" onClick={() => step(r.id, "announce")}>Announce on notice board</button>}
                  {idle && (
                    <>
                      <button className="btn" onClick={() => step(r.id, "start")}>Start round</button>
                      <button className="btn ghost" onClick={() => setEditing(r.id)}>Edit</button>
                      <button className="btn danger" onClick={() => run(() => call(`/admin/rounds/${r.id}`, "DELETE"))}>Delete</button>
                    </>
                  )}
                  {r.status === "open" && <Live r={r} offset={data._offset} onEnd={() => step(r.id, "end")} />}
                </div>
                {r.status === "closed" && (
                  <table style={{ marginTop: 10 }}>
                    <thead><tr><th>Player</th><th>Played</th><th>Result</th><th className="n">Points</th></tr></thead>
                    <tbody>
                      {r.results.map((x) => (
                        <tr key={x.name}>
                          <td>{x.name}</td>
                          <td>{x.symbol ? `${SYMBOLS[x.symbol].icon} ${SYMBOLS[x.symbol].label}` : "-"}</td>
                          <td>{x.outcome}</td><td className="n">+{x.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>
        );
      })}

      <Leaderboard rows={data?.leaderboard} />
      <div className="row">
        <button className="btn danger" onClick={() => confirm("Delete all rounds and reset every score?") && run(() => call("/admin/reset"))}>Reset game</button>
        <a href="#/">Player view</a>
      </div>
    </div>
  );
}
