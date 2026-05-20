import { resetExternalFetchState } from "../src/lib/external-fetch.ts";
import { fetchTransitJourney } from "../src/lib/transit-routing.ts";
import { resolveTransitSettings } from "../src/lib/transit-settings.ts";

resetExternalFetchState();

const settings = resolveTransitSettings({
  transitArrivalHour: 8,
  transitArrivalMinute: 0,
  transitArrivalWeekday: 1,
  transitFallbackMaxKm: 5,
  transitFallbackMode: "bike",
});

const route = {
  label: process.argv[2] ?? "Stuhr -> Bremen",
  from: { latitude: 53.0096517, longitude: 8.7879144 },
  fromAddress: "Richtweg 5, 28816 Stuhr",
  to: { latitude: 53.0804315, longitude: 8.7959247 },
  toAddress: "Radio Bremen Diepenau 10 28195 Bremen",
};

const t0 = Date.now();
const result = await fetchTransitJourney({ ...route, settings });
const ms = Date.now() - t0;

console.log(route.label);
if (!result) {
  console.log("FAIL", ms + "ms");
  process.exit(1);
}

console.log("OK", ms + "ms");
console.log("  summary:", result.connectionSummary);
console.log("  duration:", Math.round(result.durationSeconds / 60), "min");
console.log(
  "  legs:",
  result.legDetails.map((l) => (l.kind === "walk" ? "Fuß" : l.lineName)).join(" -> ")
);
