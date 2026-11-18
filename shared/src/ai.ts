// Bot đấu 3 mức: đỡ, phản đòn, nhử, đổi đòn, lách, di chuyển. Mỗi bot có một bộ não riêng và tự chọn mục tiêu,
// nên dùng được cho cả tay đôi lẫn đánh tự do nhiều người. Mọi số ngẫu nhiên lấy từ sim.rng để chạy giống nhau ở mọi máy.
import { AtkType, ATK_TYPES, BOT_CFG, IMPACT_P } from './data.ts';
import type { Fighter, Sim } from './sim.ts';

interface Threat { att: Fighter; perceiveAt: number; impact: number; type: AtkType; decided: boolean; }
export interface EnemyInfo { att: Fighter; type: AtkType; windEnd: number; rel: number; }

export class Brain {
  tg: Fighter | null = null;
  aggro: Fighter | null = null;
  aggroT = -9;
  nextAttackAt = 0;
  private threat: Threat | null = null;
  private parryAt: number | null = null;
  private counterAt: number | null = null;
  private counterType: AtkType = 'slash';
  private releaseAt: number | null = null;
  private feintAt: number | null = null;
  private ripAt: number | null = null;
  private dodgeAt: number | null = null;
  private dodgeSide = 1;
  private strafe = 1;
  private strafeT = 0;
  private forceType: AtkType | null = null;
  private morphTo: { type: AtkType; at: number } | null = null;
  private countering = false;
  private morphSeen: number | null = null;

  constructor(private sim: Sim, public f: Fighter) { this.reset(); }
  private get c() { return BOT_CFG[this.sim.diff]; }
  private get now() { return this.sim.now; }
  private react() { return this.sim.rng.pair(this.c.react) * this.sim.tune.botReact; }
  private other(t: AtkType): AtkType { const o = ATK_TYPES.filter(x => x !== t); return o[this.sim.rng.next() * 2 | 0]; }

  reset() {
    const r = this.sim.rng;
    Object.assign(this, {
      nextAttackAt: this.now + r.range(.8, 1.4), threat: null, parryAt: null, counterAt: null, releaseAt: null, feintAt: null, ripAt: null,
      strafe: r.chance(.5) ? 1 : -1, strafeT: this.now + r.range(.8, 2), forceType: null, morphTo: null, countering: false, morphSeen: null,
      dodgeAt: null, tg: null, aggro: null, aggroT: -9,
    });
  }
  /** Có người đang vung đòn vào mình. */
  onEnemyAttack(i: EnemyInfo) {
    if (this.c.parryP <= 0 || this.f.state === 'dead') return;
    this.aggro = i.att; this.aggroT = this.now;
    this.threat = { att: i.att, perceiveAt: this.now + this.react(), impact: i.windEnd + i.rel * IMPACT_P[i.type], type: i.type, decided: false };
  }
  onEnemyMorph(i: EnemyInfo) {
    const c = this.c, me = this.f, r = this.sim.rng;
    if (c.parryP <= 0 || me.state === 'dead') return;
    if (this.threat && this.threat.att !== i.att) return;
    this.parryAt = this.counterAt = this.dodgeAt = null;
    const impact = i.windEnd + i.rel * IMPACT_P[i.type];
    if (me.state === 'parry') { this.releaseAt = impact + .25; this.threat = null; return; }
    if (me.state === 'windup' && this.countering && me.atkType !== i.type) {
      this.threat = null; if (r.chance(c.morphCounter)) this.morphTo = { type: i.type, at: this.now + this.react() }; return;
    }
    this.threat = { att: i.att, perceiveAt: this.now + this.react(), impact, type: i.type, decided: false };
  }
  onEnemyFeint(att: Fighter) {
    const c = this.c, r = this.sim.rng;
    if (!this.threat || this.threat.att !== att) return;
    if (this.counterAt !== null && r.chance(c.readFeint)) this.counterAt = null;
    if (this.dodgeAt !== null && r.chance(c.readFeint)) this.dodgeAt = null;
    if (this.f.state !== 'parry') { if (r.chance(c.readFeint)) this.parryAt = null; }
    else if (r.chance(c.readFeint)) this.releaseAt = this.now + .12;
    this.threat = null;
  }
  /** Đỡ chuẩn không cho phản đòn nhanh: bot chỉ đánh ngay từ thế đỡ. */
  onPerfectParry() { if (this.sim.rng.chance(this.c.ripP)) this.ripAt = this.now + (this.sim.diff === 'hard' ? .02 : .12); }

  /** Đối thủ gần nhất còn sống; giữ mục tiêu hiện tại trừ khi người khác gần hơn hẳn hoặc vừa đánh mình. */
  private pickTarget(): Fighter | null {
    const me = this.f; let best: Fighter | null = null, bd = 1e9;
    for (const o of this.sim.fighters) { if (o === me || o.state === 'dead') continue; const d = Math.hypot(o.pos.x - me.pos.x, o.pos.z - me.pos.z); if (d < bd) { bd = d; best = o; } }
    if (this.aggro && this.aggro.state !== 'dead' && this.now - this.aggroT < 1.5) return this.tg = this.aggro;
    const cur = this.tg;
    if (cur && cur.state !== 'dead' && best) { const dc = Math.hypot(cur.pos.x - me.pos.x, cur.pos.z - me.pos.z); if (dc < bd * 1.5) return cur; }
    return this.tg = best;
  }

  update(dt: number): { mx: number; mz: number } {
    const c = this.c, f = this.f, sim = this.sim, r = sim.rng, now = this.now;
    if (f.state === 'dead') return { mx: 0, mz: 0 };
    const pl = this.pickTarget(); if (!pl) return { mx: 0, mz: 0 };
    const dx = pl.pos.x - f.pos.x, dz = pl.pos.z - f.pos.z, dist = Math.hypot(dx, dz);
    sim.turnToward(f, pl.pos.x, pl.pos.z, c.turn * (({ windup: .6, release: .35, stun: .3 } as Record<string, number>)[f.state] ?? 1), dt);
    if (sim.phase !== 'fight') return { mx: 0, mz: 0 };
    // phòng thủ
    const th = this.threat;
    if (th && !th.decided && now >= th.perceiveAt) {
      th.decided = true; const ta = th.att;
      if (ta.state === 'windup' || ta.state === 'release') {
        // lách ngang trước đòn đâm / đập hẹp (chém ngang quá rộng để lách); hay lách hơn khi thể lực thấp
        const p = (f.st < 35 ? c.dodgeP * 2 : c.dodgeP) * 1.5;
        if (c.dodgeP > 0 && th.type !== 'slash' && f.state !== 'windup' && f.st >= sim.tune.dodgeCost && r.chance(p)) {
          this.dodgeAt = Math.max(now, th.impact - r.range(.18, .26)); this.dodgeSide = r.chance(.5) ? -1 : 1;
        } else if (r.chance(c.parryP)) {
          let ok = true;
          if (f.state === 'windup') { const myImpact = now + (f.dur - f.t) + f.atk!.rel / sim.tune.atkSpeed * IMPACT_P[f.atkType!]; ok = myImpact > th.impact - .05 && r.chance(c.cancelP); }
          if (ok && f.state !== 'windup' && r.chance(c.counterP)) { this.counterAt = Math.max(now, th.impact - r.pair(c.cOffset) * sim.tune.counterWindow / 250); this.counterType = th.type; }
          else if (ok) { this.parryAt = Math.max(now, th.impact - r.pair(c.offset) * sim.tune.parryWindow / 200); this.releaseAt = th.impact + .25 + r.next() * .2; }
        }
      }
    }
    if (this.dodgeAt !== null && now >= this.dodgeAt) { this.dodgeAt = null; sim.dodge(f, this.dodgeSide); this.threat = null; }
    if (this.counterAt !== null && now >= this.counterAt) { this.counterAt = null; if (f.state === 'parry') sim.parryRelease(f); if (sim.startAttack(f, this.counterType)) this.countering = true; this.threat = null; }
    if (this.parryAt !== null && now >= this.parryAt) { this.parryAt = null; if (f.state !== 'parry') sim.parryPress(f); }
    if (f.state === 'parry' && this.releaseAt !== null && now >= this.releaseAt) { this.releaseAt = null; sim.parryRelease(f); this.threat = null; }
    if (f.state === 'parry' && this.releaseAt === null && now - f.parryStart > .9) sim.parryRelease(f);
    // đánh ngay từ thế đỡ
    if (this.ripAt !== null && now >= this.ripAt) { this.ripAt = null; sim.startAttack(f, dist > 2.4 ? 'stab' : (r.chance(.6) ? 'slash' : 'stab')); }
    // nhử
    if (this.feintAt !== null && f.state === 'windup' && now >= this.feintAt) {
      this.feintAt = null; const t = f.atkType!;
      if (sim.feint(f) && r.chance(.6)) { this.forceType = t === 'slash' ? (r.chance(.5) ? 'stab' : 'over') : 'slash'; this.nextAttackAt = now + .17; }
    }
    // đổi đòn: khi thấy mục tiêu chuẩn bị phản đòn khớp loại, hoặc đổi đòn đã tính trước để lừa
    if (c.morphP > 0 && f.state === 'windup' && !f.morphed && !this.countering && !this.morphTo && pl.state === 'windup' && pl.atkType === f.atkType && pl.atkStart > f.atkStart && this.morphSeen !== pl.atkStart) {
      this.morphSeen = pl.atkStart;
      if (r.chance(c.morphP)) this.morphTo = { type: this.other(f.atkType!), at: now + this.react() };
    }
    if (this.morphTo && now >= this.morphTo.at) { const m = this.morphTo; this.morphTo = null; if (f.state === 'windup') sim.morph(f, m.type); }
    // tấn công
    const pendingDef = this.parryAt !== null || this.counterAt !== null || this.dodgeAt !== null || (th && !th.decided);
    const range = f.weapon.slash.range;
    if (f.state === 'idle' && !pendingDef && now >= this.nextAttackAt && dist <= range + .3 && f.st > 18) {
      let type = this.forceType || pick(c.mix, r.next()); this.forceType = null;
      if (sim.diff !== 'easy') {
        if (dist > range - .05 && type === 'slash') type = 'stab';
        if (sim.diff === 'hard' && pl.state === 'parry' && now - pl.parryStart > .25 && r.chance(.6)) type = 'over';
      }
      if (sim.startAttack(f, type)) {
        this.countering = false; this.morphTo = null;
        if (r.chance(c.feint)) this.feintAt = now + f.dur * r.range(.45, .7);
        else if (r.chance(c.morphMix)) this.morphTo = { type: this.other(type), at: now + f.dur * r.range(.35, .55) };
        this.nextAttackAt = now + f.dur + f.atk!.rel + f.atk!.rec + r.pair(c.cd);
      }
    }
    // di chuyển
    let desired = 1.85; if (f.st < 25) desired = 4; if (pl.state === 'dead') desired = 2.5;
    if (now > this.strafeT) { this.strafe *= -1; this.strafeT = now + r.range(.8, 2); }
    const fwd = Math.max(-1, Math.min(1, (dist - desired) * 1.6)), sx = dist < 3.5 ? this.strafe * c.strafe * .7 : 0;
    const s = Math.sin(f.yaw), co = Math.cos(f.yaw);
    return { mx: -s * fwd + co * sx, mz: -co * fwd - s * sx };
  }
}
function pick(mix: Partial<Record<AtkType, number>>, roll: number): AtkType {
  let acc = 0; for (const k of Object.keys(mix) as AtkType[]) { acc += mix[k]!; if (roll <= acc) return k; }
  return Object.keys(mix)[0] as AtkType;
}
export const makeBrain = (sim: Sim, f: Fighter) => new Brain(sim, f);
