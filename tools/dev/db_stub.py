"""Stand-in for the Supabase RPC endpoints, for local testing only.

Implements exactly the contract of tools/supabase-accounts.sql so the browser
side can be exercised without a live project:
    POST /rest/v1/rpc/robo_signup           -> {ok:true,username} | {ok:false,error}
    POST /rest/v1/rpc/robo_login            -> {ok:true,username,logins,created}
    POST /rest/v1/rpc/robo_logout           -> {ok:true}
    POST /rest/v1/rpc/robo_admin_accounts   -> {ok:true,accounts:[],events:[]}
Every request and response is appended to db_stub_log.jsonl for inspection.
"""
import hashlib, json, pathlib, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = pathlib.Path(__file__).resolve().parent
STORE = HERE / "db_stub_accounts.json"
LOG = HERE / "db_stub_log.jsonl"
SECRET = "testsecret"


def load():
    if STORE.exists():
        return json.loads(STORE.read_text(encoding="utf-8"))
    return {"accounts": {}, "events": []}


def save(db):
    STORE.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")


def log(entry):
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def hpw(p):
    return "stub$" + hashlib.sha256(("salt" + p).encode()).hexdigest()


class RPC(BaseHTTPRequestHandler):
    def _cors(self):
        # Supabase's REST API sends these; the local stub must too, or the
        # browser blocks the POST at the preflight stage.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type, apikey, authorization, accept, prefer")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n).decode("utf-8", "replace")
        fn = self.path.rstrip("/").split("/")[-1]
        try:
            args = json.loads(body or "{}")
        except Exception:
            args = {}
        db = load()
        out = {"ok": False, "error": "unknown"}
        ua = args.get("p_username", "")
        key = (ua or "").lower()

        if fn == "robo_signup":
            if key in db["accounts"]:
                out = {"ok": False, "error": "taken"}
            else:
                db["accounts"][key] = {
                    "username": ua, "pwhash": hpw(args.get("p_password", "")),
                    "created": "2026-09-11T02:00:00Z", "last_login": "2026-09-11T02:00:00Z",
                    "logins": 1, "failed": 0, "lang": args.get("p_lang", "km"),
                }
                db["events"].append({"username": ua, "type": "signup", "device": args.get("p_device"), "created": "2026-09-11T02:00:00Z"})
                out = {"ok": True, "username": ua, "id": len(db["accounts"])}
                save(db)
        elif fn == "robo_login":
            acc = db["accounts"].get(key)
            if not acc:
                db["events"].append({"username": ua, "type": "signin_failed", "device": args.get("p_device"), "reason": "no_account", "created": "2026-09-11T02:01:00Z"})
                save(db)
                out = {"ok": False, "error": "bad_credentials"}
            elif acc["pwhash"] == hpw(args.get("p_password", "")):
                acc["logins"] = int(acc.get("logins", 0)) + 1
                db["events"].append({"username": acc["username"], "type": "signin", "device": args.get("p_device"), "created": "2026-09-11T02:01:00Z"})
                save(db)
                out = {"ok": True, "username": acc["username"], "logins": acc["logins"], "created": acc["created"]}
            else:
                acc["failed"] = int(acc.get("failed", 0)) + 1
                db["events"].append({"username": acc["username"], "type": "signin_failed", "device": args.get("p_device"), "reason": "bad_password", "created": "2026-09-11T02:01:00Z"})
                save(db)
                out = {"ok": False, "error": "bad_credentials"}
        elif fn == "robo_logout":
            out = {"ok": True}
        elif fn == "robo_admin_accounts":
            if args.get("p_secret") != SECRET:
                out = {"ok": False, "error": "forbidden"}
            else:
                out = {"ok": True,
                       "accounts": [{"username": a["username"], "created": a["created"], "last_login": a["last_login"],
                                     "logins": a["logins"], "failed": a["failed"], "lang": a["lang"]}
                                    for a in db["accounts"].values()],
                       "events": db["events"][-50:]}

        payload = json.dumps(out).encode("utf-8")
        log({"fn": fn, "had_apikey": bool(self.headers.get("apikey")), "request": args, "response": out})
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self._cors()
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"db stub is running")

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    LOG.write_text("", encoding="utf-8")
    if STORE.exists():
        STORE.unlink()
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8096
    print(f"db stub on http://127.0.0.1:{port}/rest/v1/rpc/... (secret={SECRET})", flush=True)
    HTTPServer(("127.0.0.1", port), RPC).serve_forever()
