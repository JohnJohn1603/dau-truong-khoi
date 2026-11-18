// Thông điệp giữa client và máy chủ (JSON qua WebSocket). Client JavaScript dùng đúng các tên trường này.
import type { AtkType, Diff, FState, Phase, SimEvent, WeaponId } from '@dtk/shared';

export type ClientMsg =
  | { t: 'create'; name: string; weapon?: WeaponId }
  | { t: 'join'; code: string; name: string; weapon?: WeaponId }
  | { t: 'start'; diff: Diff }
  | { t: 'leave' }
  | { t: 'ping'; ct: number }
  /** Di chuyển và hướng nhìn, gửi ~30 lần/giây. rtt: độ trễ khứ hồi client đo được (giây). */
  | { t: 'in'; fwd: number; side: number; sprint: boolean; yaw: number; rtt: number }
  /** Thao tác; seq tăng dần để máy chủ báo lại đã xử lý tới đâu (ack). */
  | { t: 'act'; seq: number; a: 'attack' | 'parry' | 'parryUp' | 'feint' | 'dodge'; type?: AtkType; side?: number };

export interface LobbyPlayer { pid: number; name: string; host: boolean; }
export interface RosterWire { id: number; name: string; short: string; tab: number; weapon: WeaponId; human: boolean; }
/** Trạng thái một người đấu trong ảnh chụp: mảng gọn theo thứ tự FIELDS để gói tin nhỏ. */
export const FIELDS = ['id', 'x', 'z', 'vx', 'vz', 'yaw', 'hp', 'st', 'state', 't', 'dur', 'atkType', 'riposte', 'morphed', 'flash', 'deadT', 'killType', 'wins', 'dodgeSide', 'walk'] as const;

export type ServerMsg =
  | { t: 'error'; msg: string }
  | { t: 'lobby'; code: string; you: number; players: LobbyPlayer[]; diff: Diff }
  | { t: 'pong'; ct: number }
  | { t: 'start'; roster: RosterWire[]; you: number; tune: unknown }
  /** Ảnh chụp ~20 lần/giây: thời gian máy chủ, pha, hiệp, mọi người đấu (theo FIELDS), sự kiện kể từ ảnh trước, ack thao tác của người nhận. */
  | { t: 'snap'; now: number; phase: Phase; phaseT: number; round: number; f: (number | string | boolean | null)[][]; ev: SimEvent[]; ack: number }
  | { t: 'ended' };

export type { FState };
