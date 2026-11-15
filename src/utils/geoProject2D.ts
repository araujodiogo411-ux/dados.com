import { GeoFeature } from './geoManchas';

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  refLon: number;
  minX: number;
  maxY: number;
}

function clampLat(lat: number): number {
  return Math.max(-84, Math.min(84, lat));
}

function mercY(lat: number): number {
  const rad = (clampLat(lat) * Math.PI) / 180;
  return (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function unwrapLon(lon: number, refLon: number): number {
  let x = lon;
  while (x - refLon > 180) x -= 360;
  while (x - refLon < -180) x += 360;
  return x;
}

function unwrapRing(ring: number[][], refLon: number): number[][] {
  if (!ring || ring.length === 0) return [];
  const out: number[][] = [];
  let prevLon = unwrapLon(ring[0][0], refLon);
  out.push([prevLon, ring[0][1]]);
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    prevLon = lon;
    out.push([lon, ring[i][1]]);
  }
  return out;
}

function ringBboxArea(ring: number[][]): { minX: number; minY: number; maxX: number; maxY: number; area: number; realArea: number; cx: number; cy: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const pt of ring) {
    const x = pt[0];
    const y = mercY(pt[1]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (pt[1] < minLat) minLat = pt[1];
    if (pt[1] > maxLat) maxLat = pt[1];
  }
  const w = Math.max(0, maxX - minX);
  const h = Math.max(0, maxY - minY);
  const midLat = (minLat + maxLat) / 2;
  const cosFactor = Math.max(0.1, Math.cos((midLat * Math.PI) / 180));
  const realArea = w * Math.max(0, maxLat - minLat) * cosFactor;
  return { minX, minY, maxX, maxY, area: w * h, realArea, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function collectOuterRings(features: GeoFeature[]): number[][][] {
  const rings: number[][][] = [];
  for (const f of features) {
    const g = f?.geometry;
    if (!g) continue;
    if (g.type === 'Polygon' && Array.isArray(g.coordinates?.[0])) {
      rings.push(g.coordinates[0]);
    } else if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
      for (const poly of g.coordinates) {
        if (Array.isArray(poly?.[0])) rings.push(poly[0]);
      }
    } else if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
      rings.push(g.coordinates);
    } else if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
      for (const line of g.coordinates) {
        if (Array.isArray(line)) rings.push(line);
      }
    }
  }
  return rings;
}

/**
 * Computes a crisp 2D Mercator affine transform fitted to the primary landmass/features
 * with automatic antimeridian unwrapping and zero spherical winding inversion.
 */
export function computeViewportTransform(
  features: GeoFeature[],
  width: number,
  height: number,
  padding = 28
): ViewportTransform {
  const rawRings = collectOuterRings(features);
  if (rawRings.length === 0) {
    return { scale: 1, offsetX: width / 2, offsetY: height / 2, refLon: 0, minX: 0, maxY: 0 };
  }

  // Determine reference longitude from the ring with largest real geographic area
  let bestRing = rawRings[0];
  let bestScore = -1;
  for (const r of rawRings) {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const pt of r) {
      if (pt[0] < minLon) minLon = pt[0];
      if (pt[0] > maxLon) maxLon = pt[0];
      if (pt[1] < minLat) minLat = pt[1];
      if (pt[1] > maxLat) maxLat = pt[1];
    }
    const lonSpan = maxLon - minLon > 180 ? 360 - (maxLon - minLon) : maxLon - minLon;
    const midLat = (minLat + maxLat) / 2;
    const cosFactor = Math.max(0.1, Math.cos((midLat * Math.PI) / 180));
    const score = lonSpan * (maxLat - minLat) * cosFactor + r.length * 0.001;
    if (score > bestScore) {
      bestScore = score;
      bestRing = r;
    }
  }

  // Center longitude of bestRing
  const refLon = bestRing[Math.floor(bestRing.length / 2)]?.[0] ?? 0;

  // Unwrap all rings relative to refLon and compute bounding boxes
  const boxes = rawRings.map((r) => ringBboxArea(unwrapRing(r, refLon)));
  const maxRealArea = Math.max(...boxes.map((b) => b.realArea), 1e-9);
  const largestBox = boxes.find((b) => b.realArea === maxRealArea) || boxes[0];

  // Focus viewport on primary contiguous territory (within ~25 deg of largest landmass)
  // plus major regional territories (e.g., Alaska at >= 20% realArea within 85 deg)
  const primaryBoxes = boxes.filter((b) => {
    const dist = Math.hypot(b.cx - largestBox.cx, b.cy - largestBox.cy);
    if (dist <= 26) return true;
    return b.realArea >= maxRealArea * 0.2 && dist <= 85;
  });

  const usedBoxes = primaryBoxes.length > 0 ? primaryBoxes : boxes;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of usedBoxes) {
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  const spanX = Math.max(0.0001, maxX - minX);
  const spanY = Math.max(0.0001, maxY - minY);
  const availW = Math.max(10, width - padding * 2);
  const availH = Math.max(10, height - padding * 2);

  const scale = Math.min(availW / spanX, availH / spanY);
  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const offsetX = (width - drawnW) / 2;
  const offsetY = (height - drawnH) / 2;

  return { scale, offsetX, offsetY, refLon, minX, maxY };
}

function projectPoint(lon: number, lat: number, tf: ViewportTransform): [number, number] {
  const x = tf.offsetX + (lon - tf.minX) * tf.scale;
  const y = tf.offsetY + (tf.maxY - mercY(lat)) * tf.scale;
  return [x, y];
}

function ringToSvgPath(ring: number[][], tf: ViewportTransform, close = true): string {
  const unwrapped = unwrapRing(ring, tf.refLon);
  if (unwrapped.length === 0) return '';
  let d = '';
  for (let i = 0; i < unwrapped.length; i++) {
    const [px, py] = projectPoint(unwrapped[i][0], unwrapped[i][1], tf);
    d += `${i === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`;
  }
  return close ? `${d}Z` : d;
}

export function featureToSvgPath(feature: GeoFeature, tf: ViewportTransform): string {
  const g = feature?.geometry;
  if (!g) return '';

  if (g.type === 'Polygon') {
    const parts: string[] = [];
    for (const ring of g.coordinates || []) {
      const p = ringToSvgPath(ring, tf, true);
      if (p) parts.push(p);
    }
    return parts.join(' ');
  }

  if (g.type === 'MultiPolygon') {
    const parts: string[] = [];
    for (const poly of g.coordinates || []) {
      for (const ring of poly || []) {
        const p = ringToSvgPath(ring, tf, true);
        if (p) parts.push(p);
      }
    }
    return parts.join(' ');
  }

  if (g.type === 'LineString') {
    return ringToSvgPath(g.coordinates || [], tf, false);
  }

  if (g.type === 'MultiLineString') {
    const parts: string[] = [];
    for (const line of g.coordinates || []) {
      const p = ringToSvgPath(line, tf, false);
      if (p) parts.push(p);
    }
    return parts.join(' ');
  }

  return '';
}
