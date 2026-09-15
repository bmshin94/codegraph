// Standalone benchmark harness; see docs/benchmarks/regression-audit-2026-09.md.
// Arguments: built engine directory, fixture root, existing output directory, native|wasm.
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { DatabaseSync } = require('node:sqlite');
const [engine, root, out, backend] = process.argv.slice(2);
const begin = performance.now();
const { CodeGraph } = require(path.join(engine, 'dist/index.js'));
const loader = require(path.join(engine, 'dist/extraction/kernel/loader.js'));
const result = { engine, root, backend, node: process.version, stages: [] };
let cg;
const orig = CodeGraph.prototype.resolveReferencesBatched;
CodeGraph.prototype.resolveReferencesBatched = async function (...args) {
  const stage = { name: 'resolution-and-synthesis', startEpochMs: Date.now(), memoryBefore: process.memoryUsage(), refsBefore: this.db.getDb().prepare('SELECT count(*) AS n FROM unresolved_refs').get().n };
  const start = performance.now(), cpu = process.cpuUsage();
  try { const value = await orig.apply(this, args); stage.stats = value.stats; return value; }
  finally {
    Object.assign(stage, { endEpochMs: Date.now(), wallMs: performance.now() - start, cpu: process.cpuUsage(cpu), memoryAfter: process.memoryUsage() });
    result.stages.push(stage);
  }
};
(async () => {
  try {
    // getKernel() deliberately ignores CODEGRAPH_KERNEL=0; kernelSupports()
    // is the actual per-call routing predicate used by extraction.
    result.nativeLoaded = loader.kernelSupports('typescript');
    if (result.nativeLoaded !== (backend === 'native')) throw new Error('Wrong extraction backend');
    cg = CodeGraph.initSync(root);
    result.openMs = performance.now() - begin;
    const start = performance.now(), cpu = process.cpuUsage();
    result.indexStartEpochMs = Date.now();
    result.index = await cg.indexAll();
    result.indexEndEpochMs = Date.now();
    result.indexMs = performance.now() - start;
    result.indexCpu = process.cpuUsage(cpu);
    if (!result.index.success || result.index.filesErrored) throw new Error('Index did not finish cleanly');
    const db = new DatabaseSync(path.join(root, '.codegraph/codegraph.db'), { readOnly: true });
    result.counts = Object.fromEntries(['files','nodes','edges','unresolved_refs'].map(table => [table, db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n]));
    result.languages = db.prepare('SELECT language,count(*) AS n FROM files GROUP BY language').all();
    result.integrity = db.prepare('PRAGMA integrity_check').all();
    result.foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
    result.orphans = db.prepare('SELECT count(*) AS n FROM edges e LEFT JOIN nodes s ON s.id=e.source LEFT JOIN nodes t ON t.id=e.target WHERE s.id IS NULL OR t.id IS NULL').get().n;
    db.close();
  } catch (e) { result.error = e.stack; process.exitCode = 1; }
  finally {
    cg?.close();
    result.totalInsideProcessMs = performance.now() - begin;
    result.maxRSSKiB = process.resourceUsage().maxRSS;
    result.finalMemory = process.memoryUsage();
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ indexMs: result.indexMs, stages: result.stages.map(x => ({ wallMs: x.wallMs, stats: x.stats })), error: result.error }));
  }
})();
