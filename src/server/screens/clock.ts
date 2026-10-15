import type { Grid } from '../../shared/board/charset';
import { layoutLines } from '../../shared/board/layout';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function formatTime(d: Date, hour12: boolean): string {
  const minutes = String(d.getMinutes()).padStart(2, '0');
  if (!hour12) return `${String(d.getHours()).padStart(2, '0')}:${minutes}`;
  const hour = d.getHours() % 12 || 12;
  return `${hour}:${minutes} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export function renderClock(now: Date, hour12: boolean): Grid {
  return layoutLines([
    '',
    DAYS[now.getDay()]!,
    `${MONTHS[now.getMonth()]} ${now.getDate()}`,
    '',
    formatTime(now, hour12),
    '',
  ]);
}
