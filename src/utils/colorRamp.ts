export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.slice(0, 2) || '15', 16),
    g: parseInt(clean.slice(2, 4) || '23', 16),
    b: parseInt(clean.slice(4, 6) || '42', 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function mixHex(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const clamped = Math.max(0, Math.min(1, t));
  return rgbToHex(
    a.r + (b.r - a.r) * clamped,
    a.g + (b.g - a.g) * clamped,
    a.b + (b.b - a.b) * clamped
  );
}

/**
 * Generates a shade for a base color where t=0 is lightest tint and t=1 is deepest shade.
 */
export function getMonochromeShade(baseHex: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.5) {
    // Mix between very light tint (white-ish) and base color
    const lightTint = mixHex('#FFFFFF', baseHex, 0.22);
    return mixHex(lightTint, baseHex, clamped / 0.5);
  }
  // Mix between base color and deep rich shade
  const deepShade = mixHex(baseHex, '#090D16', 0.52);
  return mixHex(baseHex, deepShade, (clamped - 0.5) / 0.5);
}

export function getContrastTextColor(bgHex: string): string {
  const { r, g, b } = hexToRgb(bgHex);
  // Relative luminance approximation
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? '#0F172A' : '#FFFFFF';
}
