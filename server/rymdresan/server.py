import argparse
import json
import logging
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .service import ApiError, RateLimiter, Store, load_config, safe_request_id


class App:
    def __init__(self, config):
        self.config = config
        self.store = Store(config)
        self.limiter = RateLimiter()
        self.logger = logging.getLogger("rymdresan")


class Handler(BaseHTTPRequestHandler):
    server_version = "Rymdresan/1"

    def log_message(self, fmt, *args):
        return

    def _origin(self):
        origin = self.headers.get("Origin")
        if origin and origin not in self.server.app.config["allowed_origins"]:
            raise ApiError(403, "origin_denied", "origin is not allowed")
        return origin

    def _reply(self, status, payload, origin=None):
        data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(data)

    def _client_key(self):
        peer = self.client_address[0]
        forwarded = self.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip()
        return forwarded if peer in {"127.0.0.1", "::1"} and forwarded else peer

    def _body(self):
        raw_length = self.headers.get("Content-Length")
        if raw_length is None or not raw_length.isdigit():
            raise ApiError(411, "length_required", "valid Content-Length is required")
        length = int(raw_length)
        if length > int(self.server.app.config["max_request_body_bytes"]):
            raise ApiError(413, "body_too_large", "request body is too large")
        try:
            return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ApiError(400, "invalid_json", "body must be valid UTF-8 JSON")

    def do_OPTIONS(self):
        try:
            origin = self._origin()
            self.send_response(204)
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Max-Age", "600")
            self.end_headers()
        except ApiError as exc:
            self._reply(exc.status, {"error": {"code": exc.code, "message": exc.message}})

    def do_GET(self):
        request_id = safe_request_id()
        try:
            origin = self._origin()
            if self.path != "/rymdresan/api/v1/health":
                raise ApiError(404, "not_found", "endpoint not found")
            self._reply(200, {"ok": True, "service": "rymdresan-highscores"}, origin)
        except ApiError as exc:
            self._reply(exc.status, {"error": {"code": exc.code, "message": exc.message}, "request_id": request_id})

    def do_POST(self):
        request_id = safe_request_id()
        status, code, origin = 500, "internal_error", None
        try:
            app = self.server.app
            origin = self._origin()
            route = {"/rymdresan/api/v1/runs": "runs", "/rymdresan/api/v1/scores": "scores"}.get(self.path)
            if route is None:
                raise ApiError(404, "not_found", "endpoint not found")
            rule = app.config[route + "_rate_limit"]
            if not app.limiter.allow(route, self._client_key(), int(rule["requests"]), int(rule["window_seconds"])):
                raise ApiError(429, "rate_limited", "rate limit exceeded")
            body = self._body()
            if route == "runs":
                if body != {}:
                    raise ApiError(400, "invalid_body", "runs body must be an empty JSON object")
                result, status = app.store.create_run(), 201
            else:
                result, status = app.store.submit_score(body), 201
            code = "ok"
            self._reply(status, result, origin)
        except ApiError as exc:
            status, code = exc.status, exc.code
            self._reply(status, {"error": {"code": exc.code, "message": exc.message}, "request_id": request_id}, origin)
        except Exception:
            self.server.app.logger.exception("unhandled request error")
            self._reply(500, {"error": {"code": code, "message": "internal server error"}, "request_id": request_id}, origin)
        finally:
            self.server.app.logger.info(json.dumps({"event": "request", "request_id": request_id, "method": "POST", "path": self.path, "status": status, "result": code}, separators=(",", ":")))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    config = load_config(args.config)
    app = App(config)
    app.store.initialize()
    server = ThreadingHTTPServer((config["listen_host"], int(config["listen_port"])), Handler)
    server.app = app
    app.logger.info(json.dumps({"event": "service_started", "host": config["listen_host"], "port": config["listen_port"]}))
    server.serve_forever()


if __name__ == "__main__":
    main()

