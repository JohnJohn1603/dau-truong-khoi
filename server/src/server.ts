// Máy chủ phòng: tạo / vào phòng bằng mã 4 ký tự, sảnh chờ, chủ phòng bấm bắt đầu, bot lấp đủ 3 chỗ.
// Mỗi phòng chạy một Sim (lõi chiến đấu dùng chung) 60 lần/giây và gửi ảnh chụp trạng thái 20 lần/giây.
// Máy chủ quyết định mọi thứ; người chơi chỉ gửi thao tác. Thao tác phòng thủ được lùi thời điểm theo độ trễ (tối đa 150 ms),
// và đòn trúng người chơi thật được xét muộn đúng chừng ấy để những thao tác đó kịp tính.
import { WebSocketServer, WebSocket } from 'ws';
import { Sim, WEAPONS, DEFAULT_TUNING, TICK, type Diff, type Fighter, type WeaponId } from '@dtk/shared';
import { FIELDS, type ClientMsg, type ServerMsg, type RosterWire } from './protocol.ts';

const PORT = Number(process.env.PORT || 8787);
const ROOM_SIZE = 3;
const SNAP_EVERY = 3;          // 60 Hz / 3 = 20 ảnh chụp mỗi giây
const INTERP = .1;             // client hiển thị người khác chậm 100 ms để mượt
const MAX_COMP = .15;          // bù độ trễ tối đa
const FFA_BOTS = [{ name: 'Hiệp Sĩ Xám', short: 'Xám', tab: 0x4b5a78 }, { name: 'Kiếm Sư Đỏ', short: 'Đỏ', tab: 0x8e2222 }, { name: 'Lính Gác Rơm', short: 'Rơm', tab: 0x8a7a4a }];
const HUMAN_TABS = [0x3d6b4a, 0x6a4b8a, 0x8a6a2a];

interface Client { ws: WebSocket; pid: number; name: string; weapon: WeaponId; room: Room | null; rtt: number; fid: number | null; ack: number; }
interface Room { code: string; clients: Client[]; host: Client; diff: Diff; sim: Sim | null; loop: NodeJS.Timeout | null; tick: number; }

const rooms = new Map<string, Room>();
let nextPid = 1;
const send = (c: Client, m: ServerMsg) => { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(m)); };
const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s; do { s = Array.from({ length: 4 }, () => A[Math.random() * A.length | 0]).join(''); } while (rooms.has(s)); return s; };
const cleanName = (n: unknown) => String(n ?? '').trim().slice(0, 20) || 'Người chơi';
const comp = (c: Client) => Math.min(c.rtt + INTERP, MAX_COMP);

function lobby(r: Room) {
  const players = r.clients.map(c => ({ pid: c.pid, name: c.name, host: c === r.host }));
  for (const c of r.clients) send(c, { t: 'lobby', code: r.code, you: c.pid, players, diff: r.diff });
}

function startRoom(r: Room) {
  if (r.sim) return;
  const pickW = (): WeaponId => Math.random() < .5 ? 'sword' : 'axe';
  const entries = r.clients.map((c, i) => ({ name: c.name, short: c.name.slice(0, 6), tab: HUMAN_TABS[i % 3], weapon: WEAPONS[c.weapon], human: true }));
  for (let i = 0; entries.length < ROOM_SIZE; i++) entries.push({ ...FFA_BOTS[i], weapon: WEAPONS[pickW()], human: false });
  const sim = new Sim({ ...DEFAULT_TUNING }, (Math.random() * 2 ** 31) | 0);
  sim.diff = r.diff;
  sim.setupRoom(entries);
  r.clients.forEach((c, i) => { c.fid = i; c.ack = 0; });
  sim.graceFor = (f: Fighter) => { const c = r.clients.find(c => c.fid === f.id); return c ? comp(c) : 0; };
  sim.startMatch();
  r.sim = sim; r.tick = 0;
  const roster: RosterWire[] = sim.fighters.map(f => ({ id: f.id, name: f.name, short: f.short, tab: f.tab, weapon: f.weapon.id, human: !f.isBot }));
  for (const c of r.clients) send(c, { t: 'start', roster, you: c.fid!, tune: sim.tune });
  r.loop = setInterval(() => stepRoom(r), TICK * 1000);
}

function stepRoom(r: Room) {
  const sim = r.sim!; sim.step(TICK); r.tick++;
  if (r.tick % SNAP_EVERY !== 0 && sim.phase !== 'matchEnd') return;
  const ev = sim.drain();
  const f = sim.fighters.map(x => FIELDS.map(k => k === 'x' ? round3(x.pos.x) : k === 'z' ? round3(x.pos.z) : k === 'vx' ? round3(x.vel.x) : k === 'vz' ? round3(x.vel.z)
    : typeof (x as any)[k] === 'number' ? round3((x as any)[k]) : (x as any)[k] ?? null));
  for (const c of r.clients) send(c, { t: 'snap', now: round3(sim.now), phase: sim.phase, phaseT: round3(sim.phaseT), round: sim.round, f, ev, ack: c.ack });
  if (sim.phase === 'matchEnd') endRoom(r);
}
const round3 = (v: number) => Math.round(v * 1000) / 1000;

function endRoom(r: Room) {
  if (r.loop) clearInterval(r.loop);
  r.loop = null; r.sim = null;
  for (const c of r.clients) { c.fid = null; send(c, { t: 'ended' }); }
  lobby(r);
}

function leave(c: Client) {
  const r = c.room; if (!r) return;
  r.clients = r.clients.filter(x => x !== c); c.room = null;
  if (r.sim && c.fid !== null) r.sim.toBot(r.sim.byId(c.fid)); // rời giữa trận: bot điều khiển thay
  c.fid = null;
  if (!r.clients.length) { if (r.loop) clearInterval(r.loop); rooms.delete(r.code); console.log(`phòng ${r.code} đóng`); return; }
  if (r.host === c) r.host = r.clients[0];
  if (!r.sim) lobby(r);
}

function onMsg(c: Client, m: ClientMsg) {
  const r = c.room;
  switch (m.t) {
    case 'ping': send(c, { t: 'pong', ct: m.ct }); break;
    case 'create': {
      leave(c); c.name = cleanName(m.name); c.weapon = m.weapon === 'axe' ? 'axe' : 'sword';
      const room: Room = { code: newCode(), clients: [c], host: c, diff: 'med', sim: null, loop: null, tick: 0 };
      rooms.set(room.code, room); c.room = room; lobby(room); console.log(`phòng ${room.code} mở bởi ${c.name}`); break;
    }
    case 'join': {
      const room = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!room) { send(c, { t: 'error', msg: 'Không có phòng nào với mã này.' }); break; }
      if (room.sim) { send(c, { t: 'error', msg: 'Phòng đang trong trận, chờ trận xong rồi vào lại.' }); break; }
      if (room.clients.length >= ROOM_SIZE) { send(c, { t: 'error', msg: 'Phòng đã đủ 3 người.' }); break; }
      leave(c); c.name = cleanName(m.name); c.weapon = m.weapon === 'axe' ? 'axe' : 'sword'; room.clients.push(c); c.room = room; lobby(room); break;
    }
    case 'start':
      if (r && r.host === c && !r.sim) { if (['easy', 'med', 'hard'].includes(m.diff)) r.diff = m.diff; startRoom(r); }
      break;
    case 'leave': leave(c); break;
    case 'in': {
      if (typeof m.rtt === 'number' && m.rtt >= 0 && m.rtt < 2) c.rtt = c.rtt * .8 + m.rtt * .2;
      const f = r?.sim && c.fid !== null ? r.sim.byId(c.fid) : null; if (!f || f.isBot) break;
      const cl = (v: unknown) => Math.max(-1, Math.min(1, Number(v) || 0));
      f.input = { fwd: cl(m.fwd), side: cl(m.side), sprint: !!m.sprint };
      if (f.state !== 'dead' && Number.isFinite(m.yaw)) f.yaw = turnLimited(f, Number(m.yaw));
      break;
    }
    case 'act': {
      const sim = r?.sim; const f = sim && c.fid !== null ? sim.byId(c.fid) : null; if (!sim || !f || f.isBot) break;
      c.ack = Math.max(c.ack, Number(m.seq) || 0);
      const back = comp(c);
      if (m.a === 'attack' && (m.type === 'slash' || m.type === 'stab' || m.type === 'over')) sim.startAttack(f, m.type, back);
      else if (m.a === 'parry') sim.parryPress(f, back);
      else if (m.a === 'parryUp') sim.parryRelease(f);
      else if (m.a === 'feint') sim.feint(f);
      else if (m.a === 'dodge') sim.dodge(f, Math.sign(Number(m.side) || 0), back);
      break;
    }
  }
}
// chống xoay nhanh bất thường khi đòn đã vào giai đoạn cuối (luật giới hạn xoay áp cho cả người chơi thật)
function turnLimited(f: Fighter, yaw: number) {
  const committed = f.state === 'release' || (f.state === 'windup' && f.t > f.dur * .6);
  if (!committed) return yaw;
  let d = yaw - f.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const cap = 1.2 * (1 / 30) * 1.5; // ~ một gói input, có dư cho dao động mạng
  return f.yaw + Math.max(-cap, Math.min(cap, d));
}

const wss = new WebSocketServer({ port: PORT });
wss.on('connection', ws => {
  const c: Client = { ws, pid: nextPid++, name: 'Người chơi', weapon: 'sword', room: null, rtt: .08, fid: null, ack: 0 };
  ws.on('message', data => { let m: ClientMsg; try { m = JSON.parse(String(data)); } catch { return; } if (m && typeof m === 'object') onMsg(c, m); });
  ws.on('close', () => leave(c));
});
console.log(`Máy chủ Đấu Trường Khối chạy ở ws://localhost:${PORT}`);
