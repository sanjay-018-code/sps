# Stone Paper Scissors Arena

Players play against you (the organizer). FastAPI backend + React (Vite) frontend.

**Scoring (editable per round):** win = 5, draw = 2, loss = 0.

## Run it

Backend (terminal 1):
```
cd backend
python -m venv venv && source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
ORGANIZER_PASSWORD=choose-a-password uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
(Windows PowerShell: `$env:ORGANIZER_PASSWORD="choose-a-password"; uvicorn main:app --reload --host 0.0.0.0 --port 8000`)
Default password if you don't set one: `admin123`.

Frontend (terminal 2):
```
cd frontend
npm install
npm run dev
```

- Players open `http://<your-ip>:5173/` (same Wi-Fi/LAN) and join with a name.
- You open `http://<your-ip>:5173/#/admin` and log in with the organizer password.

## How a round works

1. **Add a round**: title, description, time (seconds), your symbol (stone/paper/scissors/random), and win/draw/loss points. All of these can be edited until the round starts.
2. **Announce**: the description appears on every player's notice board as "up next".
3. **Start round**: the countdown begins. Players pick a symbol and can change it until time is up. Your symbol stays hidden.
4. The round **closes automatically** when the timer ends (or press "End round now"). Your symbol is revealed, points are awarded, and the leaderboard updates.

Players who don't pick in time get 0 points. Only one round can be open at a time.

## Notes

- State lives in server memory. Restarting the backend clears players, rounds and scores.
- "Reset game" clears all rounds and zeroes scores but keeps players registered.
- To deploy: `npm run build` in `frontend/`, serve `dist/` with any static host, and proxy `/api` to the FastAPI server.
