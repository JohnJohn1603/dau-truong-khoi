// Bảng vũ khí, cấu hình bot và các thông số chỉnh được của luật chiến đấu.
// Không phụ thuộc trình duyệt hay Three.js: dùng chung cho client và máy chủ.

export type AtkType = 'slash' | 'stab' | 'over';
export type Diff = 'easy' | 'med' | 'hard';
export type WeaponId = 'sword' | 'axe';

export interface Attack {
  wind: number;   // giây vào đòn
  rel: number;    // giây ra đòn
  rec: number;    // giây hồi đòn
  dmg: number;
  range: number;  // mét
  arc: number;    // độ, cung quét
  cost: number;   // thể lực
  stun?: number;  // giây choáng (đòn đập)
}
export interface Weapon {
  id: WeaponId;
  name: string;
  blockCost: number; // hệ số thể lực mất khi cầm vũ khí này đỡ
  drainMul: number;  // hệ số thể lực vũ khí này rút của người đỡ
  slash: Attack;
  stab: Attack;
  over: Attack;
}

export const WEAPONS: Record<WeaponId, Weapon> = {
  sword: {
    id: 'sword', name: 'Kiếm', blockCost: 1.0, drainMul: 1.0,
    slash: { wind: .49, rel: .22, rec: .32, dmg: 28, range: 2.35, arc: 110, cost: 12 },
    stab: { wind: .50, rel: .14, rec: .38, dmg: 33, range: 2.75, arc: 14, cost: 10 },
    over: { wind: .63, rel: .20, rec: .45, dmg: 40, range: 2.3, arc: 30, cost: 16, stun: .45 },
  },
  axe: {
    id: 'axe', name: 'Rìu', blockCost: 1.15, drainMul: 1.3,
    slash: { wind: .57, rel: .26, rec: .40, dmg: 34, range: 2.25, arc: 100, cost: 15 },
    stab: { wind: .54, rel: .16, rec: .42, dmg: 24, range: 2.3, arc: 14, cost: 11 },
    over: { wind: .73, rel: .22, rec: .52, dmg: 52, range: 2.25, arc: 28, cost: 20, stun: .6 },
  },
};

/** Phần của pha ra đòn mà lưỡi thường chạm người đứng giữa (dùng để bot dự đoán lúc chạm). */
export const IMPACT_P: Record<AtkType, number> = { slash: .5, stab: .35, over: .6 };
export const ATK_TYPES: AtkType[] = ['slash', 'stab', 'over'];

export interface BotCfg {
  name: string; turn: number; speed: number; cd: [number, number]; mix: Partial<Record<AtkType, number>>;
  parryP: number; react: [number, number]; offset: [number, number]; counterP: number; cOffset: [number, number];
  feint: number; ripP: number; readFeint: number; cancelP: number; strafe: number;
  morphP: number; morphMix: number; morphCounter: number; dodgeP: number;
}
export const BOT_CFG: Record<Diff, BotCfg> = {
  easy: { name: 'Dễ', turn: 2.6, speed: 3.3, cd: [1.3, 2.3], mix: { slash: 1 }, parryP: 0, react: [.3, .4], offset: [0, 0], counterP: 0, cOffset: [0, 0], feint: 0, ripP: 0, readFeint: 0, cancelP: 0, strafe: .3, morphP: 0, morphMix: 0, morphCounter: 0, dodgeP: 0 },
  med: { name: 'Vừa', turn: 4.2, speed: 3.8, cd: [.8, 1.6], mix: { slash: .5, stab: .25, over: .25 }, parryP: .62, react: [.22, .34], offset: [0, .42], counterP: .15, cOffset: [0, .36], feint: 0, ripP: .4, readFeint: .15, cancelP: .3, strafe: .6, morphP: .1, morphMix: .06, morphCounter: 0, dodgeP: .15 },
  hard: { name: 'Khó', turn: 6.5, speed: 4.2, cd: [.45, 1.1], mix: { slash: .4, stab: .3, over: .3 }, parryP: .9, react: [.15, .22], offset: [.03, .18], counterP: .5, cOffset: [.04, .2], feint: .28, ripP: .8, readFeint: .6, cancelP: .8, strafe: 1, morphP: .6, morphMix: .2, morphCounter: .5, dodgeP: .3 },
};

/** Thông số luật chỉnh được trong game (bảng Esc). Máy chủ sẽ chốt một bộ cho mọi người. */
export interface Tuning {
  parryWindow: number;   // ms
  counterWindow: number; // ms
  dodgeCost: number;
  dodgeCD: number;       // giây
  atkSpeed: number;      // hệ số
  dmgMul: number;        // hệ số
  stamRegen: number;     // /giây
  botReact: number;      // hệ số thời gian phản xạ bot
}
export const DEFAULT_TUNING: Tuning = {
  parryWindow: 200, counterWindow: 250, dodgeCost: 14, dodgeCD: .75, atkSpeed: 1, dmgMul: 1, stamRegen: 22, botReact: 1,
};

/** Bước mô phỏng cố định: 60 lần/giây trên cả client lẫn máy chủ. */
export const TICK = 1 / 60;
export const WINS_TO_WIN = 3;
export const COUNTDOWN_S = 3;
export const ROUND_END_S = 2.6;
/** Tốc độ xoay tối đa (rad/s) khi đòn đã vào giai đoạn cuối: lách ngang đúng lúc mới thắng được việc bám theo. */
export const TURN_CAP = 1.2;
export const DODGE_T = .24;
