/** Job order lifecycle — mirrors the app's src/domain/status.ts and the DB check constraint. */
export const STATUSES = ['IN_PROGRESS', 'FOR_PARTS_ORDER', 'FOR_PAYMENT', 'COMPLETED', 'RELEASED', 'CANCELLED'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_META: Record<Status, { label: string; tone: string; finished: boolean }> = {
  IN_PROGRESS: { label: 'In progress', tone: 'warn', finished: false },
  FOR_PARTS_ORDER: { label: 'For parts order', tone: 'info', finished: false },
  FOR_PAYMENT: { label: 'For payment', tone: 'info', finished: false },
  COMPLETED: { label: 'Finished', tone: 'ok', finished: true },
  RELEASED: { label: 'Released', tone: 'ok', finished: true },
  CANCELLED: { label: 'Cancelled', tone: 'danger', finished: true },
};

export const normalizeStatus = (s: string): Status => (s in STATUS_META ? (s as Status) : 'IN_PROGRESS');
export const statusLabel = (s: string) => STATUS_META[normalizeStatus(s)].label;
export const statusTone = (s: string) => STATUS_META[normalizeStatus(s)].tone;
export const isFinished = (s: string) => STATUS_META[normalizeStatus(s)].finished;
