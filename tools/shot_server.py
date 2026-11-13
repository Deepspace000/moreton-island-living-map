# Tiny local receiver: the page POSTs canvas PNGs here so screenshots can be saved for review.
import base64, os, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'shots')
class H(BaseHTTPRequestHandler):
    def _h(self, c=200):
        self.send_response(c); self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Headers', '*'); self.end_headers()
    def do_OPTIONS(self): self._h()
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); d = self.rfile.read(n).decode()
        name = os.path.basename(self.path.strip('/')) or 'shot.png'
        open(os.path.join(OUT, name), 'wb').write(base64.b64decode(d.split(',', 1)[1])); self._h(); self.wfile.write(b'ok')
    def log_message(self, *a): pass
HTTPServer(('127.0.0.1', 8765), H).serve_forever()
