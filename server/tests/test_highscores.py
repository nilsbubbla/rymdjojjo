import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from rymdresan.server import App, Handler, ThreadingHTTPServer
from rymdresan.service import ApiError, Store


class HighscoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        config_path = Path(__file__).parents[1] / "config.json"
        self.config = json.loads(config_path.read_text(encoding="utf-8"))
        self.config["database_path"] = str(root / "data" / "highscores.sqlite3")
        self.config["json_path"] = str(root / "public" / "highscores.json")
        self.config["backup_directory"] = str(root / "backups")

    def tearDown(self):
        self.temp.cleanup()

    def score(self, run_id, **overrides):
        body = {
            "run_id": run_id,
            "name": "Nils",
            "score": 4200,
            "duration_ms": 90000,
            "game_version": "1.1.0",
            "platform": "web",
            "level": 5,
            "reached_moon": True,
            "altitude": 100,
            "coins": 30,
            "lives_remaining": 2,
            "oliver_mode": False,
        }
        body.update(overrides)
        return body

    def test_score_is_ranked_published_and_single_use(self):
        store = Store(self.config)
        store.initialize()
        run = store.create_run(now_ms=1_000_000)
        result = store.submit_score(self.score(run["run_id"]), now_ms=1_090_000)
        self.assertEqual(1, result["rank"])
        payload = json.loads(Path(self.config["json_path"]).read_text(encoding="utf-8"))
        self.assertEqual("Nils", payload["entries"][0]["name"])
        self.assertEqual(5, payload["entries"][0]["level"])
        with self.assertRaises(ApiError) as duplicate:
            store.submit_score(self.score(run["run_id"]), now_ms=1_091_000)
        self.assertEqual("used_run", duplicate.exception.code)
        self.assertEqual("ok", store.integrity())

    def test_inconsistent_moon_finish_is_rejected(self):
        store = Store(self.config)
        store.initialize()
        run = store.create_run(now_ms=2_000_000)
        with self.assertRaises(ApiError) as invalid:
            store.submit_score(self.score(run["run_id"], altitude=93), now_ms=2_090_000)
        self.assertEqual("implausible_finish", invalid.exception.code)

    def test_oliver_mode_score_is_rejected(self):
        store = Store(self.config)
        store.initialize()
        run = store.create_run(now_ms=3_000_000)
        with self.assertRaises(ApiError) as invalid:
            store.submit_score(self.score(run["run_id"], oliver_mode=True), now_ms=3_090_000)
        self.assertEqual("oliver_mode", invalid.exception.code)

    def test_legacy_submission_without_oliver_mode_is_accepted(self):
        store = Store(self.config)
        store.initialize()
        run = store.create_run(now_ms=4_000_000)
        submission = self.score(run["run_id"], game_version="1.0.0")
        submission.pop("oliver_mode")
        result = store.submit_score(submission, now_ms=4_090_000)
        self.assertTrue(result["accepted"])

    def test_http_cors_run_endpoint_and_health(self):
        app = App(self.config)
        app.store.initialize()
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        server.app = app
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_address[1]}/rymdresan/api/v1"
        try:
            health = urllib.request.urlopen(base + "/health", timeout=2)
            self.assertEqual(200, health.status)
            request = urllib.request.Request(
                base + "/runs",
                data=b"{}",
                method="POST",
                headers={"Content-Type": "application/json", "Origin": "http://localhost:5173"},
            )
            response = urllib.request.urlopen(request, timeout=2)
            self.assertEqual(201, response.status)
            self.assertEqual("http://localhost:5173", response.headers["Access-Control-Allow-Origin"])
            self.assertTrue(json.load(response)["run_id"])
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
