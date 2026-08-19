const fs = require("fs");
const p = "c:/Users/mikeh/Projects/landi/sandals/agentable-canvas/scripts/gate7-browser-12-iter3.mjs";
let s = fs.readFileSync(p, "utf8");
s = s.replace(/\nfunction deepQuerySelector[\s\S]*?\nfunction shadowQuery\(\) \{\n/, "\nfunction shadowQuery() {\n");
if (!s.includes("function deepQuerySelector(selector) {")) {
  s = s.replace(
    "function shadowQuery() {\n  const FUNNEL",
    `function shadowQuery() {
  function deepQuerySelector(selector) {
    const roots = [];
    const wb = document.querySelector('agentable-whiteboard');
    if (wb?.shadowRoot) roots.push(wb.shadowRoot);
    const seen = new Set();
    while (roots.length > 0) {
      const root = roots.shift();
      if (root === undefined || seen.has(root)) continue;
      seen.add(root);
      const hit = root.querySelector(selector);
      if (hit) return hit;
      root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) roots.push(el.shadowRoot); });
    }
    return null;
  }
  function deepTextIncludes(needle) {
    const roots = [document];
    const wb = document.querySelector('agentable-whiteboard');
    if (wb?.shadowRoot) roots.push(wb.shadowRoot);
    const seen = new Set();
    while (roots.length > 0) {
      const root = roots.shift();
      if (root === undefined || seen.has(root)) continue;
      seen.add(root);
      if ((root.textContent ?? '').includes(needle)) return true;
      if ('querySelectorAll' in root) root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) roots.push(el.shadowRoot); });
    }
    return false;
  }
  const FUNNEL`,
  );
}
fs.writeFileSync(p, s);
console.log("inlined helpers");
