// Số ngẫu nhiên có hạt giống: cùng hạt giống + cùng chuỗi thao tác → cùng kết quả trên mọi máy.
export interface Rng {
  next(): number;                   // [0, 1)
  range(a: number, b: number): number;
  pair(r: [number, number]): number;
  chance(p: number): boolean;
  seed: number;
}
export function makeRng(seed: number): Rng {
  let s = seed | 0;
  const next = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    get seed() { return s; },
    next,
    range: (a, b) => a + next() * (b - a),
    pair: r => r[0] + next() * (r[1] - r[0]),
    chance: p => next() < p,
  };
}
