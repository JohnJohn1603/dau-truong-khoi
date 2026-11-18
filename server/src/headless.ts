// Chạy lõi chiến đấu trên Node.js, không có trình duyệt: một trận đánh tự do 3 người (người chơi đứng yên, 2 bot Khó).
// Dùng để kiểm tra (1) lõi chạy được trên máy chủ, (2) cùng hạt giống thì kết quả giống hệt nhau (tất định).
import { Sim, WEAPONS, TICK, DEFAULT_TUNING, type SimEvent } from '@dtk/shared';

function runMatch(seed: number) {
  const sim = new Sim({ ...DEFAULT_TUNING }, seed);
  sim.diff = 'hard';
  sim.setRoster([
    { name: 'Hiệp Sĩ Xám', short: 'Xám', tab: 0x4b5a78, weapon: WEAPONS.sword },
    { name: 'Kiếm Sư Đỏ', short: 'Đỏ', tab: 0x8e2222, weapon: WEAPONS.axe },
  ]);
  sim.startMatch();
  const counts: Record<string, number> = {};
  let ticks = 0, hash = 0;
  const maxTicks = 60 * 60 * 10; // tối đa 10 phút mô phỏng
  while (sim.phase !== 'matchEnd' && ticks < maxTicks) {
    sim.step(TICK); ticks++;
    for (const e of sim.drain() as SimEvent[]) {
      counts[e.k] = (counts[e.k] || 0) + 1;
      hash = (Math.imul(hash, 31) + e.k.length * 7 + ticks) | 0;
    }
  }
  for (const f of sim.fighters) hash = (Math.imul(hash, 31) + Math.round(f.pos.x * 1000) + Math.round(f.pos.z * 1000) + f.wins) | 0;
  return { ticks, seconds: +(ticks * TICK).toFixed(1), rounds: sim.round, wins: sim.fighters.map(f => `${f.short} ${f.wins}`).join(' · '), counts, hash };
}

const t0 = Date.now();
const a = runMatch(42), b = runMatch(42), c = runMatch(7);
console.log('Trận hạt giống 42:', a.seconds, 'giây mô phỏng,', a.rounds, 'hiệp,', a.wins);
console.log('  sự kiện:', a.counts);
console.log('Chạy lại hạt giống 42 cho cùng kết quả:', a.hash === b.hash && a.ticks === b.ticks ? 'CÓ' : 'KHÔNG');
console.log('Hạt giống 7 cho trận khác:', c.hash !== a.hash ? 'CÓ' : 'KHÔNG', `(${c.seconds} giây, ${c.wins})`);
console.log(`Thời gian chạy 3 trận: ${Date.now() - t0} ms`);
