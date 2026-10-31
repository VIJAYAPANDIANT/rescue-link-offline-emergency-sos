/**
 * RescueLink Design System & Theme Tokens
 *
 * Emergency Color Philosophy:
 * - Red (Crimson): Emergency action & high alert
 * - Dark Navy: Primary structural elements & high-authority surfaces
 * - Blue (Cobalt): Location, connectivity & informational badges
 * - Green (Emerald): Positive acknowledgments, success & verified health
 * - Amber/Orange: Warnings, standby & non-critical alerts
 * - Neutral surfaces: High-contrast legible typography & accessible backgrounds
 *
 * Accessibility Guidelines:
 * - High contrast (WCAG 2.1 AA compliant)
 * - Color is NEVER used as the sole conveyor of information (paired with icons & labels)
 * - Touch targets >= 48dp on all interactive elements
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
  round: 9999,
};

export const typography = {
  display: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  subHeader: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  bodyBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  bodySmallBold: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: 0.3,
  },
};

export const lightColors = {
  // Brand & Navy
  navy: '#0F172A',
  navyDark: '#0B1120',
  navyLight: '#1E293B',

  // Emergency Crimson
  primary: '#DC2626',
  primaryDark: '#B91C1C',
  primaryLight: '#FEE2E2',
  primaryBorder: '#F87171',

  // Connectivity & Location Blue
  info: '#2563EB',
  infoDark: '#1D4ED8',
  infoLight: '#EFF6FF',
  infoBorder: '#93C5FD',

  // Success & Health Green
  success: '#16A34A',
  successDark: '#15803D',
  successLight: '#DCFCE7',
  successBorder: '#86EFAC',

  // Warning & Standby Amber
  warning: '#D97706',
  warningDark: '#B45309',
  warningLight: '#FEF3C7',
  warningBorder: '#FDE68A',

  // Neutral Surfaces & Text
  background: '#F8FAFC',
  cardBackground: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  surfaceHighlight: '#E2E8F0',
  border: '#E2E8F0',
  borderDark: '#CBD5E1',

  // Typography
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textLight: '#FFFFFF',
  textOnPrimary: '#FFFFFF',

  // Focus & Accessibility
  focusRing: '#2563EB',
  overlayBackground: 'rgba(15, 23, 42, 0.65)',
};

export const darkColors = {
  // Brand & Navy
  navy: '#1E293B',
  navyDark: '#0B1120',
  navyLight: '#334155',

  // Emergency Crimson
  primary: '#EF4444',
  primaryDark: '#DC2626',
  primaryLight: '#450A0A',
  primaryBorder: '#B91C1C',

  // Connectivity & Location Blue
  info: '#3B82F6',
  infoDark: '#2563EB',
  infoLight: '#172554',
  infoBorder: '#1D4ED8',

  // Success & Health Green
  success: '#22C55E',
  successDark: '#16A34A',
  successLight: '#052E16',
  successBorder: '#15803D',

  // Warning & Standby Amber
  warning: '#F59E0B',
  warningDark: '#D97706',
  warningLight: '#451A03',
  warningBorder: '#B45309',

  // Neutral Surfaces & Text
  background: '#0B1120',
  cardBackground: '#0F172A',
  surfaceSubtle: '#1E293B',
  surfaceHighlight: '#334155',
  border: '#1E293B',
  borderDark: '#334155',

  // Typography
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#64748B',
  textLight: '#FFFFFF',
  textOnPrimary: '#FFFFFF',

  // Focus & Accessibility
  focusRing: '#60A5FA',
  overlayBackground: 'rgba(0, 0, 0, 0.8)',
};

// Default backwards compatibility
export const colors = lightColors;

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardElevated: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  sosGlow: {
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  modal: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
};
