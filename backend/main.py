"""Stone-Paper-Scissors arena: players play against the organizer.

Run:  ORGANIZER_PASSWORD=yourpass uvicorn main:app --reload --host 0.0.0.0 --port 8000
State is kept in memory (restarting the server clears everything).
"""
import os
import random
import threading
import time
import uuid
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ORGANIZER_PASSWORD = os.getenv("ORGANIZER_PASSWORD", "admin123")
COUNTDOWN = 3   # seconds of "3-2-1" before each round opens for picks
BEATS = {"rock": "scissors", "paper": "rock", "scissors": "paper"}

lock = threading.RLock()
players: dict[str, dict] = {}   # player_id -> {name, score}
rounds: list[dict] = []         # draft -> announced -> open -> closed

app = FastAPI(title="Stone Paper Scissors Arena")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class RoundIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field("", max_length=500)
    duration: int = Field(30, ge=5, le=600)                      # seconds
    organizer_symbol: Literal["rock", "paper", "scissors", "random"] = "random"
    win: int = Field(5, ge=0, le=1000)
    draw: int = Field(2, ge=0, le=1000)
    lose: int = Field(0, ge=0, le=1000)


class JoinIn(BaseModel):
    name: str = Field(min_length=1, max_length=30)


class PlayIn(BaseModel):
    player_id: str
    symbol: Literal["rock", "paper", "scissors"]


def admin(x_organizer_key: str = Header(default="")):
    if x_organizer_key != ORGANIZER_PASSWORD:
        raise HTTPException(401, "Wrong organizer password")


def close_round(r: dict):
    sym = r["organizer_symbol"]
    r["results"] = {}
    for pid, p in players.items():
        mv = r["moves"].get(pid)
        if mv is None:
            outcome, pts = "no move", 0
        elif mv == sym:
            outcome, pts = "draw", r["draw"]
        elif BEATS[mv] == sym:
            outcome, pts = "win", r["win"]
        else:
            outcome, pts = "lose", r["lose"]
        r["results"][pid] = {"symbol": mv, "outcome": outcome, "points": pts}
        p["score"] += pts
    r["status"] = "closed"


def tick():
    """Number the rounds and auto-close any round whose timer has run out."""
    now = time.time()
    for i, r in enumerate(rounds):
        r["number"] = i + 1
        if r["status"] == "open" and now >= r["ends_at"]:
            close_round(r)


def find(rid: str) -> dict:
    r = next((x for x in rounds if x["id"] == rid), None)
    if not r:
        raise HTTPException(404, "Round not found")
    return r


def board(pid: str = ""):
    rows = [{"name": p["name"], "score": p["score"], "me": i == pid} for i, p in players.items()]
    return sorted(rows, key=lambda x: (-x["score"], x["name"].lower()))


def public(r: dict, pid: str = ""):
    closed = r["status"] == "closed"
    v = {k: r[k] for k in ("id", "number", "title", "description", "duration",
                           "win", "draw", "lose", "status", "starts_at", "ends_at")}
    v["organizer_symbol"] = r["organizer_symbol"] if closed else None   # hidden until the round ends
    v["my_move"] = r["moves"].get(pid)
    v["my_result"] = r["results"].get(pid) if closed else None
    return v


def admin_view(r: dict):
    v = {k: x for k, x in r.items() if k not in ("moves", "results")}
    v["move_count"] = len(r["moves"])
    v["results"] = sorted(({"name": players[pid]["name"], **res} for pid, res in r["results"].items()),
                          key=lambda x: -x["points"])
    return v


# ---------------------------------------------------------------- players
@app.post("/api/join")
def join(body: JoinIn):
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "Enter a name")
    with lock:
        if any(p["name"].lower() == name.lower() for p in players.values()):
            raise HTTPException(409, "That name is taken. Pick another one.")
        pid = uuid.uuid4().hex
        players[pid] = {"name": name, "score": 0}
    return {"player_id": pid, "name": name}


@app.get("/api/state")
def state(player_id: str = ""):
    with lock:
        tick()
        me = players.get(player_id)
        visible = [r for r in rounds if r["status"] != "draft"]
        current = (next((r for r in visible if r["status"] == "open"), None)
                   or next((r for r in visible if r["status"] == "announced"), None)
                   or (visible[-1] if visible else None))
        return {
            "server_time": time.time(),
            "me": {"name": me["name"], "score": me["score"]} if me else None,
            "current": public(current, player_id) if current else None,
            "notifications": [public(r, player_id) for r in visible],
            "leaderboard": board(player_id),
        }


@app.post("/api/play")
def play(body: PlayIn):
    with lock:
        tick()
        if body.player_id not in players:
            raise HTTPException(404, "Unknown player. Join again.")
        r = next((x for x in rounds if x["status"] == "open"), None)
        if not r:
            raise HTTPException(409, "No round is open right now")
        if time.time() < r["starts_at"]:
            raise HTTPException(409, "Wait for the countdown to finish")
        r["moves"][body.player_id] = body.symbol    # can be changed until time is up
    return {"ok": True}


# -------------------------------------------------------------- organizer
@app.get("/api/admin/state", dependencies=[Depends(admin)])
def admin_state():
    with lock:
        tick()
        return {"server_time": time.time(), "rounds": [admin_view(r) for r in rounds],
                "leaderboard": board(), "player_count": len(players)}


@app.post("/api/admin/rounds", dependencies=[Depends(admin)])
def create_round(body: RoundIn):
    with lock:
        r = {"id": uuid.uuid4().hex[:8], **body.model_dump(), "status": "draft",
             "starts_at": None, "ends_at": None, "moves": {}, "results": {}}
        rounds.append(r)
    return {"id": r["id"]}


@app.put("/api/admin/rounds/{rid}", dependencies=[Depends(admin)])
def edit_round(rid: str, body: RoundIn):
    with lock:
        tick()
        r = find(rid)
        if r["status"] not in ("draft", "announced"):
            raise HTTPException(409, "Only rounds that have not started can be edited")
        r.update(body.model_dump())
    return {"ok": True}


@app.delete("/api/admin/rounds/{rid}", dependencies=[Depends(admin)])
def delete_round(rid: str):
    with lock:
        tick()
        r = find(rid)
        if r["status"] not in ("draft", "announced"):
            raise HTTPException(409, "Started rounds can't be deleted")
        rounds.remove(r)
    return {"ok": True}


@app.post("/api/admin/rounds/{rid}/{action}", dependencies=[Depends(admin)])
def round_action(rid: str, action: Literal["announce", "start", "end"]):
    with lock:
        tick()
        r = find(rid)
        if action == "announce":
            if r["status"] != "draft":
                raise HTTPException(409, "Round is already announced")
            r["status"] = "announced"
        elif action == "start":
            if r["status"] not in ("draft", "announced"):
                raise HTTPException(409, "Round already started")
            if any(x["status"] == "open" for x in rounds):
                raise HTTPException(409, "Another round is still open")
            if r["organizer_symbol"] == "random":
                r["organizer_symbol"] = random.choice(list(BEATS))
            r["status"] = "open"
            r["starts_at"] = time.time() + COUNTDOWN          # 3-2-1 countdown, then picks open
            r["ends_at"] = r["starts_at"] + r["duration"]
        else:
            if r["status"] != "open":
                raise HTTPException(409, "Round is not open")
            close_round(r)
    return {"ok": True}


@app.post("/api/admin/reset", dependencies=[Depends(admin)])
def reset():
    """Delete all rounds and zero every score (players stay registered)."""
    with lock:
        rounds.clear()
        for p in players.values():
            p["score"] = 0
    return {"ok": True}
