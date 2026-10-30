/**
 * Vantage chart tokens. The categorical order is a validated, colorblind-safe
 * order (adjacent-pair CVD ΔE ≥ 8 in both modes). Assign slots in this order;
 * never cycle or generate a 9th hue — fold extra series into "Other".
 * Dark values are stepped for the dark surface, not an automatic inversion.
 */
export type ColorMode = 'light' | 'dark';

export interface ChartTheme {
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  grid: string;
  axis: string;
  categorical: readonly string[];
}

export const MAX_SERIES = 8;

export const THEMES: Record<ColorMode, ChartTheme> = {
  light: {
    surface: '#fcfcfb',
    textPrimary: '#0b0b0b',
    textSecondary: '#52514e',
    textMuted: '#7a7975',
    grid: '#ecebe8',
    axis: '#d6d5d1',
    categorical: [
      '#2a78d6', // blue
      '#eb6834', // orange
      '#1baf7a', // aqua
      '#eda100', // yellow
      '#e87ba4', // magenta
      '#008300', // green
      '#6250d6', // violet
      '#e34948', // red
    ],
  },
  dark: {
    surface: '#1a1a19',
    textPrimary: '#f0efec',
    textSecondary: '#c3c2b7',
    textMuted: '#8f8e86',
    grid: '#2c2c2a',
    axis: '#3d3d3a',
    categorical: [
      '#3987e5',
      '#d95926',
      '#199e70',
      '#c98500',
      '#d55181',
      '#008300',
      '#9085e9',
      '#e66767',
    ],
  },
};
