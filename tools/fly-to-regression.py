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

    # Wait for model to be ready (computeLevelFlyView needs the loaded model)
    model_ok = False
    for _ in range(60):
        ready = cdp.eval("""(() => {
          const v = window.slbGame?.computeLevelFlyView(window.slbGame?.LEVEL_ROUTE?.[0]?.pos);
          return !!v;
        })()""")
        if ready:
            model_ok = True
            break
        time.sleep(0.5)
    if not model_ok:
        print("ERROR: model never loaded"); sys.exit(1)
    print("✓ game.html loaded, model ready")

    # Run the regression script
    result = cdp.eval(script)
    print(json.dumps(result, indent=2))

    # Static source check: no Y arc bump in updateCameraFly (was causing
    # floaty mid-flight). Also: camera.lookAt is called every frame so
    # the marker doesn't snap into place at t=1.
    import urllib.request
    with urllib.request.urlopen(GAME_URL.replace("/index.html", "/game.html")) as r:
        src = r.read().decode()
    src_ok = True
    if "camera.position.y += arc *" in src:
        print("\n✗ Y arc bump still present in updateCameraFly — fly will feel floaty")
        src_ok = False
    if "camera.lookAt(controls.target)" not in src:
        print("\n✗ camera.lookAt not called per frame — marker will snap at t=1")
        src_ok = False
    if "no arc bump, no overshoot" in src or "Straight lerp" in src:
        print("✓ Fly animation is straight-lerp (no Y arc)")
    else:
        print("? Fly animation comment not found (may be reformatted)")

    if not result.get("ok") or not src_ok:
        print("\n✗ Regression FAILED")
        sys.exit(1)
    print("\n✓ Regression PASSED")

if __name__ == "__main__":
    main()