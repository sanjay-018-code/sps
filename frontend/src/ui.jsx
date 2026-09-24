export const SYMBOLS = {
  rock: { icon: "🪨", label: "Stone" },
  paper: { icon: "📄", label: "Paper" },
  scissors: { icon: "✂️", label: "Scissors" },
  random: { icon: "🎲", label: "Random" },
};

export function Pts({ r }) {
  return (
    <div className="pts">
      <span className="win">Win +{r.win}</span>
      <span className="draw">Draw +{r.draw}</span>
      <span className="lose">Lose +{r.lose}</span>
    </div>
  );
}

export function Leaderboard({ rows = [] }) {
  return (
    <section className="card">
      <h2>Leaderboard</h2>
      {rows.length === 0 ? (
        <p className="mut">No players have joined yet.</p>
      ) : (
        <table>
          <thead><tr><th>#</th><th>Player</th><th className="n">Points</th></tr></thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.name} className={p.me ? "me" : ""}>
                <td>{i + 1}</td><td>{p.name}</td><td className="n">{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
