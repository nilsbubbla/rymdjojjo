from __future__ import annotations

import json
import os
import secrets
import sqlite3
import tempfile
import threading
import time
import unicodedata
from collections import defaultdict, deque
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple


SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  used_at_ms INTEGER
);
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  game_version TEXT NOT NULL,
  platform TEXT NOT NULL,
  level INTEGER NOT NULL,
  reached_moon INTEGER NOT NULL,
  altitude INTEGER NOT NULL,
  coins INTEGER NOT NULL,
  lives_remaining INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY(run_id) REFERENCES runs(run_id)
);
CREATE INDEX IF NOT EXISTS scores_rank_idx
  ON scores(score DESC, level DESC, duration_ms ASC, created_at_ms ASC);
"""


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def utc_iso(ms: Optional[int] = None) -> str:
    value = time.time() if ms is None else ms / 1000
    return datetime.fromtimestamp(value, timezone.utc).isoformat().replace("+00:00", "Z")


def load_config(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        cfg = json.load(handle)
    required = {
        "allowed_game_versions", "allowed_platforms", "allowed_origins", "min_score", "max_score",
        "min_duration_ms", "max_duration_ms", "max_average_score_per_second", "run_ttl_ms",
        "elapsed_tolerance_ms", "min_name_length", "max_name_length", "max_request_body_bytes",
        "leaderboard_size", "runs_rate_limit", "scores_rate_limit", "database_path", "json_path",
        "backup_directory", "backup_keep", "listen_host", "listen_port",
    }
    missing = sorted(required - set(cfg))
    if missing:
        raise ValueError("missing config keys: " + ", ".join(missing))
    if not cfg["allowed_game_versions"]:
        raise ValueError("allowed_game_versions must not be empty")
    return cfg


class RateLimiter:
    def __init__(self) -> None:
        self._events = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, bucket: str, key: str, limit: int, window: int, now: Optional[float] = None) -> bool:
        current = time.monotonic() if now is None else now
        identity = (bucket, key)
        with self._lock:
            events = self._events[identity]
            cutoff = current - window
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                return False
            events.append(current)
            return True


class Store:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.db_path = Path(config["database_path"])
        self.json_path = Path(config["json_path"])
        self._publish_lock = threading.Lock()

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=10, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=10000")
        return conn

    def initialize(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.json_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self.connect()) as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=FULL")
            conn.executescript(SCHEMA)
        self.publish()

    def create_run(self, now_ms: Optional[int] = None) -> Dict[str, Any]:
        now = int(time.time() * 1000) if now_ms is None else now_ms
        run_id = secrets.token_urlsafe(32)
        expires = now + int(self.config["run_ttl_ms"])
        with closing(self.connect()) as conn:
            conn.execute(
                "INSERT INTO runs(run_id,created_at_ms,expires_at_ms) VALUES(?,?,?)",
                (run_id, now, expires),
            )
        return {"run_id": run_id, "started_at": utc_iso(now), "expires_at": utc_iso(expires)}

    def _validate(self, body: Any) -> Tuple[str, Dict[str, Any]]:
        if not isinstance(body, dict):
            raise ApiError(400, "invalid_body", "JSON body must be an object")
        required = {
            "run_id", "name", "score", "duration_ms", "game_version", "platform", "level",
            "reached_moon", "altitude", "coins", "lives_remaining",
        }
        fields = set(body)
        if fields != required and fields != required | {"oliver_mode"}:
            raise ApiError(400, "invalid_fields", "body must contain exactly the documented fields")
        if not isinstance(body["run_id"], str) or not body["run_id"]:
            raise ApiError(400, "invalid_run_id", "run_id must be a non-empty string")
        if not isinstance(body["name"], str):
            raise ApiError(400, "invalid_name", "name must be a string")
        name = unicodedata.normalize("NFC", body["name"].strip())
        if not (self.config["min_name_length"] <= len(name) <= self.config["max_name_length"]):
            raise ApiError(422, "invalid_name", "name length is outside the allowed range")
        if any(unicodedata.category(ch) in {"Cc", "Cf", "Cs", "Co", "Cn"} for ch in name):
            raise ApiError(422, "invalid_name", "name contains a disallowed character")

        integer_fields = ("score", "duration_ms", "level", "altitude", "coins", "lives_remaining")
        if any(type(body[field]) is not int for field in integer_fields):
            raise ApiError(400, "invalid_number", "numeric fields must be integers")
        if type(body["reached_moon"]) is not bool:
            raise ApiError(400, "invalid_reached_moon", "reached_moon must be boolean")
        if "oliver_mode" in body and type(body["oliver_mode"]) is not bool:
            raise ApiError(400, "invalid_oliver_mode", "oliver_mode must be boolean")
        if body.get("oliver_mode", False):
            raise ApiError(422, "oliver_mode", "Oliver mode scores are not accepted")
        if body["game_version"] not in self.config["allowed_game_versions"]:
            raise ApiError(422, "blocked_game_version", "game version is not allowed")
        if body["platform"] not in self.config["allowed_platforms"]:
            raise ApiError(422, "invalid_platform", "platform is not allowed")
        if not (self.config["min_score"] <= body["score"] <= self.config["max_score"]):
            raise ApiError(422, "implausible_score", "score is outside the allowed range")
        if not (self.config["min_duration_ms"] <= body["duration_ms"] <= self.config["max_duration_ms"]):
            raise ApiError(422, "implausible_duration", "duration is outside the allowed range")
        if body["score"] / (body["duration_ms"] / 1000.0) > self.config["max_average_score_per_second"]:
            raise ApiError(422, "implausible_rate", "average score rate is too high")
        if not (1 <= body["level"] <= 5):
            raise ApiError(422, "invalid_level", "level must be between 1 and 5")
        if not (0 <= body["altitude"] <= 100 and 0 <= body["coins"] <= 2500 and 0 <= body["lives_remaining"] <= 3):
            raise ApiError(422, "implausible_telemetry", "run telemetry is outside the allowed range")
        if body["reached_moon"] and (body["level"] != 5 or body["altitude"] != 100 or body["lives_remaining"] < 1):
            raise ApiError(422, "implausible_finish", "moon finish telemetry is inconsistent")
        return name, body

    def submit_score(self, body: Any, now_ms: Optional[int] = None) -> Dict[str, Any]:
        name, values = self._validate(body)
        now = int(time.time() * 1000) if now_ms is None else now_ms
        with closing(self.connect()) as conn:
            try:
                conn.execute("BEGIN IMMEDIATE")
                run = conn.execute(
                    "SELECT created_at_ms,expires_at_ms,used_at_ms FROM runs WHERE run_id=?",
                    (values["run_id"],),
                ).fetchone()
                if run is None:
                    raise ApiError(404, "unknown_run", "run_id is unknown")
                if run["used_at_ms"] is not None:
                    raise ApiError(409, "used_run", "run_id has already been used")
                if now > run["expires_at_ms"]:
                    raise ApiError(410, "expired_run", "run_id has expired")
                elapsed = now - run["created_at_ms"]
                if elapsed + self.config["elapsed_tolerance_ms"] < values["duration_ms"]:
                    raise ApiError(422, "impossible_duration", "active duration exceeds server elapsed time")
                cursor = conn.execute(
                    "INSERT INTO scores(run_id,name,score,duration_ms,game_version,platform,level,reached_moon,altitude,coins,lives_remaining,created_at_ms) "
                    "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        values["run_id"], name, values["score"], values["duration_ms"], values["game_version"],
                        values["platform"], values["level"], int(values["reached_moon"]), values["altitude"],
                        values["coins"], values["lives_remaining"], now,
                    ),
                )
                conn.execute("UPDATE runs SET used_at_ms=? WHERE run_id=?", (now, values["run_id"]))
                conn.execute("COMMIT")
                score_id = cursor.lastrowid
            except Exception:
                if conn.in_transaction:
                    conn.execute("ROLLBACK")
                raise
        self.publish()
        rank = self.rank_for(int(score_id))
        return {"id": score_id, "accepted": True, "rank": rank}

    def rank_for(self, score_id: int) -> int:
        with closing(self.connect()) as conn:
            row = conn.execute("SELECT score,level,duration_ms,created_at_ms FROM scores WHERE id=?", (score_id,)).fetchone()
            if row is None:
                return 0
            result = conn.execute(
                "SELECT COUNT(*)+1 FROM scores WHERE score>? OR (score=? AND level>?) OR "
                "(score=? AND level=? AND duration_ms<?) OR "
                "(score=? AND level=? AND duration_ms=? AND created_at_ms<?)",
                (row["score"], row["score"], row["level"], row["score"], row["level"], row["duration_ms"],
                 row["score"], row["level"], row["duration_ms"], row["created_at_ms"]),
            ).fetchone()
            return int(result[0])

    def publish(self) -> None:
        with self._publish_lock:
            with closing(self.connect()) as conn:
                rows = conn.execute(
                    "SELECT id,name,score,duration_ms,level,reached_moon,created_at_ms FROM scores "
                    "ORDER BY score DESC,level DESC,duration_ms ASC,created_at_ms ASC,id ASC LIMIT ?",
                    (int(self.config["leaderboard_size"]),),
                ).fetchall()
            entries = [
                {
                    "rank": rank, "id": row["id"], "name": row["name"], "score": row["score"],
                    "duration_ms": row["duration_ms"], "level": row["level"],
                    "reached_moon": bool(row["reached_moon"]),
                }
                for rank, row in enumerate(rows, 1)
            ]
            payload = json.dumps(
                {"ruleset": "1.1.0", "generated_at": utc_iso(), "entries": entries},
                ensure_ascii=False, separators=(",", ":"),
            ) + "\n"
            self.json_path.parent.mkdir(parents=True, exist_ok=True)
            fd, temp_name = tempfile.mkstemp(prefix=".highscores.", suffix=".tmp", dir=str(self.json_path.parent))
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as handle:
                    handle.write(payload)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.chmod(temp_name, 0o644)
                os.replace(temp_name, self.json_path)
            finally:
                if os.path.exists(temp_name):
                    os.unlink(temp_name)

    def backup(self) -> Path:
        backup_dir = Path(self.config["backup_directory"])
        backup_dir.mkdir(parents=True, exist_ok=True)
        destination = backup_dir / (datetime.now(timezone.utc).strftime("highscores-%Y%m%dT%H%M%S.%fZ") + ".sqlite3")
        with closing(self.connect()) as source, closing(sqlite3.connect(str(destination))) as target:
            source.backup(target)
        os.chmod(destination, 0o600)
        backups = sorted(backup_dir.glob("highscores-*.sqlite3"), reverse=True)
        for old in backups[int(self.config["backup_keep"]):]:
            old.unlink()
        return destination

    def integrity(self) -> str:
        with closing(self.connect()) as conn:
            return str(conn.execute("PRAGMA integrity_check").fetchone()[0])


def safe_request_id() -> str:
    return secrets.token_hex(8)
