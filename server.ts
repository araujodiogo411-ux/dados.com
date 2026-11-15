import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { WORLD_COUNTRIES } from './src/data/countries.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;
const USER_AGENT = 'PrismaDados-Cartografia/1.0 (contact@prismadados.local)';

// Simple in-memory cache with 30-minute TTL
const cache = new Map<string, { data: unknown; expiresAt: number }>();
function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}
function setCached(key: string, data: unknown, ttlMs = 30 * 60 * 1000) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

async function fetchJsonWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Load local world-atlas 50m TopoJSON once
let worldAtlasFeatures: any[] | null = null;
function getWorldAtlasFeatures(): any[] {
  if (worldAtlasFeatures) return worldAtlasFeatures;
  const topoPath = path.join(__dirname, 'node_modules/world-atlas/countries-50m.json');
  const raw = JSON.parse(fs.readFileSync(topoPath, 'utf-8'));
  const fc = feature(raw, raw.objects.countries) as any;
  worldAtlasFeatures = fc.features || [];
  return worldAtlasFeatures!;
}

// Helper: compute [minLon, minLat, maxLon, maxLat] for a GeoJSON geometry
function computeBbox(geometry: any): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (coords: any) => {
    if (typeof coords[0] === 'number') {
      if (coords[0] < minX) minX = coords[0];
      if (coords[0] > maxX) maxX = coords[0];
      if (coords[1] < minY) minY = coords[1];
      if (coords[1] > maxY) maxY = coords[1];
    } else {
      for (const c of coords) walk(c);
    }
  };
  if (geometry?.coordinates) walk(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

// Helper: simple centroid of geometry bbox
function getBboxCenter(bbox: [number, number, number, number]): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

function pointInBbox(pt: [number, number], bbox: [number, number, number, number], margin = 0.05): boolean {
  return (
    pt[0] >= bbox[0] - margin &&
    pt[0] <= bbox[2] + margin &&
    pt[1] >= bbox[1] - margin &&
    pt[1] <= bbox[3] + margin
  );
}

// Ray-casting point in ring
function pointInRing(pt: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeometry(pt: [number, number], geometry: any): boolean {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    if (!pointInRing(pt, geometry.coordinates[0])) return false;
    for (let i = 1; i < geometry.coordinates.length; i++) {
      if (pointInRing(pt, geometry.coordinates[i])) return false;
    }
    return true;
  }
  if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      if (pointInRing(pt, poly[0])) {
        let inHole = false;
        for (let i = 1; i < poly.length; i++) {
          if (pointInRing(pt, poly[i])) {
            inHole = true;
            break;
          }
        }
        if (!inHole) return true;
      }
    }
  }
  return false;
}

// Normalize text for search
function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// 1. Search countries, islands, or territories worldwide
app.get('/api/geo/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.json({ results: WORLD_COUNTRIES.slice(0, 12) });
  }
  const nq = normalizeText(q);
  const localMatches = WORLD_COUNTRIES.filter(
    (c) =>
      normalizeText(c.namePt).includes(nq) ||
      normalizeText(c.nameEn).includes(nq) ||
      c.iso2.toLowerCase() === nq ||
      c.iso3.toLowerCase() === nq
  );

  // Also check world-atlas names not in our curated list
  const atlas = getWorldAtlasFeatures();
  const atlasMatches = atlas
    .filter((f) => {
      const name = String(f.properties?.name || '');
      return normalizeText(name).includes(nq);
    })
    .slice(0, 8)
    .map((f) => {
      const existing = WORLD_COUNTRIES.find(
        (c) =>
          normalizeText(c.nameEn) === normalizeText(String(f.properties?.name || '')) ||
          (c.numericId && c.numericId === String(f.id).padStart(3, '0'))
      );
      if (existing) return existing;
      return {
        namePt: String(f.properties?.name || 'Território'),
        nameEn: String(f.properties?.name || 'Territory'),
        iso2: '',
        iso3: '',
        numericId: String(f.id || ''),
        continent: 'Ásia' as const,
        region: 'Território Mundial',
      };
    });

  const combined = [...localMatches];
  for (const item of atlasMatches) {
    if (!combined.some((x) => x.namePt === item.namePt && x.nameEn === item.nameEn)) {
      combined.push(item);
    }
  }

  // If few local matches (e.g. a specific island, city, or region), query Nominatim
  if (combined.length < 3) {
    try {
      const cacheKey = `search:${nq}`;
      let nomResults = getCached<any[]>(cacheKey);
      if (!nomResults) {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&accept-language=pt-BR,pt,en`;
        nomResults = await fetchJsonWithTimeout(url, {}, 8000);
        setCached(cacheKey, nomResults);
      }
      for (const item of nomResults || []) {
        const cc = String(item.address?.country_code || '').toUpperCase();
        const catalogMatch = WORLD_COUNTRIES.find((c) => c.iso2 === cc);
        const label = String(item.display_name || '').split(',')[0].trim();
        if (!combined.some((x) => normalizeText(x.namePt) === normalizeText(label))) {
          combined.push({
            namePt: label,
            nameEn: label,
            iso2: cc || catalogMatch?.iso2 || '',
            iso3: catalogMatch?.iso3 || '',
            numericId: catalogMatch?.numericId || '',
            continent: catalogMatch?.continent || 'Europa',
            region: item.type === 'island' ? 'Ilha' : (item.address?.country || 'Território Real'),
            osmType: item.osm_type,
            osmId: item.osm_id,
          } as any);
        }
      }
    } catch {
      // Ignore Nominatim timeout; return local matches
    }
  }

  res.json({ results: combined.slice(0, 20) });
});

// Helper: filter MultiPolygon/Polygon rings within a geographic lon/lat box (for transcontinental countries in continent views)
function filterGeometryByBox(geometry: any, minLon: number, maxLon: number, minLat: number, maxLat: number, clampLon = false) {
  if (!geometry) return null;
  const filterRing = (ring: number[][]) => {
    let anyInside = false;
    for (const pt of ring) {
      if (pt[0] >= minLon && pt[0] <= maxLon && pt[1] >= minLat && pt[1] <= maxLat) {
        anyInside = true;
        break;
      }
    }
    if (!anyInside) return null;
    if (!clampLon) return ring;
    return ring.map((pt) => [Math.max(minLon, Math.min(maxLon, pt[0])), pt[1]]);
  };

  if (geometry.type === 'Polygon') {
    const outer = filterRing(geometry.coordinates[0]);
    if (!outer) return null;
    return { type: 'Polygon', coordinates: [outer, ...geometry.coordinates.slice(1)] };
  }
  if (geometry.type === 'MultiPolygon') {
    const polys = [];
    for (const poly of geometry.coordinates) {
      const outer = filterRing(poly[0]);
      if (outer) polys.push([outer, ...poly.slice(1)]);
    }
    if (polys.length === 0) return null;
    return { type: 'MultiPolygon', coordinates: polys };
  }
  return geometry;
}

// 1b. Get 2D GeoJSON FeatureCollection for an entire Continent / Macro-Region
app.get('/api/geo/continent', (req, res) => {
  const id = String(req.query.id || 'americasul').trim().toLowerCase();
  const cacheKey = `continent:${id}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return res.json(cached);

  const atlas = getWorldAtlasFeatures();

  const matchesContinent = (c: (typeof WORLD_COUNTRIES)[number]) => {
    switch (id) {
      case 'americasul':
        return c.continent === 'América do Sul';
      case 'americalatina':
        return Boolean(c.isLatinAmerica || c.continent === 'América do Sul');
      case 'americanorte':
        return c.continent === 'América do Norte';
      case 'caribe':
        return Boolean(c.isCaribbean);
      case 'europa':
        return c.continent === 'Europa';
      case 'asia':
        return c.continent === 'Ásia' || c.iso2 === 'RU';
      case 'africa':
        return c.continent === 'África';
      case 'oceania':
        return c.continent === 'Oceania';
      default:
        return c.continent === 'América do Sul';
    }
  };

  const targetCountries = WORLD_COUNTRIES.filter(matchesContinent);
  const features: any[] = [];

  for (const country of targetCountries) {
    const nEn = normalizeText(country.nameEn);
    const matched =
      atlas.find((f) => normalizeText(String(f.properties?.name || '')) === nEn) ||
      atlas.find((f) => country.numericId && String(f.id).padStart(3, '0') === country.numericId.padStart(3, '0'));
    if (!matched) continue;

    let geom = matched.geometry;
    if (id === 'europa') {
      if (country.iso2 === 'RU') {
        geom = filterGeometryByBox(geom, 19, 60, 41, 82, true);
      } else {
        geom = filterGeometryByBox(geom, -26, 48, 34, 72, false);
      }
    } else if (id === 'asia' && country.iso2 === 'RU') {
      geom = filterGeometryByBox(geom, 58, 180, 41, 82, true);
    } else if (id === 'americanorte' && country.iso2 === 'US') {
      geom = filterGeometryByBox(geom, -180, -50, 18, 72, false);
    }

    if (!geom) continue;
    features.push({
      type: 'Feature',
      id: country.iso3 || country.numericId || country.nameEn,
      properties: {
        id: country.iso3 || country.numericId || country.nameEn,
        name: country.namePt,
        nameEn: country.nameEn,
        iso2: country.iso2,
        iso3: country.iso3,
        numericId: country.numericId,
        continent: country.continent,
        bbox: computeBbox(geom),
      },
      geometry: geom,
    });
  }

  const result = { type: 'FeatureCollection', features, meta: { id, count: features.length } };
  setCached(cacheKey, result);
  res.json(result);
});

// 2. Get 2D GeoJSON boundary for a country or island
app.get('/api/geo/country', async (req, res) => {
  const numericId = String(req.query.numericId || '').trim();
  const iso2 = String(req.query.iso2 || '').trim().toUpperCase();
  const iso3 = String(req.query.iso3 || '').trim().toUpperCase();
  const name = String(req.query.name || '').trim();
  const osmType = String(req.query.osmType || '').trim();
  const osmId = String(req.query.osmId || '').trim();

  const cacheKey = `country:${numericId}:${iso2}:${iso3}:${name}:${osmId}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return res.json(cached);

  try {
    // If specific OSM relation/island requested without numericId, query Nominatim polygon
    if (osmId && osmType && !numericId) {
      const prefix = osmType === 'relation' ? 'R' : osmType === 'way' ? 'W' : 'N';
      const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=${prefix}${osmId}&format=geojson&polygon_geojson=1&polygon_threshold=0.005`;
      const fc = await fetchJsonWithTimeout(url, {}, 12000);
      if (fc?.features?.length) {
        const result = {
          type: 'FeatureCollection',
          features: fc.features,
          meta: { name, iso2, iso3 },
        };
        setCached(cacheKey, result);
        return res.json(result);
      }
    }

    // Check local world-atlas 50m (prefer exact name match first, then numericId)
    const atlas = getWorldAtlasFeatures();
    const nName = normalizeText(name);
    let matched =
      (nName ? atlas.find((f) => normalizeText(String(f.properties?.name || '')) === nName) : undefined) ||
      (numericId ? atlas.find((f) => String(f.id).padStart(3, '0') === numericId.padStart(3, '0')) : undefined);

    if (matched) {
      const result = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: matched.id,
            properties: {
              name: name || matched.properties?.name || 'Território',
              iso2,
              iso3,
            },
            geometry: matched.geometry,
          },
        ],
        meta: { name: name || matched.properties?.name, iso2, iso3 },
      };
      setCached(cacheKey, result);
      return res.json(result);
    }

    // Fallback: Nominatim search with polygon_geojson
    if (name) {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=geojson&polygon_geojson=1&polygon_threshold=0.005&limit=1`;
      const fc = await fetchJsonWithTimeout(url, {}, 12000);
      if (fc?.features?.length) {
        const result = {
          type: 'FeatureCollection',
          features: fc.features,
          meta: { name, iso2, iso3 },
        };
        setCached(cacheKey, result);
        return res.json(result);
      }
    }

    res.status(404).json({ error: 'Território não encontrado' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao carregar território' });
  }
});

// 3. Get real States / Provinces (ADM1) for a country
app.get('/api/geo/states', async (req, res) => {
  const iso2 = String(req.query.iso2 || '').trim().toUpperCase();
  const iso3 = String(req.query.iso3 || '').trim().toUpperCase();
  const countryName = String(req.query.name || '').trim();

  const cacheKey = `states:${iso2}:${iso3}:${countryName}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Special official API for Brasil (IBGE) with fallback to geoBoundaries if IBGE times out
    if (iso2 === 'BR' || iso3 === 'BRA') {
      try {
        const [malha, localidades] = await Promise.all([
          fetchJsonWithTimeout(
            'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&formato=application/vnd.geo+json&qualidade=minima',
            {},
            9000
          ),
          fetchJsonWithTimeout('https://servicodados.ibge.gov.br/api/v1/localidades/estados', {}, 9000),
        ]);
        const ufMap = new Map<string, { nome: string; sigla: string; regiao: string }>();
        for (const uf of localidades || []) {
          ufMap.set(String(uf.id), {
            nome: uf.nome,
            sigla: uf.sigla,
            regiao: uf.regiao?.nome || '',
          });
        }
        const features = (malha.features || []).map((f: any) => {
          const cod = String(f.properties?.codarea || f.id || '');
          const info = ufMap.get(cod);
          return {
            type: 'Feature',
            id: cod,
            properties: {
              id: cod,
              name: info?.nome || `UF ${cod}`,
              sigla: info?.sigla || '',
              region: info?.regiao || '',
              bbox: computeBbox(f.geometry),
            },
            geometry: f.geometry,
          };
        });
        if (features.length > 0) {
          const result = { type: 'FeatureCollection', features };
          setCached(cacheKey, result);
          return res.json(result);
        }
      } catch {
        // Fallback smoothly to geoBoundaries BRA/ADM1 below
      }
    }

    // Worldwide ADM1 via geoBoundaries
    if (iso3) {
      const metaUrl = `https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ADM1/`;
      const meta = await fetchJsonWithTimeout(metaUrl, {}, 12000);
      const geoUrl = meta?.simplifiedGeometryGeoJSON || meta?.gjDownloadURL;
      if (geoUrl) {
        const gj = await fetchJsonWithTimeout(geoUrl, {}, 25000);
        const features = (gj.features || []).map((f: any, idx: number) => {
          const shapeName =
            f.properties?.shapeName ||
            f.properties?.NAME_1 ||
            f.properties?.name ||
            `Estado ${idx + 1}`;
          const id = String(f.properties?.shapeID || f.properties?.shapeISO || `${iso3}-S-${idx}`);
          return {
            type: 'Feature',
            id,
            properties: {
              id,
              name: shapeName,
              iso: f.properties?.shapeISO || '',
              bbox: computeBbox(f.geometry),
            },
            geometry: f.geometry,
          };
        });
        const result = { type: 'FeatureCollection', features };
        setCached(cacheKey, result);
        return res.json(result);
      }
    }

    res.status(404).json({ error: 'Estados não disponíveis para este território' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao buscar estados reais' });
  }
});

// 4. Get real Municipalities / Counties (ADM2) inside a selected State
app.get('/api/geo/municipalities', async (req, res) => {
  const iso2 = String(req.query.iso2 || '').trim().toUpperCase();
  const iso3 = String(req.query.iso3 || '').trim().toUpperCase();
  const stateId = String(req.query.stateId || '').trim();
  const stateName = String(req.query.stateName || '').trim();

  const cacheKey = `munis:${iso2}:${iso3}:${stateId}:${stateName}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Official IBGE Municipalities for any Brazilian State when stateId is an IBGE UF numeric code
    if ((iso2 === 'BR' || iso3 === 'BRA') && /^\d{2}$/.test(stateId)) {
      try {
        const [malha, localidades] = await Promise.all([
          fetchJsonWithTimeout(
            `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${encodeURIComponent(stateId)}?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade=minima`,
            {},
            12000
          ),
          fetchJsonWithTimeout(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(stateId)}/municipios`,
            {},
            10000
          ),
        ]);
        const muniMap = new Map<string, string>();
        for (const m of localidades || []) {
          muniMap.set(String(m.id), m.nome);
        }
        const features = (malha.features || []).map((f: any) => {
          const cod = String(f.properties?.codarea || f.id || '');
          const nome = muniMap.get(cod) || `Município ${cod}`;
          return {
            type: 'Feature',
            id: cod,
            properties: {
              id: cod,
              name: nome,
              bbox: computeBbox(f.geometry),
            },
            geometry: f.geometry,
          };
        });
        if (features.length > 0) {
          const result = { type: 'FeatureCollection', features };
          setCached(cacheKey, result);
          return res.json(result);
        }
      } catch {
        // Fallback smoothly to geoBoundaries BRA/ADM2 below
      }
    }

    // Worldwide ADM2 via geoBoundaries filtered spatially by the parent state's geometry
    if (iso3) {
      // Load states cache or fetch ADM1 to get exact state geometry for spatial filtering
      const statesCacheKey = `states:${iso2}:${iso3}:`;
      let stateGeom: any = null;
      let stateBbox: [number, number, number, number] | null = null;

      // Try finding state geometry from any matching states cache entry
      for (const [k, v] of cache.entries()) {
        if (k.startsWith(`states:${iso2}:${iso3}:`)) {
          const fc = v.data as any;
          const st = fc?.features?.find(
            (f: any) => f.id === stateId || normalizeText(f.properties?.name || '') === normalizeText(stateName)
          );
          if (st) {
            stateGeom = st.geometry;
            stateBbox = st.properties?.bbox || computeBbox(st.geometry);
            break;
          }
        }
      }

      if (!stateGeom) {
        const meta1 = await fetchJsonWithTimeout(`https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ADM1/`, {}, 12000);
        const geoUrl1 = meta1?.simplifiedGeometryGeoJSON || meta1?.gjDownloadURL;
        if (geoUrl1) {
          const gj1 = await fetchJsonWithTimeout(geoUrl1, {}, 20000);
          const st = (gj1.features || []).find(
            (f: any) =>
              String(f.properties?.shapeID || f.properties?.shapeISO) === stateId ||
              normalizeText(String(f.properties?.shapeName || f.properties?.NAME_1 || '')) === normalizeText(stateName)
          );
          if (st) {
            stateGeom = st.geometry;
            stateBbox = computeBbox(st.geometry);
          }
        }
      }

      const meta2Url = `https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ADM2/`;
      const meta2 = await fetchJsonWithTimeout(meta2Url, {}, 12000);
      const geoUrl2 = meta2?.simplifiedGeometryGeoJSON || meta2?.gjDownloadURL;
      if (geoUrl2) {
        // Cache the full country ADM2 in memory so clicking other states in same country is instant
        const countryAdm2Key = `adm2raw:${iso3}`;
        let gj2 = getCached<any>(countryAdm2Key);
        if (!gj2) {
          gj2 = await fetchJsonWithTimeout(geoUrl2, {}, 35000);
          setCached(countryAdm2Key, gj2, 30 * 60 * 1000);
        }

        const filtered = (gj2.features || []).filter((f: any) => {
          if (!stateBbox || !stateGeom) return true;
          const fBbox = computeBbox(f.geometry);
          const center = getBboxCenter(fBbox);
          if (!pointInBbox(center, stateBbox, 0.02)) return false;
          return pointInGeometry(center, stateGeom);
        });

        const features = filtered.map((f: any, idx: number) => {
          const mName =
            f.properties?.shapeName ||
            f.properties?.NAME_2 ||
            f.properties?.name ||
            `Município ${idx + 1}`;
          const id = String(f.properties?.shapeID || `${stateId}-M-${idx}`);
          return {
            type: 'Feature',
            id,
            properties: {
              id,
              name: mName,
              bbox: computeBbox(f.geometry),
            },
            geometry: f.geometry,
          };
        });

        if (features.length > 0) {
          const result = { type: 'FeatureCollection', features };
          setCached(cacheKey, result);
          return res.json(result);
        }
      }
    }

    res.status(404).json({ error: 'Municípios não encontrados para este estado' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao carregar municípios reais' });
  }
});

// 5. Get real Street Routes inside a selected Municipality via Overpass API
app.get('/api/geo/streets', async (req, res) => {
  const bboxParam = String(req.query.bbox || '').trim();
  const muniName = String(req.query.name || '').trim();
  if (!bboxParam) {
    return res.status(400).json({ error: 'BBox obrigatório' });
  }

  const parts = bboxParam.split(',').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return res.status(400).json({ error: 'BBox inválido' });
  }

  let [minLon, minLat, maxLon, maxLat] = parts;
  // Cap bbox size around center if municipality is huge (e.g. Amazonian municipalities) so Overpass stays fast
  const MAX_SPAN = 0.28;
  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const spanLon = maxLon - minLon;
  const spanLat = maxLat - minLat;

  let queryFilter = 'way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified"]';
  if (spanLon > MAX_SPAN || spanLat > MAX_SPAN) {
    // For huge territories, fetch major & secondary arteries across full bbox + local streets around urban center
    const cSpan = 0.08;
    minLon = Math.max(minLon, centerLon - cSpan);
    maxLon = Math.min(maxLon, centerLon + cSpan);
    minLat = Math.max(minLat, centerLat - cSpan);
    maxLat = Math.min(maxLat, centerLat + cSpan);
    queryFilter = 'way["highway"~"motorway|trunk|primary|secondary|tertiary|residential"]';
  }

  const cacheKey = `streets:${minLon.toFixed(3)},${minLat.toFixed(3)},${maxLon.toFixed(3)},${maxLat.toFixed(3)}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return res.json(cached);

  try {
    const overpassQuery = `[out:json][timeout:15];(${queryFilter}(${minLat},${minLon},${maxLat},${maxLon}););out geom 650;`;
    const data = await fetchJsonWithTimeout(
      'https://overpass-api.de/api/interpreter',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      },
      18000
    );

    const features = (data.elements || [])
      .filter((el: any) => el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 2)
      .map((el: any) => ({
        type: 'Feature',
        id: String(el.id),
        properties: {
          name: el.tags?.name || el.tags?.ref || 'Via sem nome',
          highway: el.tags?.highway || 'residential',
        },
        geometry: {
          type: 'LineString',
          coordinates: el.geometry.map((pt: { lon: number; lat: number }) => [pt.lon, pt.lat]),
        },
      }));

    const result = {
      type: 'FeatureCollection',
      features,
      meta: { muniName, count: features.length },
    };
    setCached(cacheKey, result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao buscar rotas de ruas reais' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PrismaDados server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
