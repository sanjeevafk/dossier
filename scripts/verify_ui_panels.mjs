/**
 * UI panel verification (A1/A2): extracts renderSobolPanel + renderValidationPriority
 * (and prettyParam) from public/index.html, runs them against a real dossier fetched
 * from a heuristic-mode server, with a minimal DOM shim. Asserts panel behavior.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const html = fs.readFileSync(path.join(process.cwd(), "public", "index.html"), "utf-8");

function extract(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `function ${name} must exist in index.html`);
  let depth = 0;
  let i = html.indexOf("{", start);
  let j = i;
  for (; j < html.length; j++) {
    if (html[j] === "{") depth++;
    else if (html[j] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return html.slice(start, j + 1);
}

const source = [extract("prettyParam"), extract("renderSobolPanel"), extract("renderValidationPriority")].join("\n");

// --- minimal DOM shim ---
function makeEl(id) {
  return {
    id,
    classes: new Set(),
    innerHTML: "",
    children: [],
    classList: {
      add: (c) => makeEl(id).classes, // replaced below
      remove: () => {},
      contains: () => false
    },
    appendChild(child) {
      this.children.push(child);
    },
    set textContent(v) {
      this._text = v;
    },
    get textContent() {
      return this._text || "";
    }
  };
}
const elements = new Map();
function el(id) {
  if (!elements.has(id)) {
    const e = makeEl(id);
    e.classList = {
      add: (c) => e.classes.add(c),
      remove: (c) => e.classes.delete(c),
      contains: (c) => e.classes.has(c)
    };
    elements.set(id, e);
  }
  return elements.get(id);
}
const document = {
  getElementById: (id) => el(id),
  createElement: (tag) => makeEl(`created-${tag}-${Math.random().toString(36).slice(2)}`)
};
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

// --- load renderers ---
const factory = new Function("document", "escapeHtml", `${source}\nreturn { renderSobolPanel, renderValidationPriority };`);
const { renderSobolPanel, renderValidationPriority } = factory(document, escapeHtml);

// --- real dossier from a heuristic-mode server run (fetched via storage file) ---
const reportsDir = path.join(process.cwd(), "reports");
const files = fs.readdirSync(reportsDir).filter((f) => f.startsWith("dossier_") && f.endsWith(".json")).map((f) => ({
  f,
  m: fs.statSync(path.join(reportsDir, f)).mtimeMs
})).sort((a, b) => b.m - a.m);
assert.ok(files.length > 0, "no dossier reports found — run an evaluation first");
const dossier = JSON.parse(fs.readFileSync(path.join(reportsDir, files[0].f), "utf-8"));
console.log(`verifying against dossier ${dossier.id} (${dossier.overallVerdict} ${dossier.killScore}/100)`);

// --- Sobol panel ---
renderSobolPanel(dossier);
const sobol = dossier.simulation && dossier.simulation.sobol;
const sobolCard = el("sobolCard");
const sobolList = el("sobolList");
if (sobol && sobol.outputs && sobol.outputs.ltv_cac) {
  assert.ok(!sobolCard.classes.has("hidden"), "sobol card must be visible when sobol data exists");
  const n = sobol.ltvCacSensitivityRanking.length;
  assert.equal(sobolList.children.length, n, `sobol list must render ${n} param rows`);
  const htmlOut = sobolList.children.map((c) => c.innerHTML).join("");
  assert.ok(htmlOut.includes("%") && htmlOut.includes("total"), "sobol rows must carry share percentages");
  assert.ok(el("sobolNotes").textContent.length > 10, "sobol notes must be populated");
  console.log(`✓ Sobol panel: ${n} rows rendered, top driver = ${sobol.ltvCacSensitivityRanking[0].param}`);
} else {
  assert.ok(sobolCard.classes.has("hidden"), "sobol card must stay hidden without sobol data");
  console.log("✓ Sobol panel: honestly hidden (no sobol data in this dossier)");
}

// --- Validation priority panel ---
renderValidationPriority(dossier);
const vpSection = el("validationPrioritySection");
const vpList = el("validationPriorityList");
const vp = dossier.validationPriority || [];
if (vp.length > 0) {
  assert.ok(!vpSection.classes.has("hidden"), "validation priority section must be visible when ranked items exist");
  assert.equal(vpList.children.length, vp.length, "one row per validation priority item");
  const joined = vpList.children.map((c) => c.innerHTML).join("");
  assert.ok(joined.includes(vp[0].experimentTitle), "top experiment title must render");
  assert.ok(joined.includes("/customer"), "EVPI per-customer value must render");
  console.log(`✓ Validation priority panel: ${vp.length} ranked experiments, top = ${vp[0].experimentTitle}`);
} else {
  assert.ok(vpSection.classes.has("hidden"), "validation priority section must stay hidden when empty");
  console.log("✓ Validation priority panel: honestly hidden (EVPI = 0 on this dossier)");
}

// --- hidden-state check with an empty dossier shape ---
renderSobolPanel({ simulation: {} });
assert.ok(el("sobolCard").classes.has("hidden"), "sobol card must hide for missing simulation data");
renderValidationPriority({});
assert.ok(el("vpSection"), "no crash on empty dossier");

// --- positive-case check for the validation priority panel (synthetic EVPI data;
//     avoids running a full evaluation while heavy agy benchmark load is active —
//     the real-data path is identical code and covered by test/quant.test.mjs) ---
renderValidationPriority({
  validationPriority: [
    {
      param: "churn_mean",
      evpiPerCustomer: 1.25,
      shareOfEvpi: 0.62,
      experimentTitle: "Churn Resolution Cohort",
      experimentDescription: "Track a 50-user pilot cohort for 14 days."
    },
    {
      param: "cac_mean",
      evpiPerCustomer: 0.5,
      shareOfEvpi: 0.24,
      experimentTitle: "Live-Channel CAC Test",
      experimentDescription: "Spend $50–100 in one channel."
    }
  ]
});
assert.ok(!el("validationPrioritySection").classes.has("hidden"), "positive case must show the section");
assert.equal(el("validationPriorityList").children.length, 2, "two ranked rows must render");
const posHtml = el("validationPriorityList").children.map((c) => c.innerHTML).join("");
assert.ok(posHtml.includes("Churn Resolution Cohort"), "top experiment must render");
assert.ok(posHtml.includes("$1.25/customer"), "EVPI value must render");
assert.ok(posHtml.includes("62% of decision value"), "share must render");
console.log("✓ Validation priority panel: positive case renders ranked EVPI rows");

console.log("\n✔ UI panel verification passed");
