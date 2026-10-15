import { describe, expect, it } from 'vitest';
import { gridRows } from '../../shared/board/layout';
import { formatTime, renderClock } from './clock';

const at = (h: number, m: number) => new Date(2026, 9, 14, h, m); // Wed 14 Oct 2026, local time

describe('formatTime', () => {
  it('formats 12-hour times', () => {
    expect(formatTime(at(9, 42), true)).toBe('9:42 AM');
    expect(formatTime(at(13, 7), true)).toBe('1:07 PM');
  });

  it('shows midnight and noon as 12, not 0', () => {
    expect(formatTime(at(0, 5), true)).toBe('12:05 AM');
    expect(formatTime(at(12, 0), true)).toBe('12:00 PM');
  });

  it('formats 24-hour times with a leading zero', () => {
    expect(formatTime(at(0, 5), false)).toBe('00:05');
    expect(formatTime(at(13, 7), false)).toBe('13:07');
  });
});

describe('renderClock', () => {
  it('shows weekday, date and time on separate rows', () => {
    const rows = gridRows(renderClock(at(9, 42), true)).map((r) => r.trim());
    expect(rows).toEqual(['', '', '', 'WEDNESDAY', 'OCT 14', '', '9:42 AM', '', '', '']);
  });
});
