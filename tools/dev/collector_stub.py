"""Stand-in for the Google Apps Script web app, for local testing only.

Accepts the same POSTs the browser sends to the real collector (text/plain body,
fire-and-forget) and appends each payload to collector_log.jsonl so the test can
assert that sign-ups and sign-ins really leave the page.
"""
import json, pathlib, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

LOG = pathlib.Path(__file__).resolve().parent / "collector_log.jsonl"


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n).decode("utf-8", "replace")
        with LOG.open("a", encoding="utf-8") as fh:
            fh.write(body.strip() + "\n")
        print("collector got:", body[:160], flush=True)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write("RoboCL collector stub is running".encode("utf-8"))

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    LOG.write_text("", encoding="utf-8")
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8098
    print(f"collector stub on http://127.0.0.1:{port}/collect -> {LOG}", flush=True)
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()
