// Lõi chiến đấu: trạng thái mọi người đấu, luật vung / đổi đòn / nhử / đỡ / phản đòn / lách / trúng đòn,
// và luồng hiệp. Chạy theo bước cố định, không biết gì về hiển thị: mọi thứ cần vẽ hay phát âm thanh
// được báo ra ngoài bằng sự kiện (sim.events). Client và máy chủ chạy cùng đoạn code này.
import {
  AtkType, Attack, BOT_CFG, COUNTDOWN_S, DEFAULT_TUNING, Diff, DODGE_T, ROUND_END_S, Tuning, TURN_CAP, WEAPONS, Weapon, WINS_TO_WIN,
} from './data.ts';
import { collideArena } from './arena.ts';
import { Brain, makeBrain } from './ai.ts';
import { makeRng, Rng } from './rng.ts';

export type FState = 'idle' | 'windup' | 'release' | 'recovery' | 'parry' | 'recoil' | 'stun' | 'feint' | 'dodge' | 'dead';
export type Phase = 'attract' | 'countdown' | 'fight' | 'roundEnd' | 'matchEnd';
export interface Vec { x: number; y: number; z: number; }
/** Thao tác di chuyển của người chơi thật trong một tick. */
export interface MoveInput { fwd: number; side: number; sprint: boolean; }

export interface Fighter {
  id: number; isBot: boolean; name: string; short: string; tab: number;
  pos: Vec; vel: Vec; yaw: number; radius: number;
  hp: number; st: number; wins: number;
  state: FState; t: number; dur: number;
  weapon: Weapon; atk: Attack | null; atkType: AtkType | null; atkStart: number;
  riposte: boolean; morphed: boolean; hitDone: boolean; hitSet: number[];
  parryStart: number; perfectOK: boolean; lastParryRelease: number; riposteUntil: number;
  lastSpend: number; buffer: { type: AtkType; t: number } | null;
  lastDodge: number; dodgeReady: number; dodgeSide: number;
  windMul: number; flash: number; deadT: number; walk: number; killType: AtkType | null;
  input: MoveInput;
}

/** Sự kiện cho client vẽ / phát âm / thống kê, và sau này cho máy chủ gửi đi. att / def / f là id người đấu. */
export type SimEvent =
  | { k: 'swing'; f: number; type: AtkType }
  | { k: 'morph'; f: number; type: AtkType }
  | { k: 'release'; f: number; heavy: boolean }
  | { k: 'feint'; f: number; baited: boolean }
  | { k: 'dodge'; f: number }
  | { k: 'noStamina'; f: number }
  | { k: 'dodgeNotReady'; f: number }
  | { k: 'dodgeOut'; att: number; def: number; type: AtkType }
  | { k: 'whiff'; att: number; type: AtkType }
  | { k: 'counter'; att: number; def: number; type: AtkType; early: number }
  | { k: 'perfect'; att: number; def: number; type: AtkType; early: number }
  | { k: 'block'; att: number; def: number; type: AtkType; early: number }
  | { k: 'guardBreak'; att: number; def: number; type: AtkType; dmg: number }
  | { k: 'hit'; att: number; def: number; type: AtkType; dmg: number; defState: FState; defAtkType: AtkType | null; early: number; morphBait: boolean }
  | { k: 'interrupt'; att: number; def: number }
  | { k: 'stun'; att: number; def: number }
  | { k: 'kill'; att: number; def: number; type: AtkType }
  | { k: 'roundStart'; round: number }
  | { k: 'countdown'; n: number }
  | { k: 'fight'; round: number }
  | { k: 'roundEnd'; winner: number | null }
  | { k: 'matchEnd'; winner: number | null };

/** Người điều khiển thay cho bộ não bot (ví dụ phòng tập). */
export interface Controller { update(dt: number): { mx: number; mz: number; speed: number }; }

export interface RosterEntry { name: string; short: string; tab: number; weapon: Weapon; }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const angWrap = (d: number) => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export function makeFighter(id: number, isBot: boolean): Fighter {
  return {
    id, isBot, name: isBot ? 'Bot' : 'Bạn', short: isBot ? 'Bot' : 'Bạn', tab: 0x4b5a78,
    pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, radius: .42,
    hp: 100, st: 100, wins: 0, state: 'idle', t: 0, dur: 0,
    weapon: WEAPONS.sword, atk: null, atkType: null, atkStart: 0,
    riposte: false, morphed: false, hitDone: false, hitSet: [],
    parryStart: -9, perfectOK: true, lastParryRelease: -9, riposteUntil: 0,
    lastSpend: -9, buffer: null, lastDodge: -9, dodgeReady: 0, dodgeSide: 0,
    windMul: 1, flash: 0, deadT: 0, walk: 0, killType: null,
    input: { fwd: 0, side: 0, sprint: false },
  };
}

/** Góc (rad, dương = bên phải) và khoảng cách từ hướng nhìn của `from` tới điểm p. */
export function relAngle(from: Fighter, p: Vec) {
  const dx = p.x - from.pos.x, dz = p.z - from.pos.z, s = Math.sin(from.yaw), c = Math.cos(from.yaw);
  const x = dx * c - dz * s, z = -dx * s - dz * c;
  return { ang: Math.atan2(x, z), dist: Math.hypot(dx, dz), z };
}
export const committed = (f: Fighter) => f.state === 'release' || (f.state === 'windup' && f.t > f.dur * .6);
const speedMul = (f: Fighter) => ({ windup: .5, release: .4, parry: .7, stun: .35, recoil: .5, dead: 0 } as Partial<Record<FState, number>>)[f.state] ?? 1;

export class Sim {
  now = 0;
  phase: Phase = 'attract';
  phaseT = 0;
  round = 1;
  diff: Diff = 'med';
  /** Phòng tập: đòn trúng không trừ máu, hiệp không kết thúc. */
  noDamage = false;
  tune: Tuning;
  rng: Rng;
  events: SimEvent[] = [];
  player: Fighter;
  bots: Fighter[];
  fighters: Fighter[];
  brains: Brain[] = [];
  controllers = new Map<Fighter, Controller>();
  private lastCd = -1;

  constructor(tune: Tuning = { ...DEFAULT_TUNING }, seed = 1) {
    this.tune = tune;
    this.rng = makeRng(seed);
    this.player = makeFighter(0, false);
    this.bots = [makeFighter(1, true)];
    this.fighters = [this.player, ...this.bots];
    this.setRoster([{ name: 'Bot', short: 'Bot', tab: 0x4b5a78, weapon: WEAPONS.sword }]);
  }

  emit(e: SimEvent) { this.events.push(e); }
  byId(id: number) { return this.fighters.find(f => f.id === id)!; }
  brainOf(f: Fighter) { return this.brains.find(b => b.f === f) || null; }

  /** Một bot cho tay đôi / phòng tập, nhiều bot cho đánh tự do. bots[0] luôn giữ nguyên đối tượng. */
  setRoster(entries: RosterEntry[]) {
    while (this.bots.length < entries.length) this.bots.push(makeFighter(this.bots.length + 1, true));
    this.bots.length = entries.length;
    this.fighters = [this.player, ...this.bots];
    entries.forEach((e, i) => { const b = this.bots[i]; Object.assign(b, { name: e.name, short: e.short, tab: e.tab, weapon: e.weapon, windMul: 1, wins: 0 }); });
    this.player.wins = 0;
    this.brains = this.bots.map(b => makeBrain(this, b));
    this.controllers.clear();
  }

  // ---------------------------------------------------------------- hiệp và trận
  startMatch() { this.round = 1; for (const f of this.fighters) f.wins = 0; this.startRound(); }
  resetFighter(f: Fighter, x: number, z: number, yaw: number) {
    Object.assign(f, { yaw, hp: 100, st: 100, buffer: null, riposteUntil: 0, lastParryRelease: -9, deadT: 0, flash: 0, killType: null, hitSet: [], dodgeReady: 0, lastDodge: -9 });
    f.pos.x = x; f.pos.z = z; f.vel.x = f.vel.z = 0;
    this.setState(f, 'idle');
  }
  startRound() {
    const fs = this.fighters;
    if (fs.length === 2) { this.resetFighter(this.player, 0, 4.5, 0); this.resetFighter(this.bots[0], 0, -4.5, Math.PI); }
    else fs.forEach((f, i) => { // xếp vòng tròn, cùng nhìn vào giữa
      const a = Math.PI / 2 + i * 2 * Math.PI / fs.length, r = 5;
      this.resetFighter(f, Math.cos(a) * r, Math.sin(a) * r, Math.atan2(Math.cos(a), Math.sin(a)));
    });
    for (const b of this.brains) b.reset();
    this.phase = 'countdown'; this.phaseT = 0; this.lastCd = -1;
    this.emit({ k: 'roundStart', round: this.round });
  }
  private updatePhase(dt: number) {
    this.phaseT += dt;
    if (this.phase === 'countdown') {
      const n = COUNTDOWN_S - Math.floor(this.phaseT);
      if (n > 0) { if (n !== this.lastCd) { this.lastCd = n; this.emit({ k: 'countdown', n }); } }
      else {
        this.phase = 'fight'; this.phaseT = 0;
        for (const b of this.brains) b.nextAttackAt = this.now + this.rng.range(.6, 1.2);
        this.emit({ k: 'fight', round: this.round });
      }
    } else if (this.phase === 'roundEnd' && this.phaseT > ROUND_END_S) {
      const champ = this.fighters.find(f => f.wins >= WINS_TO_WIN);
      if (champ) { this.phase = 'matchEnd'; this.emit({ k: 'matchEnd', winner: champ.id }); }
      else { this.round++; this.startRound(); }
    }
  }

  // ---------------------------------------------------------------- một bước mô phỏng
  step(dt: number) {
    this.now += dt;
    if (this.phase === 'attract' || this.phase === 'matchEnd') { for (const f of this.bots) this.updateFighter(f, dt); return; }
    this.updatePhase(dt);
    // người chơi thật: di chuyển theo input, nhìn theo yaw client gửi lên
    for (const f of this.fighters) {
      if (f.isBot) continue;
      const fz = -Math.sin(f.yaw), fzz = -Math.cos(f.yaw), rx = Math.cos(f.yaw), rz = -Math.sin(f.yaw);
      let { fwd, side } = f.input; if (this.phase === 'countdown') fwd = side = 0;
      let sp = 4.2 * speedMul(f);
      if (f.input.sprint && fwd > 0 && f.st > 1 && f.state === 'idle') { sp = 6.4; this.spend(f, 16 * dt); }
      this.move(f, fz * fwd + rx * side, fzz * fwd + rz * side, sp, dt);
    }
    for (const b of this.bots) {
      const ctl = this.controllers.get(b);
      if (ctl) { const m = ctl.update(dt); this.move(b, m.mx, m.mz, m.speed * speedMul(b), dt); continue; }
      const br = this.brainOf(b); if (!br) continue;
      const m = br.update(dt); this.move(b, m.mx, m.mz, BOT_CFG[this.diff].speed * speedMul(b), dt);
    }
    for (const f of this.fighters) this.updateFighter(f, dt);
    this.separate();
  }

  move(f: Fighter, wx: number, wz: number, speed: number, dt: number) {
    const len = Math.hypot(wx, wz); if (len > 1) { wx /= len; wz /= len; }
    if (f.state === 'dodge') { const d = Math.exp(-3 * dt); f.vel.x *= d; f.vel.z *= d; } // giữ đà lướt, bỏ qua điều khiển
    else { const a = 1 - Math.exp(-12 * dt); f.vel.x = lerp(f.vel.x, wx * speed, a); f.vel.z = lerp(f.vel.z, wz * speed, a); }
    f.pos.x += f.vel.x * dt; f.pos.z += f.vel.z * dt;
    collideArena(f.pos, f.radius);
    f.walk += Math.hypot(f.vel.x, f.vel.z) * dt;
  }
  private separate() {
    const m = .9, fs = this.fighters;
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i], b = fs[j]; if (a.state === 'dead' || b.state === 'dead') continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < m && d > 1e-4) { const p = (m - d) / 2; b.pos.x += dx / d * p; b.pos.z += dz / d * p; a.pos.x -= dx / d * p; a.pos.z -= dz / d * p; }
    }
  }
  /** Bot xoay về phía mục tiêu, bị giới hạn khi đòn đã vào giai đoạn cuối. */
  turnToward(f: Fighter, x: number, z: number, rate: number, dt: number) {
    const want = Math.atan2(-(x - f.pos.x), -(z - f.pos.z));
    const turn = Math.min(rate, committed(f) ? TURN_CAP : 99);
    f.yaw += clamp(angWrap(want - f.yaw), -turn * dt, turn * dt);
  }

  // ---------------------------------------------------------------- thao tác
  setState(f: Fighter, s: FState, dur = 0) { f.state = s; f.t = 0; f.dur = dur; }
  spend(f: Fighter, a: number) { f.st = Math.max(0, f.st - a); f.lastSpend = this.now; }

  startAttack(f: Fighter, type: AtkType): boolean {
    if (this.phase !== 'fight' || f.state === 'dead') return false;
    if (f.state === 'windup') { if (type !== f.atkType && !f.morphed) return this.morph(f, type); return false; }
    if (f.state !== 'idle' && f.state !== 'parry') {
      if (['recovery', 'recoil', 'feint', 'release', 'stun', 'dodge'].includes(f.state)) f.buffer = { type, t: this.now };
      return false;
    }
    const a = f.weapon[type];
    if (f.st < 1) { this.emit({ k: 'noStamina', f: f.id }); return false; }
    if (f.state === 'parry') f.lastParryRelease = this.now;
    const rip = this.now < f.riposteUntil; f.riposteUntil = 0;
    this.spend(f, a.cost);
    Object.assign(f, { atkType: type, atk: a, riposte: rip, hitDone: false, hitSet: [], atkStart: this.now, morphed: false });
    this.setState(f, 'windup', a.wind / this.tune.atkSpeed * (rip ? .7 : 1) * f.windMul);
    this.emit({ k: 'swing', f: f.id, type });
    this.notifyBrains('attack', f, { type, windEnd: this.now + f.dur, rel: a.rel / this.tune.atkSpeed });
    return true;
  }
  /** Đổi đòn giữa chừng: tốn 6 thể lực, chậm thêm ~0,1 giây, mỗi đòn đổi một lần. */
  morph(f: Fighter, type: AtkType): boolean {
    if (f.state !== 'windup' || f.morphed || f.t > f.dur - .06 || f.st < 1) return false;
    const a = f.weapon[type]; this.spend(f, 6);
    const rem = Math.max(.22, a.wind / this.tune.atkSpeed * f.windMul - f.t) + .1;
    Object.assign(f, { atkType: type, atk: a, morphed: true, riposte: false, hitDone: false, hitSet: [], atkStart: this.now });
    this.setState(f, 'windup', rem);
    this.emit({ k: 'morph', f: f.id, type });
    this.notifyBrains('morph', f, { type, windEnd: this.now + rem, rel: a.rel / this.tune.atkSpeed });
    return true;
  }
  feint(f: Fighter): boolean {
    if (f.state !== 'windup' || f.t > f.dur - .06) return false;
    this.spend(f, 8); this.setState(f, 'feint', .15);
    const baited = this.fighters.some(o => o !== f && ((o.state === 'parry' && o.parryStart >= f.atkStart) || (o.state === 'windup' && o.atkStart >= f.atkStart)));
    this.emit({ k: 'feint', f: f.id, baited });
    this.notifyBrains('feint', f);
    return true;
  }
  parryPress(f: Fighter): boolean {
    if (f.state === 'dead' || f.state === 'stun' || f.state === 'release' || f.state === 'dodge' || (f.state === 'recoil' && f.t < .2) || f.state === 'parry') return false;
    if (this.phase !== 'fight' && this.phase !== 'countdown') return false;
    if (f.state === 'windup' && !this.feint(f)) return false;
    f.perfectOK = (this.now - f.lastParryRelease) > .35; // bấm đỡ liên tục thì mất khoảng đỡ chuẩn
    f.buffer = null; this.setState(f, 'parry'); f.parryStart = this.now;
    return true;
  }
  parryRelease(f: Fighter) { if (f.state === 'parry') { this.setState(f, 'idle'); f.lastParryRelease = this.now; } }
  /** Lách sang trái (side<0) hoặc phải (side>0). Không có lách lùi / tiến. Không bất tử: chỉ thoát khi ra khỏi tầm hoặc cung đòn. */
  dodge(f: Fighter, side: number): boolean {
    if (this.phase !== 'fight' || f.state === 'dead') return false;
    const ok = f.state === 'idle' || f.state === 'parry' || f.state === 'feint' || (f.state === 'recovery' && f.t > f.dur * .6);
    if (!ok || Math.abs(side) < .5) return false;
    if (this.now < f.dodgeReady) { this.emit({ k: 'dodgeNotReady', f: f.id }); return false; }
    if (f.st < this.tune.dodgeCost) { this.emit({ k: 'noStamina', f: f.id }); return false; }
    side = Math.sign(side);
    if (f.state === 'parry') this.parryRelease(f);
    this.spend(f, this.tune.dodgeCost); f.buffer = null;
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw), sp = 9.5;
    f.vel.x = c * side * sp; f.vel.z = -s * side * sp;
    f.dodgeSide = side; f.lastDodge = this.now; f.dodgeReady = this.now + this.tune.dodgeCD;
    this.setState(f, 'dodge', DODGE_T);
    this.emit({ k: 'dodge', f: f.id });
    return true;
  }

  // ---------------------------------------------------------------- cập nhật một người đấu
  private updateFighter(f: Fighter, dt: number) {
    f.t += dt; f.flash = Math.max(0, f.flash - dt * 4);
    switch (f.state) {
      case 'windup':
        if (f.t >= f.dur) { this.setState(f, 'release', f.atk!.rel / this.tune.atkSpeed); this.emit({ k: 'release', f: f.id, heavy: f.atkType === 'over' || f.weapon.id === 'axe' }); }
        break;
      case 'release': {
        const p0 = clamp((f.t - dt) / f.dur, 0, 1), p1 = clamp(f.t / f.dur, 0, 1);
        // lưỡi quét qua mọi người trong tầm: chém có thể trúng nhiều người (mỗi người một lần), đâm và đập dừng ở người đầu tiên
        for (const o of this.fighters) {
          if (f.hitDone || f.state !== 'release') break;
          if (o === f || o.state === 'dead' || f.hitSet.includes(o.id)) continue;
          this.hitCheck(f, o, p0, p1);
        }
        if (f.state === 'release' && f.t >= f.dur) {
          if (!f.hitDone && !f.hitSet.length) {
            const o = this.fighters.find(o => o !== f && o.state !== 'dead' && o.lastDodge >= f.atkStart - .05 && Math.hypot(o.pos.x - f.pos.x, o.pos.z - f.pos.z) < f.atk!.range + 2);
            this.emit(o ? { k: 'dodgeOut', att: f.id, def: o.id, type: f.atkType! } : { k: 'whiff', att: f.id, type: f.atkType! });
          }
          this.setState(f, 'recovery', f.atk!.rec / this.tune.atkSpeed);
        }
        break;
      }
      case 'recovery': case 'feint': case 'recoil': case 'stun': case 'dodge':
        if (f.t >= f.dur) this.setState(f, 'idle');
        break;
      case 'parry':
        if (this.now - f.parryStart > this.tune.parryWindow / 1000) f.st = Math.max(0, f.st - 5 * dt);
        break;
      case 'dead': f.deadT += dt; break;
    }
    if (f.state === 'idle' && f.buffer) {
      if (this.now - f.buffer.t < .3) { const b = f.buffer; f.buffer = null; this.startAttack(f, b.type); } else f.buffer = null;
    }
    if (f.state !== 'parry' && f.state !== 'dead' && this.now - f.lastSpend > .8) f.st = Math.min(100, f.st + this.tune.stamRegen * dt);
  }

  private hitCheck(att: Fighter, def: Fighter, p0: number, p1: number) {
    const a = att.atk!, { ang, dist, z } = relAngle(att, def.pos);
    if (dist - def.radius > a.range || z < -.2) return;
    // đâm và đập phải chạm đúng thân người (×0,7 bán kính va chạm), chém tính cả vòng va chạm
    const tol = Math.atan2(def.radius * (att.atkType === 'slash' ? 1 : .7), Math.max(dist, .3)), half = a.arc * Math.PI / 360;
    let hit = false;
    if (att.atkType === 'slash') { const b0 = half - 2 * half * p0, b1 = half - 2 * half * p1; hit = ang <= b0 + tol && ang >= b1 - tol; }
    else if (att.atkType === 'stab') hit = p1 >= .3 && Math.abs(ang) <= half + tol;
    else hit = p1 >= .55 && Math.abs(ang) <= half + tol;
    if (hit) this.resolveHit(att, def);
  }

  private resolveHit(att: Fighter, def: Fighter) {
    att.hitSet.push(def.id); att.hitDone = true;
    const a = att.atk!, type = att.atkType!, now = this.now, T = this.tune;
    const front = Math.abs(relAngle(def, att.pos).ang) < 80 * Math.PI / 180;
    const dmg = a.dmg * T.dmgMul;
    const early = Math.round((now - def.atkStart) * 1000);
    // Phản đòn khớp loại: người bị đánh vừa ra đúng loại đòn đó ngay trước khi chạm → gạt miễn phí, kẻ tấn công bị bật, đòn của mình thành đòn phản nhanh
    if (def.state === 'windup' && def.atkType === type && front && (now - def.atkStart) * 1000 <= T.counterWindow) {
      this.setState(att, 'recoil', .45); att.buffer = null;
      def.st = Math.min(100, def.st + def.atk!.cost); def.riposte = true; def.hitDone = false; def.hitSet = [];
      this.setState(def, 'windup', def.atk!.wind / T.atkSpeed * .45);
      this.emit({ k: 'counter', att: att.id, def: def.id, type, early });
      return;
    }
    if (def.state === 'parry' && front) {
      const pEarly = Math.round((now - def.parryStart) * 1000);
      if (def.perfectOK && pEarly <= T.parryWindow) { // đỡ chuẩn: không tốn thể lực, không có phản đòn nhanh
        this.setState(att, 'recovery', a.rec / T.atkSpeed); att.buffer = null;
        this.emit({ k: 'perfect', att: att.id, def: def.id, type, early: pEarly });
        this.brainOf(def)?.onPerfectParry();
        return;
      }
      const cost = dmg * .55 * (type === 'over' ? 1.6 : 1) * def.weapon.blockCost * att.weapon.drainMul;
      if (def.st >= cost) {
        this.spend(def, cost); this.setState(att, 'recovery', a.rec / T.atkSpeed * .8);
        const d = this.dirFrom(att, def); def.vel.x += d.x * 2; def.vel.z += d.z * 2;
        this.emit({ k: 'block', att: att.id, def: def.id, type, early: pEarly });
        return;
      }
      def.st = 0; this.setState(def, 'stun', .8);
      this.emit({ k: 'guardBreak', att: att.id, def: def.id, type, dmg: dmg * .5 });
      this.damage(def, dmg * .5, att);
      return;
    }
    const defState = def.state, defAtkType = def.atkType;
    const morphBait = att.morphed && def.state === 'windup' && def.atkType !== type;
    if (type === 'slash') att.hitDone = false; // một nhát chém gọn tiếp tục quét qua người khác
    this.emit({ k: 'hit', att: att.id, def: def.id, type, dmg, defState, defAtkType, early, morphBait });
    this.damage(def, dmg, att);
    if (def.state === 'dead') return;
    if (def.state === 'windup') { this.setState(def, 'stun', .25); this.emit({ k: 'interrupt', att: att.id, def: def.id }); }
    else if (type === 'over' && def.state !== 'stun') { this.setState(def, 'stun', a.stun!); this.emit({ k: 'stun', att: att.id, def: def.id }); }
  }
  private dirFrom(a: Fighter, b: Fighter) { const x = b.pos.x - a.pos.x, z = b.pos.z - a.pos.z, l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; }
  private damage(def: Fighter, dmg: number, att: Fighter) {
    def.flash = 1;
    const br = this.brainOf(def); if (br) { br.aggro = att; br.aggroT = this.now; }
    if (this.noDamage) return;
    def.hp = Math.max(0, def.hp - dmg);
    const d = this.dirFrom(att, def); def.vel.x += d.x * 3; def.vel.z += d.z * 3;
    if (def.hp <= 0) { def.killType = att.atkType; this.kill(def, att); }
  }
  /** Hiệp kết thúc khi còn tối đa một người đứng; người đó thắng hiệp. */
  private kill(f: Fighter, att: Fighter) {
    this.setState(f, 'dead'); f.deadT = 0;
    this.emit({ k: 'kill', att: att.id, def: f.id, type: att.atkType! });
    const alive = this.fighters.filter(o => o.state !== 'dead');
    if (alive.length <= 1) {
      const w = alive[0] || null; if (w) w.wins++;
      this.phase = 'roundEnd'; this.phaseT = 0;
      this.emit({ k: 'roundEnd', winner: w ? w.id : null });
    }
  }

  /** Báo cho các bot có khả năng là mục tiêu (trong tầm, trước mặt kẻ tấn công) rằng có đòn sắp tới. */
  private notifyBrains(kind: 'attack' | 'morph' | 'feint', att: Fighter, info?: { type: AtkType; windEnd: number; rel: number }) {
    for (const b of this.brains) {
      const me = b.f; if (me === att || me.state === 'dead') continue;
      if (kind === 'feint') { b.onEnemyFeint(att); continue; }
      const { ang, dist } = relAngle(att, me.pos);
      if (dist > att.weapon.slash.range + 1 || Math.abs(ang) > Math.PI / 3.2) continue;
      if (kind === 'attack') b.onEnemyAttack({ att, ...info! }); else b.onEnemyMorph({ att, ...info! });
    }
  }

  /** Lấy và xoá các sự kiện từ lần gọi trước. */
  drain(): SimEvent[] { const e = this.events; this.events = []; return e; }
}
