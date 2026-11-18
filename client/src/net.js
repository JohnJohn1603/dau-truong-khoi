// Chơi qua mạng: kết nối máy chủ phòng, sảnh chờ, gửi thao tác, nhận ảnh chụp trạng thái.
// Máy chủ quyết định mọi thứ. Trên máy này: bản thân được dự đoán ngay (đi, vung, đỡ hiện tức thì rồi khớp lại theo máy chủ),
// người khác được hiển thị chậm 100 ms, nội suy giữa hai ảnh chụp cho mượt.
import { $, CFG, save } from './config.js';
import { sim, player, bots, syncCore, setPhase, hooks } from './core.js';
import { G } from './state.js';
import { handleEvents, popup, initAudio } from './effects.js';
import { setupKnight, setupViewmodel } from './models.js';
import { resetStats, toMenu } from './match.js';
import { requestLock, readMove } from './input.js';
import { canvas } from './world.js';
import { testerName } from './results.js';
import { WEAPONS, BOT_CFG } from '@dtk/shared';

export const INTERP = .1;
const FIELDS = ['id', 'x', 'z', 'vx', 'vz', 'yaw', 'hp', 'st', 'state', 't', 'dur', 'atkType', 'riposte', 'morphed', 'flash', 'deadT', 'killType', 'wins', 'dodgeSide', 'walk'];
// own-fighter events the client already produced when it predicted the action locally
const OWN_PREDICTED = new Set(['swing', 'morph', 'dodge', 'feint', 'noStamina', 'dodgeNotReady']);

export const net = { ws: null, code: null, you: null, pid: null, host: false, rtt: .08, seq: 0, ack: 0, lastSnap: null, srvNow: 0, recvAt: 0, inTick: 0, pingT: null, diff: 'med', players: [] };

// local dev → the server on this machine; the published page → the address baked in at build time (VITE_SERVER_URL)
const defaultUrl = () => CFG.netUrl || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? `ws://${location.hostname}:8787` : (import.meta.env.VITE_SERVER_URL || ''));
const status = (msg, kind = '') => { const el = $('netStatus'); el.textContent = msg; el.className = 'savest' + (kind ? ' ' + kind : ''); };
function sendMsg(m) { if (net.ws && net.ws.readyState === 1) net.ws.send(JSON.stringify(m)); }

/* ---------------- connection and lobby ---------------- */
function connect(then) {
  const url = $('netUrl').value.trim();
  if (!url) { status('Nhập địa chỉ máy chủ (ví dụ ws://localhost:8787).', 'warn'); return; }
  CFG.netUrl = url; save();
  if (net.ws && net.ws.readyState === 1) { then(); return; }
  status('Đang kết nối…');
  let ws;
  try { ws = new WebSocket(url); } catch (e) { status('Địa chỉ máy chủ không hợp lệ.', 'warn'); return; }
  net.ws = ws;
  ws.onopen = () => { status('Đã kết nối.', 'ok'); then(); clearInterval(net.pingT); net.pingT = setInterval(() => sendMsg({ t: 'ping', ct: performance.now() }), 1000); };
  ws.onerror = () => status('Không kết nối được tới máy chủ. Kiểm tra địa chỉ, và máy chủ đã chạy chưa (npm run server).', 'warn');
  ws.onclose = () => { clearInterval(net.pingT); net.ws = null;
    if (G.mode === 'net') { popup('Mất kết nối máy chủ', 'bad'); G.mode = 'match'; toMenu(); }
    showLobby(false); };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; } onMsg(m); };
}
function onMsg(m) {
  switch (m.t) {
    case 'error': status(m.msg, 'warn'); break;
    case 'pong': net.rtt = net.rtt * .7 + ((performance.now() - m.ct) / 1000) * .3; $('netPing').textContent = Math.round(net.rtt * 1000) + ' ms'; break;
    case 'lobby': net.code = m.code; net.pid = m.you; net.players = m.players; net.diff = m.diff; net.host = m.players.some(p => p.pid === m.you && p.host); renderLobby(); break;
    case 'start': onStart(m); break;
    case 'snap': applySnap(m); break;
    case 'ended': break; // the end screen comes from the matchEnd event; the lobby follows
  }
}
function renderLobby() {
  showLobby(true);
  $('netRoomCode').textContent = net.code;
  $('netPlayers').innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const p = net.players[i], li = document.createElement('li');
    li.textContent = p ? p.name + (p.host ? ' · chủ phòng' : '') + (p.pid === net.pid ? ' (bạn)' : '') : 'Chỗ trống · bot sẽ vào thay';
    if (!p) li.className = 'empty';
    $('netPlayers').appendChild(li);
  }
  $('netStart').hidden = !net.host; $('netDiffRow').hidden = !net.host;
  $('netWait').hidden = net.host;
  document.querySelectorAll('#netDiff button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === net.diff)));
}
function showLobby(on) { $('netJoinBox').hidden = on; $('netLobby').hidden = !on; }
export function openNet() {
  $('menu').hidden = true; $('endScr').hidden = true; $('netScr').hidden = false;
  if (!$('netUrl').value) $('netUrl').value = defaultUrl();
  showLobby(!!(net.ws && net.code));
  if (net.code) renderLobby();
}
$('netBtn').onclick = openNet;
$('netBack').onclick = () => { $('netScr').hidden = true; $('menu').hidden = false; };
$('netCreate').onclick = () => connect(() => sendMsg({ t: 'create', name: testerName(), weapon: CFG.pw }));
$('netJoin').onclick = () => { const code = $('netCode').value.trim().toUpperCase(); if (code.length !== 4) { status('Mã phòng gồm 4 ký tự.', 'warn'); return; } connect(() => sendMsg({ t: 'join', code, name: testerName(), weapon: CFG.pw })); };
$('netLeave').onclick = () => { sendMsg({ t: 'leave' }); net.code = null; showLobby(false); status('Đã rời phòng.'); };
$('netStart').onclick = () => sendMsg({ t: 'start', diff: net.diff });
document.querySelectorAll('#netDiff button').forEach(b => b.onclick = () => { net.diff = b.dataset.v; renderLobby(); });
$('netCopy').onclick = () => { try { navigator.clipboard.writeText(net.code).then(() => status('Đã sao chép mã phòng.', 'ok'), () => {}); } catch (e) { } };

/* ---------------- match ---------------- */
function onStart(m) {
  initAudio(); resetStats(); G.score = { p: 0, b: 0 }; G.mode = 'net';
  net.you = m.you; net.seq = 0; net.ack = 0; net.lastSnap = null; net.inTick = 0;
  sim.diff = net.diff; sim.noDamage = false;
  sim.setupView(m.roster.map(r => ({ id: r.id, name: r.name, short: r.short, tab: r.tab, weapon: WEAPONS[r.weapon] })), m.you);
  syncCore();
  for (const b of bots) { b.hist = []; b.ghost = null; b.pose = null; }
  player.pose = null; player.name = 'Bạn'; player.short = 'Bạn';
  setupKnight(); setupViewmodel();
  $('botName').textContent = 'Phòng ' + net.code + ' · 3 người'; $('botDiff').textContent = 'bot ' + BOT_CFG[net.diff].name; $('wpnName').textContent = player.weapon.name;
  $('trainHud').hidden = true; $('bBars').hidden = false; $('quitBtn').textContent = 'Rời trận';
  $('netScr').hidden = true; $('menu').hidden = true; $('endScr').hidden = true; $('pause').hidden = true; $('hud').hidden = false; G.paused = false;
  G.matchStart = sim.now; G.fpsFrames = 0; G.fpsTime = 0;
  setPhase('countdown');
  requestLock(); canvas.focus();
}
const unpack = row => { const o = {}; FIELDS.forEach((k, i) => o[k] = row[i]); return o; };
function applySnap(m) {
  if (G.mode !== 'net') return;
  net.srvNow = m.now; net.recvAt = performance.now(); net.ack = m.ack;
  const restart = m.ev.some(e => e.k === 'roundStart');
  for (const row of m.f) {
    const s = unpack(row); const f = sim.byId(s.id); if (!f) continue;
    f.hp = s.hp; f.st = s.st; f.wins = s.wins; f.flash = Math.max(f.flash, s.flash);
    if (f === player) reconcile(f, s, restart);
    else { const h = f.hist || (f.hist = []); h.push({ at: m.now, ...s }); if (h.length > 40) h.shift(); Object.assign(f, { state: s.state, t: s.t, dur: s.dur, atkType: s.atkType, deadT: s.deadT, killType: s.killType }); f.pos.x = s.x; f.pos.z = s.z; f.yaw = s.yaw; }
  }
  sim.phase = m.phase; sim.phaseT = m.phaseT; sim.round = m.round; syncCore();
  handleEvents(m.ev.filter(e => !(OWN_PREDICTED.has(e.k) && e.f === net.you)));
}
// own fighter: trust the server for health, stamina and anything once all our actions are acknowledged; position is blended
function reconcile(f, s, force) {
  const settled = net.ack >= net.seq;
  if (force || settled && (f.state !== s.state || f.atkType !== s.atkType)) Object.assign(f, { state: s.state, t: s.t, dur: s.dur, atkType: s.atkType, riposte: s.riposte, morphed: s.morphed });
  if (s.state === 'dead' || s.state === 'stun' || s.state === 'recoil') Object.assign(f, { state: s.state, t: s.t, dur: s.dur, deadT: s.deadT, killType: s.killType });
  if (f.atkType && f.weapon[f.atkType]) f.atk = f.weapon[f.atkType];
  // the server's position is half a round-trip old; push it forward by its velocity before comparing
  const px = s.x + s.vx * net.rtt / 2, pz = s.z + s.vz * net.rtt / 2, err = Math.hypot(px - f.pos.x, pz - f.pos.z);
  if (force || err > 1.2) { f.pos.x = s.x; f.pos.z = s.z; f.vel.x = s.vx; f.vel.z = s.vz; if (force) { f.yaw = s.yaw; G.camYaw = s.yaw; } }
  else { f.pos.x += (px - f.pos.x) * .15; f.pos.z += (pz - f.pos.z) * .15; }
}
/** Server time as of now on this machine (last snapshot time + time since it arrived). */
export const netNow = () => net.srvNow + (performance.now() - net.recvAt) / 1000;
/** One fixed client tick while playing online: predict our own fighter, send input ~30 times a second. */
export function netTick(dt) {
  if (player.state !== 'dead') player.yaw = G.camYaw;
  player.input = G.paused ? { fwd: 0, side: 0, sprint: false } : readMove();
  sim.moveHuman(player, dt); sim.predict(player, dt); sim.now += dt;
  syncCore(); handleEvents(sim.drain());
  if (++net.inTick % 2 === 0) sendMsg({ t: 'in', fwd: player.input.fwd, side: player.input.side, sprint: player.input.sprint, yaw: player.yaw, rtt: net.rtt });
}
/** An action from this player: sent to the server (which decides) and shown locally right away. */
export function netAct(a, extra) { net.seq++; sendMsg({ t: 'act', seq: net.seq, a, ...extra }); }
hooks.netAct = netAct;
export function netLeaveMatch() { sendMsg({ t: 'leave' }); net.code = null; G.mode = 'match'; }
