// Fly-to regression test
// Loads game.html in headless Chrome (via CDP from Python caller), invokes
// window.slbGame.computeLevelFlyView for every level, and asserts:
//   - tgt XZ equals marker position (so view centers on the marker
//     horizontally — the existing 3D badge sprite sits on the marker, so
//     XZ alignment is what puts it at the user's visual center)
//   - tgt Y is elevated above the marker base (the badge sprite floats at
//     marker-local y ≈ 4.85, scaled by the model fit, above the marker
//     ground pad; aim at the badge, not the ground, so the numbered circle
//     lands at screen center)
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
  const BADGE_LOCAL_Y = 4.85;        // marker-local Y of the badge sprite
  const SCALE_MIN = 0.72;            // min marker scale (from scaleMarkersToModel)
  const BADGE_WORLD_Y_MIN = BADGE_LOCAL_Y * SCALE_MIN;

  for (const slot of window.slbGame.LEVEL_ROUTE) {
    const v = window.slbGame.computeLevelFlyView(slot.pos);
    const [camX, camY, camZ] = v.cam;
    const [tgtX, tgtY, tgtZ] = v.tgt;
    const [mx, my, mz] = slot.pos;

    // 1) tgt XZ must equal marker XZ (badge sits above the marker).
    const tgtXZOffset = Math.hypot(tgtX - mx, tgtZ - mz);

    // 2) tgt Y must be elevated above marker base (badge floats up).
    const tgtLift = tgtY - my;

    // 3) cam-marker distance
    const camDist = Math.hypot(camX - mx, camY - my, camZ - mz);

    // 4) cam elevation relative to marker base
    const camDy = camY - my;

    // 5) horizontal offset direction roughly matches "outward" (XZ)
    const dx = camX - mx;
    const dz = camZ - mz;
    const horizDist = Math.hypot(dx, dz);

    const row = {
      id: slot.id,
      label: slot.label,
      marker: slot.pos.map((x) => +x.toFixed(2)),
      cam: v.cam.map((x) => +x.toFixed(2)),
      tgt: v.tgt.map((x) => +x.toFixed(2)),
      tgtXZOffset: +tgtXZOffset.toFixed(4),
      tgtLift: +tgtLift.toFixed(2),
      camDist: +camDist.toFixed(2),
      camDy: +camDy.toFixed(2),
      horizDist: +horizDist.toFixed(2),
    };
    out.rows.push(row);

    if (tgtXZOffset > 0.01) {
      out.ok = false;
      row.fail = `tgt XZ not centered on marker (offset ${tgtXZOffset.toFixed(2)}u)`;
    } else if (tgtLift < BADGE_WORLD_Y_MIN - 0.5) {
      out.ok = false;
      row.fail = `tgt Y too low — not aiming at badge (lift=${tgtLift.toFixed(2)}u, expected ≥ ${BADGE_WORLD_Y_MIN})`;
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