/**
 * NAGARWATCH — Centralized Design System Tokens & Constants
 * 
 * Design Philosophies:
 * 1. Warm Paper (Citizen Portal): #F4F1EA base, #FBF9F4 raised surface, #E5E0D4 hairline border, #1C1917 warm ink.
 * 2. Warm Graphite (Ops Command Center): #18181B base, #222226 surface, #333338 border, #F4F4F5 primary text.
 * 3. Single Sharp Accent: Signal Vermilion (#D9381E on light, #F05030 on dark).
 * 4. Multi-Modal Status Set: Distinct by Hue, Label, AND Shape/Icon (WCAG AA Compliant).
 */

export const DESIGN_TOKENS = {
  colors: {
    light: {
      bg: '#F4F1EA',
      surface: '#FBF9F4',
      subtle: '#EFECE4',
      border: '#E5E0D4',
      primary: '#1C1917',
      text: '#1C1917',
      secondaryText: '#57534E',
      accent: '#D9381E',
      accentHover: '#B82810',
    },
    dark: {
      bg: '#18181B',
      surface: '#222226',
      elevated: '#2B2B30',
      border: '#333338',
      primaryText: '#F4F4F5',
      secondaryText: '#A1A1AA',
      accent: '#F05030',
    },
    status: {
      reported: {
        label: 'Open',
        shape: 'circle',
        text: '#1E5A8A',
        bg: '#EBF3FA',
        border: '#BCD6ED',
        darkText: '#6BA3D6',
        darkBg: '#162838',
        darkBorder: '#234460',
        dot: '#1E5A8A',
      },
      verified: {
        label: 'Verified',
        shape: 'shield',
        text: '#0E6F64',
        bg: '#E6F7F5',
        border: '#A7E3DC',
        darkText: '#38B2AC',
        darkBg: '#122D29',
        darkBorder: '#1A4D46',
        dot: '#0E6F64',
      },
      assigned: {
        label: 'Assigned',
        shape: 'user',
        text: '#8C5303',
        bg: '#FEF7EA',
        border: '#F7D7A3',
        darkText: '#E2A03F',
        darkBg: '#302210',
        darkBorder: '#503818',
        dot: '#8C5303',
      },
      in_progress: {
        label: 'In Progress',
        shape: 'clock',
        text: '#92400E',
        bg: '#FEF3C7',
        border: '#FCD34D',
        darkText: '#F59E0B',
        darkBg: '#332008',
        darkBorder: '#593810',
        dot: '#92400E',
      },
      resolved: {
        label: 'Resolved',
        shape: 'check',
        text: '#166534',
        bg: '#EDF7F0',
        border: '#B7E4C7',
        darkText: '#4ADE80',
        darkBg: '#132A1C',
        darkBorder: '#1F472F',
        dot: '#166534',
      },
      closed: {
        label: 'Closed',
        shape: 'lock',
        text: '#44403C',
        bg: '#F5F5F4',
        border: '#D6D3D1',
        darkText: '#A8A29E',
        darkBg: '#262422',
        darkBorder: '#3D3A37',
        dot: '#78716C',
      },
      rejected: {
        label: 'Rejected',
        shape: 'cross',
        text: '#991B1B',
        bg: '#FEE2E2',
        border: '#FCA5A5',
        darkText: '#F87171',
        darkBg: '#361515',
        darkBorder: '#5C2222',
        dot: '#991B1B',
      },
      urgent: {
        label: 'Urgent Target',
        shape: 'alert',
        text: '#B91C1C',
        bg: '#FEF2F2',
        border: '#F87171',
        darkText: '#EF4444',
        darkBg: '#361515',
        darkBorder: '#6E2525',
        dot: '#B91C1C',
      },
    },
    severity: {
      low: {
        label: 'Low',
        text: '#166534',
        bg: '#EDF7F0',
        border: '#B7E4C7',
        badge: 'bg-[#EDF7F0] text-[#166534] border-[#B7E4C7]',
      },
      medium: {
        label: 'Medium',
        text: '#8C5303',
        bg: '#FEF7EA',
        border: '#F7D7A3',
        badge: 'bg-[#FEF7EA] text-[#8C5303] border-[#F7D7A3]',
      },
      high: {
        label: 'High',
        text: '#B45309',
        bg: '#FFFBEB',
        border: '#FCD34D',
        badge: 'bg-[#FFFBEB] text-[#B45309] border-[#FCD34D]',
      },
      critical: {
        label: 'Critical',
        text: '#991B1B',
        bg: '#FEE2E2',
        border: '#FCA5A5',
        badge: 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5] font-semibold',
      },
    },
  },
  typography: {
    serifFont: "'Instrument Serif', Georgia, serif",
    headingFont: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    bodyFont: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    monoFont: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  breakpoints: {
    mobileSmall: 320,
    mobileStandard: 360,
    mobileMedium: 390,
    mobileLarge: 430,
    tablet: 768,
    desktopSmall: 1024,
    desktopStandard: 1280,
    desktopLarge: 1440,
    desktopUltrawide: 1920,
  },
  radii: {
    xs: 'rounded-xs',     // 2px
    sm: 'rounded-sm',     // 4px
    base: 'rounded-md',   // 6px
    panel: 'rounded-lg',  // 8px
    full: 'rounded-full', // for small status dots and avatars
  },
  touchTarget: {
    minHeight: 'min-h-[44px]',
    minWidth: 'min-w-[44px]',
  },
} as const;

/**
 * Normalizes backend status string into known status key
 */
export function normalizeStatus(status?: string): keyof typeof DESIGN_TOKENS.colors.status {
  if (!status) return 'reported';
  const clean = status.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (clean === 'pending') return 'reported';
  if (clean in DESIGN_TOKENS.colors.status) {
    return clean as keyof typeof DESIGN_TOKENS.colors.status;
  }
  return 'reported';
}

/**
 * Normalizes severity into a known severity level
 */
export function normalizeSeverity(severity?: string): keyof typeof DESIGN_TOKENS.colors.severity {
  if (!severity) return 'medium';
  const clean = severity.toLowerCase().trim();
  if (clean in DESIGN_TOKENS.colors.severity) {
    return clean as keyof typeof DESIGN_TOKENS.colors.severity;
  }
  return 'medium';
}
