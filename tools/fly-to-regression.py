#!/usr/bin/env python3
"""Fly-to regression driver: launches headless Chrome (software GL),
loads the game, runs tools/fly-to-regression.mjs, prints results."""
import json, subprocess, sys, time, urllib.request
import websocket

CDP_URL = "http://localhost:9222/json"
GAME_URL = "http://localhost:8765/index.html"
SCRIPT = "tools/fly-to-regression.mjs"

def find_tab():
    with urllib.request.urlopen(CDP_URL) as r:
        tabs = json.load(r)
    for t in tabs:
        if t.get("type") == "page":
            return t
    raise SystemExit("no page tab")

class CDP:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=30)
        self.id = 0
    def send(self, method, params=None, drain_console=True):
        self.id += 1
        msg = {"id": self.id, "method": method}
        if params is not None: msg["params"] = params
        self.ws.send(json.dumps(msg))
        while True:
            resp = json.loads(self.ws.recv())
            if resp.get("id") == self.id:
                if "error" in resp:
                    raise RuntimeError(f"{method}: {resp['error']}")
                return resp.get("result", {})
    def eval(self, expr):
        r = self.send("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        if "exceptionDetails" in r:
            raise RuntimeError(f"JS error: {r['exceptionDetails']}")
        return r.get("result", {}).get("value")

def main():
    with open(SCRIPT) as f:
        script = f.read()

    tab = find_tab()
    cdp = CDP(tab["webSocketDebuggerUrl"])
    cdp.send("Page.enable")
    cdp.send("Runtime.enable")
    cdp.send("Page.navigate", {"url": GAME_URL})
    time.sleep(1)
    # Wait for slbGame
    for _ in range(40):
        if cdp.eval("typeof window.slbGame === 'object' && !!window.slbGame.flyToLevel"):
            break
        time.sleep(0.25)
    else:
        print("ERROR: slbGame never appeared"); sys.exit(1)

    # Run the regression script
    result = cdp.eval(script)
    print(json.dumps(result, indent=2))
    if not result.get("ok"):
        print("\n✗ Regression FAILED")
        sys.exit(1)
    print("\n✓ Regression PASSED")

if __name__ == "__main__":
    main()