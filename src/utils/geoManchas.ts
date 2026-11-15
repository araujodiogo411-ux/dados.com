import polygonClipping, { MultiPolygon, Polygon } from 'polygon-clipping';

export interface GeoFeature {
  type: 'Feature';
  id?: string | number;
  properties: {
    id?: string;
    name: string;
    sigla?: string;
    bbox?: [number, number, number, number];
    highway?: string;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: any;
  };
}

function geometryToMultiPolygon(geometry: any): MultiPolygon {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates as Polygon];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates as MultiPolygon;
  }
  return [];
}

function unionFeaturesSafe(features: GeoFeature[]): MultiPolygon {
  const polys: MultiPolygon[] = features
    .map((f) => geometryToMultiPolygon(f.geometry))
    .filter((mp) => mp.length > 0);
  if (polys.length === 0) return [];

  try {
    // Union in chunks to avoid geometry failures if one polygon has minor self-intersections
    let merged: MultiPolygon = polys[0];
    for (let i = 1; i < polys.length; i++) {
      try {
        merged = polygonClipping.union(merged, polys[i]);
      } catch {
        merged = [...merged, ...polys[i]];
      }
    }
    return merged;
  } catch {
    return polys.flat();
  }
}

/**
 * Dissolves all territory polygons (e.g. states or municipalities) into one clean outer silhouette
 * without overlapping internal edges so clipPath never cancels adjacent boundaries.
 */
export function buildUnifiedTerritoryOutline(features: GeoFeature[]): GeoFeature | null {
  if (features.length === 0) return null;
  if (features.length === 1) return features[0];
  const merged = unionFeaturesSafe(features);
  return {
    type: 'Feature',
    properties: { name: 'Contorno Territorial' },
    geometry: {
      type: 'MultiPolygon',
      coordinates: merged,
    },
  };
}

/**
 * Dissolves/unions all GeoJSON polygons that share the same color into unified GeoJSON features
 * so adjacent countries, states, or municipalities of the same color merge into continuous "manchas".
 */
export function buildDissolvedManchas(
  features: GeoFeature[],
  colorMap: Record<string, string>
): Array<{ color: string; feature: GeoFeature; count: number }> {
  const byColor = new Map<string, GeoFeature[]>();

  for (const f of features) {
    const fid = String(f.properties?.id || f.id || f.properties?.name || '');
    const color = colorMap[fid];
    if (!color) continue;
    const arr = byColor.get(color) || [];
    arr.push(f);
    byColor.set(color, arr);
  }

  const result: Array<{ color: string; feature: GeoFeature; count: number }> = [];

  for (const [color, group] of byColor.entries()) {
    const merged = unionFeaturesSafe(group);
    if (merged.length === 0) continue;
    result.push({
      color,
      count: group.length,
      feature: {
        type: 'Feature',
        properties: { name: `Mancha ${color}` },
        geometry: {
          type: 'MultiPolygon',
          coordinates: merged,
        },
      },
    });
  }

  return result;
}
