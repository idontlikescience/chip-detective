#!/usr/bin/env python3
"""晶片檢測站：本機試玩用伺服器。

提供網頁檔案，加上班級房間的小 API（資料只放在記憶體，關掉就清空）。
之後要放上 GitHub Pages 時，把 net.js 換成 Firebase 版即可，網頁其他部分不用動。

用法：
  python3 server.py            只有這台電腦能連（http://127.0.0.1:8776）
  python3 server.py --lan      同一個 Wi-Fi 的平板也能連（老師控制台的 QR code 會自動換成區網網址）
"""
import json
import os
import random
import re
import secrets
import socket
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = 8776
ROOT = os.path.dirname(os.path.abspath(__file__))
LAN = "--lan" in sys.argv

ROOMS = {}
LOCK = threading.Lock()

MAX_PLAYERS = 80
MAX_TAPS_PER_CHIP = 120
N_CHIPS = 6
GRACE_MS = 5000  # 時間到之後，還收幾秒內送來的最後一筆成績


def now_ms():
    return int(time.time() * 1000)


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def clean_player_data(d):
    """學生送來的成績只留需要的欄位，數字限制在合理範圍，避免灌爆記憶體。"""
    def num(v, lo, hi):
        try:
            return max(lo, min(hi, int(v)))
        except (TypeError, ValueError):
            return lo

    chips = []
    raw = d.get("chips") if isinstance(d.get("chips"), list) else []
    for i in range(N_CHIPS):
        c = raw[i] if i < len(raw) and isinstance(raw[i], dict) else {}
        hits = sorted({num(h, 0, 9) for h in (c.get("hits") or [])[:10]})
        taps = []
        for t in (c.get("taps") or [])[:MAX_TAPS_PER_CHIP]:
            if isinstance(t, list) and len(t) >= 3:
                taps.append([num(t[0], 0, 4096), num(t[1], 0, 4096), num(t[2], -1, 9)])
        chips.append({"seen": num(c.get("seen"), 0, 3_600_000), "hits": hits, "taps": taps})
    return {
        "score": num(d.get("score"), 0, 100000),
        "found": num(d.get("found"), 0, 60),
        "wrong": num(d.get("wrong"), 0, 1000),
        "chips": chips,
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        if "/api/" not in (args[0] if args else ""):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # ── 小工具 ──
    def send_json(self, obj, code=200):
        body = json.dumps({**obj, "now": now_ms()}, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 200_000:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            return {}

    def room_or_404(self, code):
        room = ROOMS.get(code)
        if not room:
            self.send_json({"error": "no-room"}, 404)
        return room

    # ── GET ──
    def do_GET(self):
        u = urlparse(self.path)
        if not u.path.startswith("/api/"):
            return super().do_GET()
        q = {k: v[0] for k, v in parse_qs(u.query).items()}

        if u.path == "/api/info":
            ip = lan_ip() if LAN else None
            return self.send_json({"lan": f"http://{ip}:{PORT}" if ip else None})

        m = re.fullmatch(r"/api/rooms/(\d{4})", u.path)
        if m:
            with LOCK:
                room = self.room_or_404(m[1])
                if not room:
                    return
                out = {"meta": room["meta"]}
                if q.get("key") == room["key"]:  # 老師：附上全班成績（要畫點擊位置時才附 chips）
                    drop = {"_token"} if q.get("taps") == "1" else {"_token", "chips"}
                    out["players"] = {
                        uid: {k: v for k, v in p.items() if k not in drop}
                        for uid, p in room["players"].items()
                    }
                elif q.get("uid") in room["players"] and q.get("token") == room["players"][q["uid"]]["_token"]:
                    p = room["players"][q["uid"]]  # 學生重新整理後接回去
                    out["me"] = {k: v for k, v in p.items() if k != "_token"}
                return self.send_json(out)

        self.send_json({"error": "not-found"}, 404)

    # ── POST ──
    def do_POST(self):
        u = urlparse(self.path)
        d = self.body()

        if u.path == "/api/rooms":
            with LOCK:
                code = None
                for _ in range(200):
                    c = f"{random.randint(1000, 9999)}"
                    if c not in ROOMS:
                        code = c
                        break
                key = secrets.token_hex(12)
                secs = max(10, min(600, int(d.get("seconds") or 50)))
                ROOMS[code] = {
                    "key": key,
                    "meta": {"state": "lobby", "created": now_ms(), "seconds": secs, "startedAt": 0, "endsAt": 0},
                    "players": {},
                }
            return self.send_json({"code": code, "key": key})

        m = re.fullmatch(r"/api/rooms/(\d{4})/(state|kick|join|me)", u.path)
        if not m:
            return self.send_json({"error": "not-found"}, 404)
        code, action = m[1], m[2]
        with LOCK:
            room = self.room_or_404(code)
            if not room:
                return
            meta = room["meta"]

            if action in ("state", "kick"):
                if d.get("key") != room["key"]:
                    return self.send_json({"error": "forbidden"}, 403)
                if action == "kick":
                    room["players"].pop(str(d.get("uid")), None)
                    return self.send_json({"ok": True})
                state = d.get("state")
                if state == "playing":
                    if d.get("seconds"):
                        meta["seconds"] = max(10, min(600, int(d["seconds"])))
                    meta["startedAt"] = now_ms()
                    meta["endsAt"] = meta["startedAt"] + meta["seconds"] * 1000
                elif state == "ended":
                    meta["endsAt"] = min(meta["endsAt"] or now_ms(), now_ms())
                elif state == "lobby":  # 同一個房間重玩：清掉成績，名單保留
                    meta.update(startedAt=0, endsAt=0, created=now_ms())
                    for p in room["players"].values():
                        p.update(clean_player_data({}), t=0)
                    if d.get("seconds"):
                        meta["seconds"] = max(10, min(600, int(d["seconds"])))
                else:
                    return self.send_json({"error": "bad-state"}, 400)
                meta["state"] = state
                return self.send_json({"meta": meta})

            if action == "join":
                name = re.sub(r"\s+", " ", str(d.get("name") or "")).strip()[:8]
                if not name:
                    return self.send_json({"error": "no-name"}, 400)
                if len(room["players"]) >= MAX_PLAYERS:
                    return self.send_json({"error": "full"}, 400)
                uid, token = secrets.token_hex(6), secrets.token_hex(12)
                room["players"][uid] = {"name": name, "_token": token, "t": 0, **clean_player_data({})}
                return self.send_json({"uid": uid, "token": token, "meta": meta})

            if action == "me":
                p = room["players"].get(str(d.get("uid")))
                if not p or d.get("token") != p["_token"]:
                    return self.send_json({"error": "gone"}, 404)
                late = meta["state"] == "ended" and now_ms() > meta["endsAt"] + GRACE_MS
                if meta["state"] == "lobby" or late:
                    return self.send_json({"ok": False, "meta": meta})
                p.update(clean_player_data(d.get("data") or {}), t=now_ms())
                return self.send_json({"ok": True, "meta": meta})


def main():
    host = "0.0.0.0" if LAN else "127.0.0.1"
    srv = ThreadingHTTPServer((host, PORT), Handler)
    print(f"晶片檢測站：http://127.0.0.1:{PORT}/teacher.html（老師控制台）")
    print(f"           http://127.0.0.1:{PORT}/index.html（學生單人練習）")
    if LAN:
        print(f"區網網址：http://{lan_ip()}:{PORT}/  ← 同一個 Wi-Fi 的平板用這個")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
