// Trạng thái phía client mà nhiều module cùng đọc và ghi (không thuộc luật chiến đấu nên không nằm trong sim).
export const G = {
  paused: false,
  hitstop: 0,      // giây khựng hình còn lại
  shake: 0,        // rung màn hình
  hurt: 0,         // độ đỏ viền khi dính đòn
  mode: 'match',   // 'match' | 'training'
  stats: null,     // thống kê trận của người chơi trên máy này
  score: { p: 0, b: 0 },
  matchStart: 0,
  fpsFrames: 0,
  fpsTime: 0,
  camYaw: 0,
  camPitch: 0,
  mdx: 0,
  mdy: 0,
  muted: false,
  tstats: null,    // thống kê phòng tập
};
