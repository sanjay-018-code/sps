import { useState } from "react";
import { api, usePoll, useCountdown } from "./api.js";
import { SYMBOLS, Pts, Leaderboard } from "./ui.jsx";

const OUT = { win: "You win! 🎉", draw: "It's a draw 🤝", lose: "You lose 😅", "no move": "You didn't play in time ⏰" };

export default function Player() {
  const [pid, setPid] = useState(localStorage.getItem("rps_pid") || "");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState(null);
  const { data, error } = usePoll(() => api(`/state?player_id=${pid}`), 1000, pid);
  const cur = data?.current;
  const left = useCountdown(cur?.ends_at, data?._offset);
  const mine = (picked && cur && picked.round === cur.id) ? picked.symbol : cur?.my_move;
  const res = cur?.my_result;

  const join = async (e) => {
    e.preventDefault();
    try {
      const r = await api("/join", { method: "POST", body: { name } });
      localStorage.setItem("rps_pid", r.player_id);
      setPid(r.player_id);
      setErr("");
    } catch (x) { setErr(x.message); }
  };

  const play = async (symbol) => {
    setPicked({ round: cur.id, symbol });
    try { await api("/play", { method: "POST", body: { player_id: pid, symbol } }); setErr(""); }
    catch (x) { setErr(x.message); }
  };

  return (
    <div className="wrap">
      <header>
        <h1>Stone Paper Scissors</h1>
        {data?.me && <div className="big">{data.me.name}: {data.me.score} pts</div>}
      </header>
      {error && <p className="err">Can't reach the server: {error}</p>}

      {data && !data.me && (
        <form className="card form" onSubmit={join}>
          <h2>Join the game</h2>
          <label>Your name<input required maxLength={30} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <button className="btn">Join</button>
          {err && <p className="err">{err}</p>}
        </form>
      )}

      <section className="board">
        <h2>Notice board</h2>
        {!cur ? (
          <p className="mut">No round has been announced yet. Stay tuned.</p>
        ) : (
          <>
            <div className="row">
              <span className="big">Round {cur.number}: {cur.title}</span>
              <span className={`pill ${cur.status}`}>{cur.status === "announced" ? "up next" : cur.status}</span>
            </div>
            <p>{cur.description || "No description for this round."}</p>
            <Pts r={cur} />
            <div className="mut">{cur.duration} seconds to choose your symbol</div>
          </>
        )}
      </section>

      {data?.me && cur && (
        <section className="card">
          {cur.status === "announced" && <p className="big">Get ready. The organizer will start this round soon.</p>}
          {cur.status === "open" && (
            <>
              <div className="timer">{left}s</div>
              <div className="picks">
                {["rock", "paper", "scissors"].map((s) => (
                  <button key={s} className={"pick" + (mine === s ? " sel" : "")} disabled={left === 0} onClick={() => play(s)}>
                    <span>{SYMBOLS[s].icon}</span>{SYMBOLS[s].label}
                  </button>
                ))}
              </div>
              <p className="mut">
                {mine && SYMBOLS[mine] ? `${SYMBOLS[mine].label} is locked in. You can change it until time runs out.` : "Pick your symbol."}
              </p>
            </>
          )}
          {cur.status === "closed" && (
            <>
              {cur.organizer_symbol && SYMBOLS[cur.organizer_symbol] && (
                <p className="big">The organizer played {SYMBOLS[cur.organizer_symbol].icon} {SYMBOLS[cur.organizer_symbol].label}</p>
              )}
              {res ? (
                <p>
                  {res.symbol && SYMBOLS[res.symbol] && <>You played {SYMBOLS[res.symbol].icon} {SYMBOLS[res.symbol].label}. </>}
                  <b>{OUT[res.outcome]}</b> +{res.points} points
                </p>
              ) : <p className="mut">You joined after this round ended.</p>}
              <p className="mut">The next round will appear on the notice board.</p>
            </>
          )}
          {err && <p className="err">{err}</p>}
        </section>
      )}

      <Leaderboard rows={data?.leaderboard} />

      {data?.notifications?.length > 0 && (
        <section className="card">
          <h2>All announcements</h2>
          <ul className="feed">
            {[...data.notifications].reverse().map((n) => (
              <li key={n.id}>
                <b>Round {n.number}: {n.title}</b> <span className={`pill ${n.status}`}>{n.status}</span>
                <div className="mut">{n.description}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mut"><a href="#/admin">Organizer login</a></p>
    </div>
  );
}
