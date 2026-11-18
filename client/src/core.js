// Cầu nối giữa phần hiển thị và lõi chiến đấu dùng chung (@dtk/shared).
// Lõi (sim) giữ toàn bộ luật; các biến dưới đây là bản sao chỉ-đọc, cập nhật sau mỗi bước bằng syncCore().
import { Sim, relAngle as _relAngle, committed as _committed } from '@dtk/shared';
import { S } from './config.js';

export const sim = new Sim(S, (Math.random() * 2 ** 31) | 0);
export const player = sim.player;
export const bot = sim.bots[0];
export let now = 0, phase = 'attract', fighters = sim.fighters, bots = sim.bots, brains = sim.brains, round = 1;
export function syncCore() { now = sim.now; phase = sim.phase; fighters = sim.fighters; bots = sim.bots; brains = sim.brains; round = sim.round; }
export function setPhase(p) { sim.phase = p; syncCore(); }
export const inMatch = () => phase === 'countdown' || phase === 'fight' || phase === 'roundEnd';

// thao tác của người chơi / bot
export const startAttack = (f, t) => sim.startAttack(f, t);
export const feint = f => sim.feint(f);
export const parryPress = f => sim.parryPress(f);
export const parryRelease = f => sim.parryRelease(f);
export const dodge = (f, side) => sim.dodge(f, side);

export const relAngle = _relAngle;
export const committed = _committed;
export const brainOf = f => sim.brainOf(f);
export const byId = id => sim.byId(id);
