#!/usr/bin/env node
// Claude Code status line: model | context bar % | tokens | cost since /clear / today's total cost
const fs = require('fs');
const os = require('os');
const path = require('path');

const STATE_FILE = path.join(os.homedir(), '.claude', 'statusline-cost.json');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function formatTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function formatCost(c) {
  return '$' + c.toFixed(2);
}

function localDate() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function updateDailyTotal(sessionId, cost) {
  const today = localDate();
  let state = { date: today, sessions: {} };
  try {
    const stored = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (stored && stored.date === today && stored.sessions) state = stored;
  } catch {
    // missing or corrupt state file: start fresh
  }
  if (sessionId) state.sessions[sessionId] = cost;
  try {
    const tmp = STATE_FILE + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, STATE_FILE);
  } catch {
    // never break the status line because of state persistence
  }
  return Object.values(state.sessions).reduce((a, b) => a + (Number(b) || 0), 0);
}

function main() {
  let data;
  try {
    data = JSON.parse(readStdin());
  } catch {
    console.log('Claude');
    return;
  }

  const model = (data.model && data.model.display_name) || 'Claude';
  const cw = data.context_window || {};
  const pct = Math.max(0, Math.min(100, Math.round(Number(cw.used_percentage) || 0)));
  const filled = Math.round(pct / 10);
  const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
  const tokens = (Number(cw.total_input_tokens) || 0) + (Number(cw.total_output_tokens) || 0);
  const cost = Number(data.cost && data.cost.total_cost_usd) || 0;
  const today = updateDailyTotal(data.session_id, cost);

  console.log(
    `${model} | ${bar} ${pct}% | ${formatTokens(tokens)} tok | ${formatCost(cost)} / today ${formatCost(today)}`
  );
}

main();
