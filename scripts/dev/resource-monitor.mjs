#!/usr/bin/env node
// Lightweight resource monitor for OmniRoute node processes.
// Prints + logs aggregate CPU% and RAM (MB) of all `node` processes every INTERVAL ms.
// Safe: read-only, no side effects on the app. Cross-platform (Windows PowerShell / ps).

import { spawnSync } from "node:child_process";
import fs from "node:fs";

const LOG = process.env.OMNIROUTE_RESOURCE_LOG || "omniroute-resource-log.txt";
const INTERVAL = Number(process.env.OMNIROUTE_RESOURCE_INTERVAL || 2000);
const isWin = process.platform === "win32";

function snapshot() {
  if (isWin) {
    const out = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Get-Process node -ErrorAction SilentlyContinue | Select-Object Id,CPU,WorkingSet,CommandLine | ConvertTo-Json -Compress",
      ],
      { encoding: "utf8", windowsHide: true }
    ).stdout;
    if (!out || !out.trim()) return [];
    let arr;
    try {
      arr = JSON.parse(out);
    } catch {
      return [];
    }
    if (!Array.isArray(arr)) arr = [arr];
    return arr.map((p) => ({
      pid: p.Id,
      cpu: Number(p.CPU) || 0, // total CPU seconds
      rss: Number(p.WorkingSet) || 0, // bytes
      cmd: String(p.CommandLine || ""),
    }));
  }
  const out = spawnSync("ps", ["-eo", "pid,pcpu,rss,command"], { encoding: "utf8" }).stdout;
  const res = [];
  for (const line of (out || "").split("\n").slice(1)) {
    const m = line.match(/^\s*(\d+)\s+([\d.]+)\s+(\d+)\s+(.*)$/);
    if (!m) continue;
    if (!/node/i.test(m[4])) continue;
    res.push({ pid: +m[1], cpu: +m[2], rss: +m[3] * 1024, cmd: m[4] });
  }
  return res;
}

const prevCpu = new Map();

function tick() {
  const procs = snapshot();
  let totalRss = 0;
  let cpuPct = 0;
  const top = [];
  for (const p of procs) {
    totalRss += p.rss;
    if (isWin) {
      const before = prevCpu.get(p.pid);
      if (before !== undefined) cpuPct += Math.max(0, p.cpu - before);
      prevCpu.set(p.pid, p.cpu);
    } else {
      cpuPct += p.cpu; // already a %
    }
    top.push({ pid: p.pid, rssMb: p.rss / 1048576, cmd: p.cmd });
  }
  if (isWin) cpuPct = (cpuPct * 100) / (INTERVAL / 1000);
  top.sort((a, b) => b.rssMb - a.rssMb);
  const rssMb = (totalRss / 1048576).toFixed(0);
  const ts = new Date().toISOString();
  const topStr = top
    .slice(0, 3)
    .map((t) => `#${t.pid}=${t.rssMb.toFixed(0)}MB`)
    .join(" ");
  const line = `[MONITOR ${ts}] node: ${procs.length} | CPU: ${cpuPct.toFixed(1)}% | RAM: ${rssMb} MB | top: ${topStr}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG, line + "\n");
  } catch {
    /* ignore log write errors */
  }
}

console.log(`[MONITOR] logging to ${LOG} every ${INTERVAL}ms — Ctrl+C to stop`);
tick();
setInterval(tick, INTERVAL);
