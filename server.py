#!/usr/bin/env python3
"""晶片懸案：本機測試用伺服器。

提供網頁檔案，加上一個很簡單的「路徑資料庫」API，模仿 Firebase 的讀寫（資料只放在記憶體，關掉就清空，也不檢查權限）。
firebase-config.js 有填設定時，網頁會直接連 Firebase，用不到這個伺服器的 API，只拿它來開網頁。

用法：
  python3 server.py            只有這台電腦能連（http://127.0.0.1:8777）
  python3 server.py --lan      同一個 Wi-Fi 的平板也能連
"""
import json
import os
import socket
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = 8777
ROOT = os.path.dirname(os.path.abspath(__file__))
LAN = "--lan" in sys.argv
DATA = {}
LOCK = threading.Lock()


def now_ms():
    return int(time.time() * 1000)


def parts(path):
    return [p for p in str(path or "").split("/") if p]


def get_at(path):
    node = DATA
    for p in parts(path):
        if not isinstance(node, dict) or p not in node:
            return None
        node = node[p]
    return node


def prune(node):
    """跟 Firebase 一樣：值是 None 或空物件就當作不存在。"""
    if isinstance(node, dict):
        for k in list(node):
            node[k] = prune(node[k])
            if node[k] is None:
                del node[k]
        return node or None
    return node


def set_at(path, value):
    ps = parts(path)
    if not ps:
        return
    node = DATA
    for p in ps[:-1]:
        if not isinstance(node.get(p), dict):
            node[p] = {}
        node = node[p]
    node[ps[-1]] = value
    prune(DATA)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        if "/api/" not in (args[0] if args else ""):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, obj, code=200):
        body = json.dumps({**obj, "now": now_ms()}, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/api/db":
            q = {k: v[0] for k, v in parse_qs(u.query).items()}
            with LOCK:
                return self.send_json({"value": get_at(q.get("path"))})
        if u.path == "/api/info":
            ip = None
            if LAN:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                try:
                    s.connect(("10.255.255.255", 1))
                    ip = s.getsockname()[0]
                except OSError:
                    pass
                finally:
                    s.close()
            return self.send_json({"lan": f"http://{ip}:{PORT}" if ip else None})
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/db":
            return self.send_json({"error": "not-found"}, 404)
        n = int(self.headers.get("Content-Length") or 0)
        try:
            d = json.loads(self.rfile.read(min(n, 500_000)) or b"{}")
        except json.JSONDecodeError:
            return self.send_json({"error": "bad-json"}, 400)
        with LOCK:
            op, path = d.get("op"), d.get("path")
            if op == "set":
                set_at(path, d.get("value"))
            elif op == "update":
                for k, v in (d.get("value") or {}).items():
                    set_at(f"{path}/{k}", v)
            elif op == "remove":
                set_at(path, None)
            else:
                return self.send_json({"error": "bad-op"}, 400)
        return self.send_json({"ok": True})


def main():
    host = "0.0.0.0" if LAN else "127.0.0.1"
    srv = ThreadingHTTPServer((host, PORT), Handler)
    print(f"晶片懸案：http://127.0.0.1:{PORT}/teacher.html（老師控制台）")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
