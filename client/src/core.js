// Cầu nối giữa phần hiển thị và lõi chiến đấu dùng chung (@dtk/shared).
// Lõi (sim) giữ toàn bộ luật; các biến dưới đây là bản sao chỉ-đọc, cập nhật sau mỗi bước bằng syncCore().
import { Sim, relAngle as _relAngle, committed as _committed } from '@dtk/shared';
import { S } from './config.js';
import { G } from './state.js';

export const sim = new Sim(S, (Math.random() * 2 ** 31) | 0);
export const player = sim.player;
export const bot = sim.bots[0];
// net.js registers itself here (no import, so the core module never waits on the rest of the client)
export const hooks = { netAct: null };
const online = f => G.mode === 'net' && f === player && hooks.netAct;
const netAct = (a, extra) => hooks.netAct(a, extra);
export let now = 0, phase = 'attract', fighters = sim.fighters, bots = sim.bots, brains = sim.brains, round = 1;
export function syncCore() { now = sim.now; phase = sim.phase; fighters = sim.fighters; bots = sim.bots; brains = sim.brains; round = sim.round; }
export function setPhase(p) { sim.phase = p; syncCore(); }
export const inMatch = () => phase === 'countdown' || phase === 'fight' || phase === 'roundEnd';

// thao tác của người chơi / bot
// online, the player's own actions go to the server (which decides) and are also applied locally so they show at once
export const startAttack = (f, t) => { if (online(f)) netAct('attack', { type: t }); return sim.startAttack(f, t); };
export const feint = f => { if (online(f)) netAct('feint'); return sim.feint(f); };
export const parryPress = f => { if (online(f)) netAct('parry'); return sim.parryPress(f); };
export const parryRelease = f => { if (online(f) && f.state === 'parry') netAct('parryUp'); return sim.parryRelease(f); };
export const dodge = (f, side) => { if (online(f)) netAct('dodge', { side }); return sim.dodge(f, side); };

export const relAngle = _relAngle;
export const committed = _committed;
export const brainOf = f => sim.brainOf(f);
export const byId = id => sim.byId(id);
