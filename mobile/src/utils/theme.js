/**
 * RescueLink Design System & Theme Tokens
 *
 * Emergency Color Philosophy:
 * - Red: Emergency action & high alert
 * - Blue: Location, connectivity & informational badges
 * - Green: Positive acknowledgments, success & active health
 * - Amber: Warnings, standby & non-critical alerts
 * - Light Neutrals: Backgrounds, clean rounded card containers
 * - Dark Slate: High-contrast legible typography
 */

export const colors = {
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
  border: '#E2E8F0',
  borderDark: '#CBD5E1',

  // Typography
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textLight: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const typography = {
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 32,
  },
  subHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
  },
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  round: 9999,
};

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
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  sosGlow: {
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
};
