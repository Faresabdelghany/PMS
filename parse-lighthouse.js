const fs = require("fs");
const pages = ["login", "inbox", "projects", "tasks", "clients", "settings"];
const results = [];
for (const p of pages) {
  const file = "lighthouse-" + p + ".json";
  if (!fs.existsSync(file)) { results.push({ page: p, error: "no report" }); continue; }
  try {
    const report = JSON.parse(fs.readFileSync(file, "utf8"));
    const cats = report.categories;
    results.push({
      page: p,
      performance: Math.round((cats.performance?.score || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score || 0) * 100),
      bestPractices: Math.round((cats["best-practices"]?.score || 0) * 100),
      seo: Math.round((cats.seo?.score || 0) * 100),
      fcp: report.audits?.["first-contentful-paint"]?.numericValue,
      lcp: report.audits?.["largest-contentful-paint"]?.numericValue,
      cls: report.audits?.["cumulative-layout-shift"]?.numericValue,
      tbt: report.audits?.["total-blocking-time"]?.numericValue,
      si: report.audits?.["speed-index"]?.numericValue,
    });
  } catch(e) { results.push({ page: p, error: e.message.substring(0, 100) }); }
}
console.log(JSON.stringify(results, null, 2));
fs.writeFileSync("perf-lighthouse-results.json", JSON.stringify(results, null, 2));
console.log("\n--- SUMMARY TABLE ---");
console.log("Page        | Perf | A11y | BP   | SEO  | FCP(ms) | LCP(ms) | CLS   | TBT(ms) | SI(ms)");
console.log("------------|------|------|------|------|---------|---------|-------|---------|--------");
for (const r of results) {
  if (r.error) { console.log(r.page.padEnd(12) + "| ERROR: " + r.error); continue; }
  console.log(
    r.page.padEnd(12) + "| " +
    String(r.performance).padEnd(5) + "| " +
    String(r.accessibility).padEnd(5) + "| " +
    String(r.bestPractices).padEnd(5) + "| " +
    String(r.seo).padEnd(5) + "| " +
    String(Math.round(r.fcp || 0)).padEnd(8) + "| " +
    String(Math.round(r.lcp || 0)).padEnd(8) + "| " +
    String((r.cls || 0).toFixed(3)).padEnd(6) + "| " +
    String(Math.round(r.tbt || 0)).padEnd(8) + "| " +
    String(Math.round(r.si || 0))
  );
}
