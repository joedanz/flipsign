import { BLANK_GRID, COLS, type Grid } from '../../shared/board/charset';
import { layoutLines, layoutText, padCenter } from '../../shared/board/layout';
import { describe, type Forecast } from '../weather/forecast';

const ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const COL_WIDTH = 7;

function dayAbbr(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return ABBR[new Date(y!, m! - 1, d!).getDay()]!;
}

export function renderWeather(f: Forecast, now: number): Grid {
  const cond = describe(f.current.code);
  const core = `${f.current.temp}° ${cond.label}`;
  const headline = core.length + 4 <= COLS ? `${cond.color} ${core} ${cond.color}` : core;
  // The forecast can outlive its first day (weather fetch failing overnight): skip days already past.
  const d = new Date(now);
  const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const days = f.days.filter((day) => day.date >= todayKey);
  const today = days[0]?.date === todayKey ? days[0] : undefined;
  const hiLo = today ? `HI ${today.high}  LO ${today.low}` : '';
  const outlook = days.slice(today ? 1 : 0, today ? 4 : 3);
  const names = outlook.map((d) => padCenter(dayAbbr(d.date), COL_WIDTH)).join('');
  const temps = outlook.map((d) => padCenter(`${d.high}/${d.low}`, COL_WIDTH)).join('');
  const ageHours = Math.floor((now - f.fetchedAt) / 3_600_000);
  const stale = ageHours >= 2 ? `AS OF ${ageHours}H AGO` : '';
  return layoutLines([stale, headline, hiLo, '', names, temps]);
}

export function renderWeatherSetup(): Grid {
  const r = layoutText('SET LOCATION IN CONTROL PAGE');
  return r.ok ? r.grid : BLANK_GRID;
}
