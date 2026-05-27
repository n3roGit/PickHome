import {
  viewOrientationFromEvent,
  viewPitchFromOrientation,
  compassHeadingFromOrientation,
} from "../src/lib/device-orientation-ar.ts";
import { isScreenHorizontalFromGravity } from "../src/lib/device-pitch.ts";
import fs from "fs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npx tsx scripts/analyze-ar-poses.mjs <samples.json>");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(input, "utf8"));
const rows = (data.rows ?? data).filter((s) => s.src !== "rel");

function classifyPose(s) {
  const g =
    s.gx != null && s.gy != null && s.gz != null
      ? { x: s.gx, y: s.gy, z: s.gz }
      : null;
  if (g && isScreenHorizontalFromGravity(g.x, g.y, g.z, s.screen)) {
    return s.gz > 0 ? "flat-screen-up" : "flat-screen-down";
  }
  if (s.beta > 45) return "upright";
  if (s.beta < -45) return "upside-down-vertical";
  return "ambiguous";
}

const summary = rows.map((s) => {
    const g =
      s.gx != null && s.gy != null && s.gz != null
        ? { x: s.gx, y: s.gy, z: s.gz }
        : null;
    const view = viewOrientationFromEvent(s.alpha, s.beta, s.gamma, s.screen, g);
    return {
      t: s.t,
      pose: classifyPose(s),
      alpha: +Number(s.alpha).toFixed(1),
      beta: +Number(s.beta).toFixed(1),
      gamma: +Number(s.gamma).toFixed(1),
      g: g ? [+g.x.toFixed(1), +g.y.toFixed(1), +g.z.toFixed(1)] : null,
      flat: view?.flat,
      appHeading: view?.heading != null ? +view.heading.toFixed(1) : null,
      appPitch: view?.pitch != null ? +view.pitch.toFixed(1) : null,
      w3cTopHeading: +compassHeadingFromOrientation(s.alpha, s.beta, s.gamma).toFixed(1),
      matrixPitch: +viewPitchFromOrientation(s.alpha, s.beta, s.gamma, s.screen).toFixed(1),
    };
});

// Cluster by pose for readable output
const clusters = {};
for (const row of summary) {
  (clusters[row.pose] ??= []).push(row);
}
const clusterStats = Object.fromEntries(
  Object.entries(clusters).map(([pose, items]) => {
    const avg = (key) => {
      const nums = items.map((i) => i[key]).filter((v) => typeof v === "number");
      if (!nums.length) return null;
      return +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
    };
    return [
      pose,
      {
        n: items.length,
        alpha: avg("alpha"),
        beta: avg("beta"),
        gamma: avg("gamma"),
        appHeading: avg("appHeading"),
        appPitch: avg("appPitch"),
        w3cTopHeading: avg("w3cTopHeading"),
        flat: items.some((i) => i.flat),
      },
    ];
  })
);

console.log(
  JSON.stringify({ count: rows.length, clusterStats, samples: summary.filter((_, i) => i % Math.max(1, Math.floor(summary.length / 30)) === 0) }, null, 2)
);
