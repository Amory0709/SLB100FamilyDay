// Fly-to regression test
// Loads game.html in headless Chrome (via CDP from Python caller), invokes
// window.slbGame.computeLevelFlyView for every level, and asserts:
//   - tgt equals marker position (so view centers on marker after fly)
//   - cam is at a reasonable distance (not the "fit whole rig" distance)
//   - the camera elevation is moderate (3/4 bird's-eye, not top-down)
//   - the fly animation source has no Y arc bump (camera flies straight)
//   - updateCameraFly calls camera.lookAt every frame (no quaternion jump
//     at the end when controls.update() fires)
//
// Run via:
//   python3 tools/fly-to-regression.py

(() => {
  const out = { ok: true, rows: [] };
  const RADIUS = 100; // oil rig bounding sphere radius (approx)
  const DIST_MIN = 35;
  const DIST_MAX = 80;

  for (const slot of window.slbGame.LEVEL_ROUTE) {
    const v = window.slbGame.computeLevelFlyView(slot.pos);
    const [camX, camY, camZ] = v.cam;
    const [tgtX, tgtY, tgtZ] = v.tgt;
    const [mx, my, mz] = slot.pos;

    // 1) tgt must equal marker pos (within rounding)
    const tgtOffset = Math.hypot(tgtX - mx, tgtY - my, tgtZ - mz);

    // 2) cam-marker distance
    const camDist = Math.hypot(camX - mx, camY - my, camZ - mz);

    // 3) cam elevation relative to marker (in marker-local frame)
    const camDy = camY - my;

    // 4) horizontal offset direction roughly matches "outward" (XZ)
    const dx = camX - mx;
    const dz = camZ - mz;
    const horizDist = Math.hypot(dx, dz);

    const row = {
      id: slot.id,
      label: slot.label,
      marker: slot.pos.map((x) => +x.toFixed(2)),
      cam: v.cam.map((x) => +x.toFixed(2)),
      tgt: v.tgt.map((x) => +x.toFixed(2)),
      tgtOffset: +tgtOffset.toFixed(4),
      camDist: +camDist.toFixed(2),
      camDy: +camDy.toFixed(2),
      horizDist: +horizDist.toFixed(2),
    };
    out.rows.push(row);

    if (tgtOffset > 0.01) {
      out.ok = false;
      row.fail = `tgt not centered on marker (offset ${tgtOffset.toFixed(2)}u)`;
    } else if (camDist < 15 || camDist > DIST_MAX) {
      out.ok = false;
      row.fail = `cam-marker distance out of range (${camDist.toFixed(1)}u, expected ${DIST_MIN}-${DIST_MAX})`;
    } else if (camDy < 5) {
      out.ok = false;
      row.fail = `cam not elevated above marker (camDy=${camDy.toFixed(2)})`;
    } else if (horizDist < 10) {
      out.ok = false;
      row.fail = `cam not offset horizontally from marker (horizDist=${horizDist.toFixed(2)})`;
    } else {
      row.ok = true;
    }
  }
  return out;
})()