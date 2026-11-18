// Hình học đấu trường dùng cho va chạm: tường bao 30×30 khối và 4 cột đá.
export const HALF = 15;
/** Ô (x, z) của từng cột, mỗi cột chiếm 1×1 khối. */
export const PILLARS: [number, number][] = [[-7, -7], [6, -7], [-7, 6], [6, 6]];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Đẩy một hình tròn (x, z, bán kính r) ra khỏi tường và cột. Sửa trực tiếp p. */
export function collideArena(p: { x: number; z: number }, r: number): void {
  const lim = HALF - r - .05;
  p.x = clamp(p.x, -lim, lim);
  p.z = clamp(p.z, -lim, lim);
  for (const [x, z] of PILLARS) {
    const nx = clamp(p.x, x, x + 1), nz = clamp(p.z, z, z + 1);
    const dx = p.x - nx, dz = p.z - nz, d = Math.hypot(dx, dz);
    if (d < r) {
      if (d < 1e-4) { p.x += r; continue; }
      p.x = nx + dx / d * r;
      p.z = nz + dz / d * r;
    }
  }
}
