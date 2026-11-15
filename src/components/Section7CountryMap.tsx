import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Layers,
  MapPin,
  Route,
  Eye,
  Paintbrush,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronRight,
  Loader2,
  Eraser,
  X,
  Globe2,
} from 'lucide-react';
import {
  WORLD_COUNTRIES,
  CONTINENT_ORDER,
  CONTINENT_VIEWS,
  CountryCatalogItem,
  ContinentName,
} from '../data/countries';
import {
  buildDissolvedManchas,
  buildUnifiedTerritoryOutline,
  GeoFeature,
} from '../utils/geoManchas';
import { computeViewportTransform, featureToSvgPath } from '../utils/geoProject2D';
import { mixHex } from '../utils/colorRamp';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ChartToolbar } from './ChartToolbar';
import {
  buildLottieAnimation,
  downloadJsonFile,
  downloadSvgElementAsPng,
  downloadSvgElementAsSvg,
  LottiePathSpec,
} from '../utils/exportStudio';

type MapLevel = 'continent' | 'country' | 'states' | 'municipalities' | 'streets';

const BRUSH_COLORS = [
  { name: 'Azul', hex: '#2563EB' },
  { name: 'Vermelho', hex: '#DC2626' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Âmbar', hex: '#D97706' },
  { name: 'Roxo', hex: '#7C3AED' },
  { name: 'Turquesa', hex: '#0D9488' },
  { name: 'Rosa', hex: '#DB2777' },
];

const QUICK_COUNTRIES = ['Brasil', 'Estados Unidos', 'Portugal', 'França', 'Japão', 'Islândia', 'Madagascar'];

function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const Section7CountryMap: React.FC = () => {
  const { containerRef, animKey, replay, revealNow } = useScrollReveal(0.01);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  // Scope mode: Países e Ilhas vs Continentes
  const [scopeMode, setScopeMode] = useState<'countries' | 'continents'>('countries');
  const [activeContinentId, setActiveContinentId] = useState<string>('americasul');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CountryCatalogItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownContinentFilter, setDropdownContinentFilter] = useState<ContinentName | 'Todos'>('Todos');

  // Selected Continent / Country / State / Municipality hierarchy
  const [selectedCountry, setSelectedCountry] = useState<CountryCatalogItem>(
    WORLD_COUNTRIES.find((c) => c.iso2 === 'BR') || WORLD_COUNTRIES[0]
  );
  const [level, setLevel] = useState<MapLevel>('country');

  const [continentFeatures, setContinentFeatures] = useState<GeoFeature[]>([]);
  const [countryFeatures, setCountryFeatures] = useState<GeoFeature[]>([]);
  const [stateFeatures, setStateFeatures] = useState<GeoFeature[]>([]);
  const [muniFeatures, setMuniFeatures] = useState<GeoFeature[]>([]);
  const [streetFeatures, setStreetFeatures] = useState<GeoFeature[]>([]);

  const [selectedContinentCountry, setSelectedContinentCountry] = useState<GeoFeature | null>(null);
  const [selectedState, setSelectedState] = useState<GeoFeature | null>(null);
  const [selectedMuni, setSelectedMuni] = useState<GeoFeature | null>(null);

  // Loading & Error
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Painting & Visual "Manchas" mode (with persistent cross-level stores)
  const [toolMode, setToolMode] = useState<'select' | 'paint'>('paint');
  const [activeBrushColor, setActiveBrushColor] = useState<string>('#2563EB');
  const [continentColorsByCont, setContinentColorsByCont] = useState<Record<string, Record<string, string>>>({});
  const [stateColorsByCountry, setStateColorsByCountry] = useState<
    Record<string, { countryIso3: string; features: GeoFeature[]; colors: Record<string, string> }>
  >({});
  const [muniColorsByState, setMuniColorsByState] = useState<
    Record<string, { countryIso3: string; stateId: string; stateName: string; features: GeoFeature[]; colors: Record<string, string> }>
  >({});
  const [continentColors, setContinentColors] = useState<Record<string, string>>({});
  const [stateColors, setStateColors] = useState<Record<string, string>>({});
  const [muniColors, setMuniColors] = useState<Record<string, string>>({});
  const [visualManchasMode, setVisualManchasMode] = useState(false);
  const [filterList, setFilterList] = useState('');
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  // Pan & Zoom inside 2D viewport
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; didDrag: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    didDrag: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const W = 760;
  const H = 520;

  // Close search dropdown cleanly on outside click or Escape key
  useEffect(() => {
    const handleDocMouseDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleDocMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const beginRequest = () => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const seq = ++requestSeqRef.current;
    return { signal: ctrl.signal, seq };
  };

  const countryStoreKey = selectedCountry.iso3 || selectedCountry.iso2 || selectedCountry.namePt;
  const getStateStoreKey = (feat: GeoFeature, cKey = countryStoreKey) =>
    `${cKey}::${String(feat.properties?.id || feat.id || feat.properties?.name || '')}`;

  // Load real Continent view
  const loadContinent = async (continentId: string) => {
    const { signal, seq } = beginRequest();
    setScopeMode('continents');
    setActiveContinentId(continentId);
    setLevel('continent');
    setSelectedContinentCountry(null);
    setSelectedState(null);
    setSelectedMuni(null);
    setContinentColors(continentColorsByCont[continentId] || {});
    setVisualManchasMode(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setLoading(true);
    setErrorMsg(null);
    revealNow();

    try {
      const res = await fetch(`/api/geo/continent?id=${encodeURIComponent(continentId)}`, { signal });
      if (!res.ok) throw new Error('Erro ao carregar continente');
      const data = await res.json();
      if (seq !== requestSeqRef.current) return;
      setContinentFeatures(data.features || []);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (seq === requestSeqRef.current) {
        setErrorMsg(e?.message || 'Erro ao carregar continente');
      }
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  };

  // Load real Country geometry reliably (with automatic 1x retry + race-condition protection)
  const loadCountry = async (country: CountryCatalogItem & { osmType?: string; osmId?: string }) => {
    const { signal, seq } = beginRequest();
    const nextCountryKey = country.iso3 || country.iso2 || country.namePt;
    setScopeMode('countries');
    setLoading(true);
    setErrorMsg(null);
    setSelectedCountry(country);
    setLevel('country');
    setSelectedState(null);
    setSelectedMuni(null);
    setStateFeatures(stateColorsByCountry[nextCountryKey]?.features || []);
    setMuniFeatures([]);
    setStreetFeatures([]);
    setStateColors(stateColorsByCountry[nextCountryKey]?.colors || {});
    setMuniColors({});
    setVisualManchasMode(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setShowDropdown(false);
    revealNow();

    const params = new URLSearchParams({
      numericId: country.numericId || '',
      iso2: country.iso2 || '',
      iso3: country.iso3 || '',
      name: country.nameEn || country.namePt,
      osmType: country.osmType || '',
      osmId: country.osmId || '',
    });

    const attemptFetch = async () => {
      const res = await fetch(`/api/geo/country?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Território "${country.namePt}" não encontrado`);
      return res.json();
    };

    try {
      let data;
      try {
        data = await attemptFetch();
      } catch (firstErr: any) {
        if (firstErr?.name === 'AbortError') throw firstErr;
        data = await attemptFetch();
      }
      if (seq !== requestSeqRef.current) return;
      setCountryFeatures(data.features || []);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (seq === requestSeqRef.current) {
        setErrorMsg(e?.message || 'Erro ao carregar território real');
      }
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const br = WORLD_COUNTRIES.find((c) => c.iso2 === 'BR') || WORLD_COUNTRIES[0];
    loadCountry(br);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live search across ALL countries + Nominatim fallback
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const nq = normalizeSearch(q);
    const localHits = WORLD_COUNTRIES.filter(
      (c) =>
        normalizeSearch(c.namePt).includes(nq) ||
        normalizeSearch(c.nameEn).includes(nq) ||
        c.iso2.toLowerCase() === nq ||
        c.iso3.toLowerCase() === nq
    );
    setSearchResults(localHits.slice(0, 20));

    if (localHits.length >= 3) {
      setSearching(false);
      return;
    }

    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || localHits);
        }
      } catch {
        // Keep local hits
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Organized Continent -> Letter A-Z catalog for empty search dropdown
  const groupedCatalog = useMemo(() => {
    const continentsToShow =
      dropdownContinentFilter === 'Todos' ? CONTINENT_ORDER : [dropdownContinentFilter];

    return continentsToShow.map((cont) => {
      const countries = WORLD_COUNTRIES.filter((c) => c.continent === cont).sort((a, b) =>
        a.namePt.localeCompare(b.namePt, 'pt-BR')
      );

      const byLetter = new Map<string, CountryCatalogItem[]>();
      for (const c of countries) {
        const letter = c.namePt
          .charAt(0)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();
        const arr = byLetter.get(letter) || [];
        arr.push(c);
        byLetter.set(letter, arr);
      }

      const letters = Array.from(byLetter.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      return { continent: cont, letters };
    });
  }, [dropdownContinentFilter]);

  // Load real states for selected country
  const handleViewStates = async () => {
    const { signal, seq } = beginRequest();
    setLoading(true);
    setErrorMsg(null);
    setVisualManchasMode(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    revealNow();

    if (stateFeatures.length > 0) {
      setLevel('states');
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        iso2: selectedCountry.iso2 || '',
        iso3: selectedCountry.iso3 || '',
        name: selectedCountry.nameEn || selectedCountry.namePt,
      });
      const res = await fetch(`/api/geo/states?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Estados não disponíveis para ${selectedCountry.namePt}`);
      const data = await res.json();
      if (seq !== requestSeqRef.current) return;
      setStateFeatures(data.features || []);
      setLevel('states');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (seq === requestSeqRef.current) {
        setErrorMsg(e?.message || 'Estados indisponíveis para este território');
      }
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  };

  // Load real municipalities for selected state
  const handleViewMunicipalities = async (stateFeat: GeoFeature) => {
    const { signal, seq } = beginRequest();
    const sKey = getStateStoreKey(stateFeat);
    const savedState = muniColorsByState[sKey];
    setSelectedState(stateFeat);
    setSelectedMuni(null);
    setStreetFeatures([]);
    setMuniColors(savedState?.colors || {});
    setVisualManchasMode(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setErrorMsg(null);
    revealNow();

    if (savedState && savedState.features.length > 0) {
      setMuniFeatures(savedState.features);
      setLevel('municipalities');
      return;
    }

    setLoading(true);
    try {
      const sid = String(stateFeat.properties?.id || stateFeat.id || '');
      const sname = String(stateFeat.properties?.name || '');
      const params = new URLSearchParams({
        iso2: selectedCountry.iso2 || '',
        iso3: selectedCountry.iso3 || '',
        stateId: sid,
        stateName: sname,
      });
      const res = await fetch(`/api/geo/municipalities?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Municípios não encontrados para ${sname}`);
      const data = await res.json();
      if (seq !== requestSeqRef.current) return;
      setMuniFeatures(data.features || []);
      setLevel('municipalities');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (seq === requestSeqRef.current) {
        setErrorMsg(e?.message || 'Erro ao carregar municípios reais');
      }
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  };

  // Load real street routes for selected municipality
  const handleViewStreets = async (muniFeat: GeoFeature) => {
    const { signal, seq } = beginRequest();
    setSelectedMuni(muniFeat);
    setVisualManchasMode(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setLoading(true);
    setErrorMsg(null);
    revealNow();

    try {
      const bbox = muniFeat.properties?.bbox;
      if (!bbox) throw new Error('Limites do município não encontrados');
      const params = new URLSearchParams({
        bbox: bbox.join(','),
        name: muniFeat.properties?.name || '',
      });
      const res = await fetch(`/api/geo/streets?${params.toString()}`, { signal });
      if (!res.ok) throw new Error('Não foi possível obter as rotas de ruas para este município');
      const data = await res.json();
      if (seq !== requestSeqRef.current) return;
      setStreetFeatures(data.features || []);
      setLevel('streets');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (seq === requestSeqRef.current) {
        setErrorMsg(e?.message || 'Erro ao carregar rotas das ruas');
      }
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  };

  // Determine active features for 2D planar Mercator fitting
  const activeFeatures = useMemo(() => {
    if (level === 'continent' && continentFeatures.length > 0) return continentFeatures;
    if (level === 'states' && stateFeatures.length > 0) return stateFeatures;
    if (level === 'municipalities' && muniFeatures.length > 0) return muniFeatures;
    if (level === 'streets' && selectedMuni) return [selectedMuni];
    return countryFeatures;
  }, [level, continentFeatures, countryFeatures, stateFeatures, muniFeatures, selectedMuni]);

  const viewportTransform = useMemo(() => {
    return computeViewportTransform(activeFeatures, W, H, 28);
  }, [activeFeatures]);

  // Unified outer boundary silhouette for Manchas mode (never cancels shared internal borders!)
  const unifiedOutlineFeature = useMemo(() => {
    if (!visualManchasMode) return null;
    if (level === 'continent') return buildUnifiedTerritoryOutline(continentFeatures);
    if (level === 'states') return buildUnifiedTerritoryOutline(stateFeatures);
    if (level === 'municipalities') return buildUnifiedTerritoryOutline(muniFeatures);
    return null;
  }, [visualManchasMode, level, continentFeatures, stateFeatures, muniFeatures]);

  const parentBoundaryPath = useMemo(() => {
    if (!unifiedOutlineFeature) return '';
    return featureToSvgPath(unifiedOutlineFeature, viewportTransform);
  }, [unifiedOutlineFeature, viewportTransform]);

  // Parent state color (e.g., Mato Grosso do Sul painted Blue before clicking into its municipalities)
  const parentStateColor = useMemo(() => {
    if (level !== 'municipalities' || !selectedState) return undefined;
    const sid = String(selectedState.properties?.id || selectedState.id || selectedState.properties?.name || '');
    return stateColors[sid];
  }, [level, selectedState, stateColors]);

  // Compute dissolved "Manchas" for the active level
  const dissolvedManchas = useMemo(() => {
    if (!visualManchasMode) return [];
    if (level === 'continent') return buildDissolvedManchas(continentFeatures, continentColors);
    if (level === 'states') return buildDissolvedManchas(stateFeatures, stateColors);
    if (level === 'municipalities') return buildDissolvedManchas(muniFeatures, muniColors);
    return [];
  }, [
    visualManchasMode,
    level,
    continentFeatures,
    continentColors,
    stateFeatures,
    stateColors,
    muniFeatures,
    muniColors,
  ]);

  // Nested sub-territory manchas:
  // - In "states" view: dissolved municipality manchas saved inside each state (e.g. Green spots inside Blue MS)
  // - In "continent" view: dissolved state & municipality manchas saved inside countries of that continent
  const nestedSubManchas = useMemo(() => {
    if (level === 'states') {
      const items: Array<{ color: string; feature: GeoFeature; count: number; paintedFeatures: GeoFeature[] }> = [];
      for (const entry of Object.values(muniColorsByState)) {
        if (entry.countryIso3 !== countryStoreKey) continue;
        if (Object.keys(entry.colors).length === 0) continue;
        const manchas = buildDissolvedManchas(entry.features, entry.colors);
        const paintedFeats = entry.features.filter((f) => {
          const fid = String(f.properties?.id || f.id || f.properties?.name || '');
          return Boolean(entry.colors[fid]);
        });
        for (const m of manchas) {
          items.push({ ...m, paintedFeatures: paintedFeats });
        }
      }
      return items;
    }

    if (level === 'continent') {
      const items: Array<{ color: string; feature: GeoFeature; count: number; paintedFeatures: GeoFeature[] }> = [];
      const visibleIso3 = new Set(
        continentFeatures.map((f) => String(f.properties?.iso3 || '')).filter(Boolean)
      );
      for (const stEntry of Object.values(stateColorsByCountry)) {
        if (!visibleIso3.has(stEntry.countryIso3)) continue;
        if (Object.keys(stEntry.colors).length === 0) continue;
        const manchas = buildDissolvedManchas(stEntry.features, stEntry.colors);
        const paintedFeats = stEntry.features.filter((f) => {
          const fid = String(f.properties?.id || f.id || f.properties?.name || '');
          return Boolean(stEntry.colors[fid]);
        });
        for (const m of manchas) items.push({ ...m, paintedFeatures: paintedFeats });
      }
      for (const mEntry of Object.values(muniColorsByState)) {
        if (!visibleIso3.has(mEntry.countryIso3)) continue;
        if (Object.keys(mEntry.colors).length === 0) continue;
        const manchas = buildDissolvedManchas(mEntry.features, mEntry.colors);
        const paintedFeats = mEntry.features.filter((f) => {
          const fid = String(f.properties?.id || f.id || f.properties?.name || '');
          return Boolean(mEntry.colors[fid]);
        });
        for (const m of manchas) items.push({ ...m, paintedFeatures: paintedFeats });
      }
      return items;
    }

    return [];
  }, [level, countryStoreKey, continentFeatures, stateColorsByCountry, muniColorsByState]);

  const handleFeatureClick = (feat: GeoFeature) => {
    if (dragRef.current.didDrag) return;
    const fid = String(feat.properties?.id || feat.id || feat.properties?.name || '');

    if (level === 'continent') {
      setSelectedContinentCountry(feat);
      if (toolMode === 'paint') {
        setContinentColors((prev) => {
          const next = { ...prev };
          if (next[fid] === activeBrushColor) delete next[fid];
          else next[fid] = activeBrushColor;
          setContinentColorsByCont((store) => ({ ...store, [activeContinentId]: next }));
          return next;
        });
      }
    } else if (level === 'states') {
      setSelectedState(feat);
      if (toolMode === 'paint') {
        setStateColors((prev) => {
          const next = { ...prev };
          if (next[fid] === activeBrushColor) delete next[fid];
          else next[fid] = activeBrushColor;
          setStateColorsByCountry((store) => ({
            ...store,
            [countryStoreKey]: {
              countryIso3: countryStoreKey,
              features: stateFeatures,
              colors: next,
            },
          }));
          return next;
        });
      }
    } else if (level === 'municipalities') {
      setSelectedMuni(feat);
      if (toolMode === 'paint') {
        setMuniColors((prev) => {
          const next = { ...prev };
          if (next[fid] === activeBrushColor) delete next[fid];
          else next[fid] = activeBrushColor;
          if (selectedState) {
            const sKey = getStateStoreKey(selectedState);
            setMuniColorsByState((store) => ({
              ...store,
              [sKey]: {
                countryIso3: countryStoreKey,
                stateId: String(selectedState.properties?.id || selectedState.id || ''),
                stateName: String(selectedState.properties?.name || ''),
                features: muniFeatures,
                colors: next,
              },
            }));
          }
          return next;
        });
      }
    }
  };

  const handleOpenContinentCountry = (feat: GeoFeature) => {
    const iso2 = String(feat.properties?.iso2 || '');
    const iso3 = String(feat.properties?.iso3 || '');
    const namePt = String(feat.properties?.name || '');
    const found =
      WORLD_COUNTRIES.find((c) => (iso3 && c.iso3 === iso3) || c.namePt === namePt) || {
        namePt,
        nameEn: String(feat.properties?.nameEn || namePt),
        iso2,
        iso3,
        numericId: String(feat.properties?.numericId || ''),
        continent: 'América do Sul' as const,
      };
    setSearchQuery(found.namePt);
    loadCountry(found);
  };

  const handleClearColors = () => {
    if (level === 'continent') {
      setContinentColors({});
      setContinentColorsByCont((store) => {
        const next = { ...store };
        delete next[activeContinentId];
        return next;
      });
    } else if (level === 'states') {
      setStateColors({});
      setStateColorsByCountry((store) => {
        const next = { ...store };
        delete next[countryStoreKey];
        return next;
      });
      setMuniColorsByState((store) => {
        const next: typeof store = {};
        for (const [k, v] of Object.entries(store)) {
          if (v.countryIso3 !== countryStoreKey) next[k] = v;
        }
        return next;
      });
    } else if (level === 'municipalities') {
      setMuniColors({});
      if (selectedState) {
        const sKey = getStateStoreKey(selectedState);
        setMuniColorsByState((store) => {
          const next = { ...store };
          delete next[sKey];
          return next;
        });
      }
    }
    setVisualManchasMode(false);
  };

  // Pan handlers with 4px click threshold so clicking small municipalities never jitters
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      active: true,
      didDrag: false,
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
    };
  };
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > 4) {
      dragRef.current.didDrag = true;
      setPan({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    }
  };
  const handleMouseUp = () => {
    dragRef.current.active = false;
    setTimeout(() => {
      dragRef.current.didDrag = false;
    }, 0);
  };

  const sidebarList = useMemo(() => {
    const q = filterList.trim().toLowerCase();
    const source =
      level === 'continent'
        ? continentFeatures
        : level === 'states'
        ? stateFeatures
        : level === 'municipalities'
        ? muniFeatures
        : [];
    if (!q) return source;
    return source.filter((f) => String(f.properties?.name || '').toLowerCase().includes(q));
  }, [level, continentFeatures, stateFeatures, muniFeatures, filterList]);

  const activeColorMap =
    level === 'continent'
      ? continentColors
      : level === 'states'
      ? stateColors
      : level === 'municipalities'
      ? muniColors
      : {};
  const currentPaintedCount = Object.keys(activeColorMap).length;
  const hasAnyManchasData =
    currentPaintedCount > 0 || nestedSubManchas.length > 0 || Boolean(parentStateColor);
  const activeContinentMeta = CONTINENT_VIEWS.find((c) => c.id === activeContinentId) || CONTINENT_VIEWS[0];

  const handleExportLottie = () => {
    const paths: LottiePathSpec[] = [];

    if (level === 'country') {
      countryFeatures.forEach((f, idx) => {
        const d = featureToSvgPath(f, viewportTransform);
        if (d) {
          paths.push({
            name: f.properties?.name || `Território ${idx + 1}`,
            d,
            fillColor: '#E2E8F0',
            strokeColor: '#334155',
            strokeWidth: 1.5,
            delayFrames: idx * 5,
            durationFrames: 40,
          });
        }
      });
    } else if (level === 'continent' || level === 'states' || level === 'municipalities') {
      const source =
        level === 'continent'
          ? continentFeatures
          : level === 'states'
          ? stateFeatures
          : muniFeatures;

      if (visualManchasMode && (dissolvedManchas.length > 0 || nestedSubManchas.length > 0 || parentStateColor)) {
        if (parentBoundaryPath) {
          paths.push({
            name: 'Base Territorial',
            d: parentBoundaryPath,
            fillColor: parentStateColor ? mixHex('#FFFFFF', parentStateColor, 0.44) : '#F8FAFC',
            strokeColor: '#0F172A',
            strokeWidth: 1.5,
            delayFrames: 0,
            durationFrames: 20,
          });
        }
        dissolvedManchas.forEach((m, idx) => {
          const d = featureToSvgPath(m.feature, viewportTransform);
          if (d) {
            paths.push({
              name: `Mancha ${m.color}`,
              d,
              fillColor: mixHex('#FFFFFF', m.color, 0.46),
              fillOpacity: 0.94,
              strokeColor: mixHex(m.color, '#0F172A', 0.42),
              strokeWidth: 1.8,
              delayFrames: 10 + idx * 6,
              durationFrames: 30,
            });
          }
        });
        nestedSubManchas.forEach((sub, idx) => {
          const d = featureToSvgPath(sub.feature, viewportTransform);
          if (d) {
            paths.push({
              name: `Sub-mancha ${sub.color}`,
              d,
              fillColor: mixHex('#FFFFFF', sub.color, 0.52),
              fillOpacity: 0.95,
              strokeColor: mixHex(sub.color, '#0F172A', 0.45),
              strokeWidth: 1.4,
              delayFrames: 20 + idx * 5,
              durationFrames: 28,
            });
          }
        });
        source.slice(0, 320).forEach((f, idx) => {
          const d = featureToSvgPath(f, viewportTransform);
          if (d) {
            paths.push({
              name: `Divisão ${f.properties?.name || idx + 1}`,
              d,
              strokeColor: '#0F172A',
              strokeWidth: level === 'municipalities' ? 0.65 : 1.35,
              delayFrames: 28,
              durationFrames: 20,
            });
          }
        });
      } else {
        source.slice(0, 320).forEach((f, idx) => {
          const fid = String(f.properties?.id || f.id || f.properties?.name || '');
          const d = featureToSvgPath(f, viewportTransform);
          if (d) {
            paths.push({
              name: f.properties?.name || `Região ${idx + 1}`,
              d,
              fillColor: activeColorMap[fid] || '#F1F5F9',
              strokeColor: '#475569',
              strokeWidth: level === 'municipalities' ? 0.6 : 1,
              delayFrames: Math.round((idx / Math.max(1, source.length)) * 35),
              durationFrames: 25,
            });
          }
        });
      }
    } else if (level === 'streets') {
      if (selectedMuni) {
        const d = featureToSvgPath(selectedMuni, viewportTransform);
        if (d) {
          paths.push({
            name: selectedMuni.properties?.name || 'Município',
            d,
            fillColor: '#F8FAFC',
            strokeColor: '#0F172A',
            strokeWidth: 1.5,
            delayFrames: 0,
            durationFrames: 25,
          });
        }
      }
      streetFeatures.slice(0, 300).forEach((st, idx) => {
        const d = featureToSvgPath(st, viewportTransform);
        if (d) {
          const hw = String(st.properties?.highway || '');
          const isMajor = ['motorway', 'trunk', 'primary'].includes(hw);
          paths.push({
            name: st.properties?.name || `Rua ${idx + 1}`,
            d,
            strokeColor: isMajor ? '#2563EB' : '#64748B',
            strokeWidth: isMajor ? 2.2 : 0.9,
            delayFrames: Math.round((idx / Math.max(1, streetFeatures.length)) * 45),
            durationFrames: 30,
            animateTrim: true,
          });
        }
      });
    }

    const titleSuffix =
      level === 'continent' ? activeContinentMeta.name : selectedCountry.namePt;
    const lottie = buildLottieAnimation({
      title: `Mapa 2D - ${titleSuffix}`,
      width: W,
      height: H,
      paths,
      durationFrames: 120,
    });
    downloadJsonFile(lottie, `territorio-2d-${titleSuffix.toLowerCase()}.json`);
  };

  const handleExportPng = () => {
    const label = level === 'continent' ? activeContinentMeta.name : selectedCountry.namePt;
    if (svgRef.current) {
      downloadSvgElementAsPng(svgRef.current, `territorio-2d-${label.toLowerCase()}.png`);
    }
  };

  const handleExportSvg = () => {
    const label = level === 'continent' ? activeContinentMeta.name : selectedCountry.namePt;
    if (svgRef.current) {
      downloadSvgElementAsSvg(svgRef.current, `territorio-2d-${label.toLowerCase()}.svg`);
    }
  };

  const isPaintableLevel = level === 'continent' || level === 'states' || level === 'municipalities';

  return (
    <section
      id="territorios"
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <span>Seção 08</span>
            <span aria-hidden="true">·</span>
            <span>Cartografia Real em 2D</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Mapa 2D de Continentes, Países, Estados, Municípios e Manchas
          </h2>
          <p className="text-sm text-slate-600 max-w-3xl">
            Explore <strong>Continentes</strong> completos ou pesquise qualquer <strong>País ou Ilha</strong> do mundo. Pinte países, estados e municípios de cores diferentes e ative <strong>Ver Visualmente (Manchas)</strong> para formar manchas combinadas entre níveis (ex: municípios verdes dentro de um estado azul), sempre mantendo as linhas de divisão dos territórios e fronteiras estaduais.
          </p>
        </div>

        {/* Scope Mode Toggle: Países vs Continentes */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start shrink-0">
          <button
            type="button"
            onClick={() => {
              setScopeMode('countries');
              if (level === 'continent') loadCountry(selectedCountry);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              scopeMode === 'countries'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Países e Ilhas
          </button>
          <button
            type="button"
            onClick={() => loadContinent(activeContinentId)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              scopeMode === 'continents'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>Continentes</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Country Search (grouped by Continent + Letter A-Z when empty) & Quick Chips */}
      {scopeMode === 'countries' ? (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div ref={searchBoxRef} className="relative w-full md:w-[420px]">
            <div className="flex items-center border border-slate-300 rounded-lg bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowDropdown(true)}
                onClick={() => setShowDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                placeholder="Pesquisar qualquer país ou ilha do mundo..."
                className="w-full text-sm text-slate-900 focus:outline-none bg-transparent"
              />
              {searching && <Loader2 className="w-4 h-4 text-blue-600 animate-spin ml-2 shrink-0" />}
              {(searchQuery || showDropdown) && (
                <button
                  type="button"
                  onClick={() => {
                    if (searchQuery) {
                      setSearchQuery('');
                    } else {
                      setShowDropdown(false);
                    }
                  }}
                  className="ml-1.5 p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                  title={searchQuery ? 'Limpar busca' : 'Fechar lista'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {showDropdown && (
              <div className="absolute z-30 mt-1.5 w-full md:w-[540px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                {/* Header bar with close button */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs">
                  <span className="font-semibold text-slate-700">
                    {searchQuery.trim()
                      ? `Resultados para "${searchQuery.trim()}"`
                      : 'Todos os Países por Continente e Ordem Alfabética'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDropdown(false)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Fechar</span>
                  </button>
                </div>

                {/* When typing -> show filtered search results */}
                {searchQuery.trim() ? (
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {searchResults.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 text-center">
                        Nenhum país encontrado com esse termo.
                      </div>
                    ) : (
                      searchResults.map((c, idx) => (
                        <button
                          key={`${c.namePt}-${c.iso3}-${idx}`}
                          type="button"
                          onClick={() => {
                            setShowDropdown(false);
                            setSearchQuery(c.namePt);
                            loadCountry(c);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50/70 flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-semibold text-slate-900">{c.namePt}</span>
                          <span className="text-slate-500">{c.continent || c.region}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  /* When empty -> Continent filter pills + Continent -> Letter A, B, C sections */
                  <div>
                    <div className="flex flex-wrap gap-1 p-2 bg-slate-50/60 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => setDropdownContinentFilter('Todos')}
                        className={`px-2 py-1 text-[11px] font-medium rounded cursor-pointer ${
                          dropdownContinentFilter === 'Todos'
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Todos
                      </button>
                      {CONTINENT_ORDER.map((cont) => (
                        <button
                          key={cont}
                          type="button"
                          onClick={() => setDropdownContinentFilter(cont)}
                          className={`px-2 py-1 text-[11px] font-medium rounded cursor-pointer ${
                            dropdownContinentFilter === cont
                              ? 'bg-slate-900 text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {cont}
                        </button>
                      ))}
                    </div>

                    <div className="max-h-80 overflow-y-auto p-3 space-y-4">
                      {groupedCatalog.map((group) => (
                        <div key={group.continent} className="space-y-2">
                          <div className="sticky top-0 bg-white/95 backdrop-blur-sm py-1 border-b border-slate-200 text-xs font-bold text-slate-900">
                            {group.continent}
                          </div>
                          <div className="space-y-2 pl-1">
                            {group.letters.map(([letter, list]) => (
                              <div key={`${group.continent}-${letter}`} className="flex items-start gap-2.5">
                                <span className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-[11px] font-mono font-bold text-slate-700 shrink-0 mt-0.5">
                                  {letter}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {list.map((country) => (
                                    <button
                                      key={`${country.iso3}-${country.namePt}`}
                                      type="button"
                                      onClick={() => {
                                        setShowDropdown(false);
                                        setSearchQuery(country.namePt);
                                        loadCountry(country);
                                      }}
                                      className="px-2 py-1 text-xs text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-800 border border-slate-200/80 rounded transition-colors cursor-pointer"
                                    >
                                      {country.namePt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_COUNTRIES.map((qName) => {
              const item = WORLD_COUNTRIES.find((c) => c.namePt === qName);
              if (!item) return null;
              const isActive = scopeMode === 'countries' && selectedCountry.namePt === item.namePt;
              return (
                <button
                  key={qName}
                  type="button"
                  onClick={() => {
                    setSearchQuery(item.namePt);
                    loadCountry(item);
                  }}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {qName}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Mode 2: Continents Chips */
        <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-slate-100">
          {CONTINENT_VIEWS.map((cv) => (
            <button
              key={cv.id}
              type="button"
              onClick={() => loadContinent(cv.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeContinentId === cv.id && level === 'continent'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title={cv.description}
            >
              {cv.name}
            </button>
          ))}
        </div>
      )}

      {/* Navigation Breadcrumb + Level Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 rounded-lg px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {level === 'continent' ? (
            <span className="font-semibold px-2 py-1 rounded bg-white text-slate-900 shadow-sm">
              {activeContinentMeta.name} ({continentFeatures.length} territórios)
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setLevel('country');
                  setVisualManchasMode(false);
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className={`font-semibold px-2 py-1 rounded transition-colors cursor-pointer ${
                  level === 'country' ? 'bg-white text-slate-900 shadow-sm' : 'text-blue-700 hover:underline'
                }`}
              >
                {selectedCountry.namePt}
              </button>

              {(level === 'states' || level === 'municipalities' || level === 'streets') && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => {
                      setLevel('states');
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    className={`font-semibold px-2 py-1 rounded transition-colors cursor-pointer ${
                      level === 'states' ? 'bg-white text-slate-900 shadow-sm' : 'text-blue-700 hover:underline'
                    }`}
                  >
                    Estados ({stateFeatures.length})
                  </button>
                </>
              )}

              {(level === 'municipalities' || level === 'streets') && selectedState && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => {
                      setLevel('municipalities');
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    className={`font-semibold px-2 py-1 rounded transition-colors cursor-pointer ${
                      level === 'municipalities' ? 'bg-white text-slate-900 shadow-sm' : 'text-blue-700 hover:underline'
                    }`}
                  >
                    {selectedState.properties.name} · Municípios ({muniFeatures.length})
                  </button>
                </>
              )}

              {level === 'streets' && selectedMuni && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold px-2 py-1 rounded bg-white text-slate-900 shadow-sm">
                    Rotas de {selectedMuni.properties.name} ({streetFeatures.length} vias)
                  </span>
                </>
              )}
            </>
          )}
        </div>

        {/* Contextual Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {level === 'continent' && selectedContinentCountry && (
            <button
              type="button"
              onClick={() => handleOpenContinentCountry(selectedContinentCountry)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Abrir País: {selectedContinentCountry.properties?.name}</span>
            </button>
          )}

          {level === 'country' && (
            <button
              type="button"
              onClick={handleViewStates}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Ver Estados</span>
            </button>
          )}

          {level === 'states' && selectedState && (
            <button
              type="button"
              onClick={() => handleViewMunicipalities(selectedState)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Ver Municípios de {selectedState.properties.name}</span>
            </button>
          )}

          {level === 'municipalities' && selectedMuni && (
            <button
              type="button"
              onClick={() => handleViewStreets(selectedMuni)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              <Route className="w-3.5 h-3.5" />
              <span>Ver Rotas da Rua ({selectedMuni.properties.name})</span>
            </button>
          )}

          {isPaintableLevel && (
            <button
              type="button"
              onClick={() => setVisualManchasMode((v) => !v)}
              disabled={!hasAnyManchasData && !visualManchasMode}
              title={
                !hasAnyManchasData
                  ? 'Pinte alguns territórios antes de ativar as manchas'
                  : 'Exibir manchas por cor mantendo todas as divisões de estados e territórios'
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-40 ${
                visualManchasMode
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{visualManchasMode ? 'Voltar às Divisões' : 'Ver Visualmente (Manchas)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split: 2D Map Canvas + Paint & Territory Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 relative bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
          {/* Top-left Zoom & Reset */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-md p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(8, z * 1.35))}
              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
              title="Aproximar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.7, z / 1.35))}
              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
              title="Afastar"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
              title="Centralizar mapa"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {hoveredName && (
            <div className="absolute top-3 right-3 z-10 bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-sm pointer-events-none">
              {hoveredName}
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 text-xs font-medium text-slate-700">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              <span>Carregando geometria real do território...</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 m-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
              {errorMsg}
            </div>
          )}

          <svg
            ref={svgRef}
            key={`${animKey}-${level}-${activeContinentId}-${selectedCountry.namePt}-${selectedState?.id || ''}-${selectedMuni?.id || ''}`}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-[460px] cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              handleMouseUp();
              setHoveredName(null);
            }}
          >
            <defs>
              {parentBoundaryPath && (
                <clipPath id="territory-parent-clip" clipRule="nonzero">
                  <path d={parentBoundaryPath} fillRule="nonzero" />
                </clipPath>
              )}
              {dissolvedManchas.map((mancha, idx) => {
                const md = featureToSvgPath(mancha.feature, viewportTransform);
                if (!md) return null;
                return (
                  <clipPath key={`mc-${idx}`} id={`mancha-clip-${idx}`} clipRule="nonzero">
                    <path d={md} fillRule="nonzero" />
                  </clipPath>
                );
              })}
              {nestedSubManchas.map((sub, idx) => {
                const sd = featureToSvgPath(sub.feature, viewportTransform);
                if (!sd) return null;
                return (
                  <clipPath key={`smc-${idx}`} id={`submancha-clip-${idx}`} clipRule="nonzero">
                    <path d={sd} fillRule="nonzero" />
                  </clipPath>
                );
              })}
            </defs>

            <g transform={`translate(${pan.x}, ${pan.y}) translate(${W / 2}, ${H / 2}) scale(${zoom}) translate(${-W / 2}, ${-H / 2})`}>
              {/* LEVEL: COUNTRY */}
              {level === 'country' &&
                countryFeatures.map((f, idx) => {
                  const d = featureToSvgPath(f, viewportTransform);
                  return (
                    <path
                      key={idx}
                      d={d}
                      fillRule="evenodd"
                      fill="#E2E8F0"
                      stroke="#334155"
                      strokeWidth={1.4 / zoom}
                      className="transition-colors duration-200 hover:fill-blue-100 cursor-pointer"
                      onMouseEnter={() => setHoveredName(selectedCountry.namePt)}
                      onClick={handleViewStates}
                    />
                  );
                })}

              {/* LEVEL: CONTINENT / STATES / MUNICIPALITIES (Normal Divisions + Sub-Territory Preview) */}
              {isPaintableLevel && !visualManchasMode && (
                <>
                  {(level === 'continent'
                    ? continentFeatures
                    : level === 'states'
                    ? stateFeatures
                    : muniFeatures
                  ).map((f, idx) => {
                    const fid = String(f.properties?.id || f.id || f.properties?.name || '');
                    const d = featureToSvgPath(f, viewportTransform);
                    const assignedColor =
                      activeColorMap[fid] ||
                      (level === 'municipalities' && parentStateColor
                        ? mixHex('#FFFFFF', parentStateColor, 0.35)
                        : undefined);
                    const isSelected =
                      (level === 'continent' && selectedContinentCountry?.properties?.id === f.properties?.id) ||
                      (level === 'states' && selectedState?.properties?.id === f.properties?.id) ||
                      (level === 'municipalities' && selectedMuni?.properties?.id === f.properties?.id);

                    return (
                      <path
                        key={fid || idx}
                        d={d}
                        fillRule="evenodd"
                        fill={assignedColor || '#F1F5F9'}
                        stroke={isSelected ? '#0F172A' : '#475569'}
                        strokeWidth={(isSelected ? 2 : 0.75) / zoom}
                        className="transition-colors duration-150 hover:opacity-85 cursor-pointer"
                        onMouseEnter={() => setHoveredName(f.properties?.name || '')}
                        onClick={() => handleFeatureClick(f)}
                        onDoubleClick={() => {
                          if (level === 'continent') handleOpenContinentCountry(f);
                          else if (level === 'states') handleViewMunicipalities(f);
                          else if (level === 'municipalities') handleViewStreets(f);
                        }}
                      />
                    );
                  })}

                  {/* Show already-painted sub-territory patches inside States / Continents even in normal view */}
                  {nestedSubManchas.map((sub, idx) => {
                    const sd = featureToSvgPath(sub.feature, viewportTransform);
                    if (!sd) return null;
                    return (
                      <path
                        key={`sub-preview-${idx}`}
                        d={sd}
                        fillRule="nonzero"
                        fill={sub.color}
                        fillOpacity={0.85}
                        stroke="#0F172A"
                        strokeWidth={0.5 / zoom}
                        pointerEvents="none"
                      />
                    );
                  })}

                  {/* Keep outer state/country borders sharp above sub-patches */}
                  {(level === 'states' || level === 'continent') &&
                    nestedSubManchas.length > 0 &&
                    (level === 'states' ? stateFeatures : continentFeatures).map((f, idx) => (
                      <path
                        key={`div-ov-${idx}`}
                        d={featureToSvgPath(f, viewportTransform)}
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth={1.15 / zoom}
                        pointerEvents="none"
                      />
                    ))}
                </>
              )}

              {/* VISUAL MANCHAS MODE: Tight organic watercolor manchas + nested sub-manchas + crisp dividing borders */}
              {isPaintableLevel && visualManchasMode && (
                <>
                  {/* Base territory silhouette (inherits parent state color if viewing municipalities of a painted state) */}
                  {parentBoundaryPath && (
                    <path
                      d={parentBoundaryPath}
                      fillRule="nonzero"
                      fill={
                        level === 'municipalities' && parentStateColor
                          ? mixHex('#FFFFFF', parentStateColor, 0.42)
                          : '#F8FAFC'
                      }
                      stroke="none"
                    />
                  )}

                  {/* If parent state has a color in municipalities view, add gentle coastal/frontier tint to base */}
                  {level === 'municipalities' && parentStateColor && parentBoundaryPath && (
                    <g clipPath="url(#territory-parent-clip)">
                      <path
                        d={parentBoundaryPath}
                        fill="none"
                        stroke={parentStateColor}
                        strokeWidth={10 / zoom}
                        strokeOpacity={0.25}
                        strokeLinejoin="round"
                      />
                      <path
                        d={parentBoundaryPath}
                        fill="none"
                        stroke={mixHex(parentStateColor, '#0F172A', 0.35)}
                        strokeWidth={3.2 / zoom}
                        strokeOpacity={0.55}
                        strokeLinejoin="round"
                      />
                    </g>
                  )}

                  {/* Clipped primary dissolved manchas (Countries, States, or Municipalities) */}
                  <g clipPath={parentBoundaryPath ? 'url(#territory-parent-clip)' : undefined}>
                    {dissolvedManchas.map((mancha, idx) => {
                      const d = featureToSvgPath(mancha.feature, viewportTransform);
                      if (!d) return null;
                      const lightInterior = mixHex('#FFFFFF', mancha.color, 0.44);
                      const midRim = mixHex('#FFFFFF', mancha.color, 0.78);
                      const crispEdge = mixHex(mancha.color, '#0F172A', 0.38);

                      return (
                        <g key={`${mancha.color}-${idx}`} clipPath={`url(#mancha-clip-${idx})`}>
                          <path
                            d={d}
                            fillRule="nonzero"
                            fill={lightInterior}
                            stroke="none"
                          />
                          <path
                            d={d}
                            fill="none"
                            stroke={midRim}
                            strokeWidth={10 / zoom}
                            strokeOpacity={0.34}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                          <path
                            d={d}
                            fill="none"
                            stroke={mancha.color}
                            strokeWidth={4.5 / zoom}
                            strokeOpacity={0.55}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                          <path
                            d={d}
                            fill="none"
                            stroke={crispEdge}
                            strokeWidth={1.8 / zoom}
                            strokeOpacity={0.85}
                            strokeLinejoin="round"
                          />
                        </g>
                      );
                    })}

                    {/* Nested Sub-Manchas (e.g. Green/Yellow municipality spots tightly packed inside Blue Mato Grosso do Sul!) */}
                    {nestedSubManchas.map((sub, idx) => {
                      const sd = featureToSvgPath(sub.feature, viewportTransform);
                      if (!sd) return null;
                      const subLight = mixHex('#FFFFFF', sub.color, 0.48);
                      const subEdge = mixHex(sub.color, '#0F172A', 0.42);

                      return (
                        <g key={`subm-${sub.color}-${idx}`} clipPath={`url(#submancha-clip-${idx})`}>
                          <path
                            d={sd}
                            fillRule="nonzero"
                            fill={subLight}
                            stroke="none"
                          />
                          <path
                            d={sd}
                            fill="none"
                            stroke={sub.color}
                            strokeWidth={6 / zoom}
                            strokeOpacity={0.42}
                            strokeLinejoin="round"
                          />
                          <path
                            d={sd}
                            fill="none"
                            stroke={subEdge}
                            strokeWidth={2 / zoom}
                            strokeOpacity={0.88}
                            strokeLinejoin="round"
                          />
                        </g>
                      );
                    })}
                  </g>

                  {/* Hairline dividing lines for painted sub-territories & municipalities so every spot stays cleanly divided */}
                  {level === 'municipalities' &&
                    muniFeatures.map((f, idx) => (
                      <path
                        key={`muni-div-${idx}`}
                        d={featureToSvgPath(f, viewportTransform)}
                        fill="transparent"
                        stroke="#1E293B"
                        strokeOpacity={0.42}
                        strokeWidth={0.65 / zoom}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredName(f.properties?.name || '')}
                        onClick={() => handleFeatureClick(f)}
                        onDoubleClick={() => handleViewStreets(f)}
                      />
                    ))}

                  {(level === 'states' || level === 'continent') &&
                    nestedSubManchas.flatMap((sub, sIdx) =>
                      sub.paintedFeatures.map((pf, pIdx) => (
                        <path
                          key={`sub-div-${sIdx}-${pIdx}`}
                          d={featureToSvgPath(pf, viewportTransform)}
                          fill="none"
                          stroke="#0F172A"
                          strokeOpacity={0.38}
                          strokeWidth={0.55 / zoom}
                          pointerEvents="none"
                        />
                      ))
                    )}

                  {/* Crisp dividing borders for EVERY State (in states view) or Country (in continent view) */}
                  {(level === 'states' || level === 'continent') &&
                    (level === 'states' ? stateFeatures : continentFeatures).map((f, idx) => (
                      <path
                        key={`border-div-${idx}`}
                        d={featureToSvgPath(f, viewportTransform)}
                        fill="transparent"
                        stroke="#0F172A"
                        strokeOpacity={0.88}
                        strokeWidth={(level === 'states' ? 1.45 : 1.35) / zoom}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredName(f.properties?.name || '')}
                        onClick={() => handleFeatureClick(f)}
                        onDoubleClick={() => {
                          if (level === 'continent') handleOpenContinentCountry(f);
                          else handleViewMunicipalities(f);
                        }}
                      />
                    ))}

                  {/* Strong outer frontier silhouette */}
                  {parentBoundaryPath && (
                    <path
                      d={parentBoundaryPath}
                      fillRule="nonzero"
                      fill="none"
                      stroke="#0F172A"
                      strokeWidth={1.85 / zoom}
                      pointerEvents="none"
                    />
                  )}
                </>
              )}

              {/* LEVEL: MUNICIPALITY STREET ROUTES */}
              {level === 'streets' && (
                <>
                  {selectedMuni && (
                    <path
                      d={featureToSvgPath(selectedMuni, viewportTransform)}
                      fillRule="evenodd"
                      fill="#F8FAFC"
                      stroke="#0F172A"
                      strokeWidth={1.5 / zoom}
                    />
                  )}
                  {streetFeatures.map((st, idx) => {
                    const d = featureToSvgPath(st, viewportTransform);
                    const hw = String(st.properties?.highway || 'residential');
                    const isMajor = ['motorway', 'trunk', 'primary'].includes(hw);
                    const isSecondary = ['secondary', 'tertiary'].includes(hw);
                    return (
                      <path
                        key={st.id || idx}
                        d={d}
                        fill="none"
                        stroke={isMajor ? '#2563EB' : isSecondary ? '#0D9488' : '#64748B'}
                        strokeWidth={(isMajor ? 2.2 : isSecondary ? 1.4 : 0.75) / zoom}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="cursor-pointer hover:stroke-rose-600"
                        onMouseEnter={() => setHoveredName(`${st.properties?.name} (${hw})`)}
                      />
                    );
                  })}
                </>
              )}
            </g>
          </svg>
        </div>

        {/* Right Side Control Panel: Paint Palette + Territory List */}
        <div className="lg:col-span-4 space-y-4">
          {isPaintableLevel && (
            <div className="p-4 border border-slate-200 rounded-lg bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">
                  Pintar{' '}
                  {level === 'continent'
                    ? 'Países'
                    : level === 'states'
                    ? 'Estados'
                    : 'Municípios'}
                </span>
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                  <button
                    type="button"
                    onClick={() => setToolMode('paint')}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded cursor-pointer ${
                      toolMode === 'paint' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    <Paintbrush className="w-3 h-3" />
                    <span>Pintar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolMode('select')}
                    className={`px-2 py-1 text-[11px] font-medium rounded cursor-pointer ${
                      toolMode === 'select' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Só Selecionar
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {BRUSH_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => {
                      setActiveBrushColor(c.hex);
                      setToolMode('paint');
                    }}
                    className={`w-7 h-7 rounded-md border-2 transition-transform cursor-pointer ${
                      activeBrushColor.toLowerCase() === c.hex.toLowerCase()
                        ? 'border-slate-900 scale-110'
                        : 'border-white ring-1 ring-slate-200'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
                <input
                  type="color"
                  value={activeBrushColor}
                  onChange={(e) => {
                    setActiveBrushColor(e.target.value);
                    setToolMode('paint');
                  }}
                  className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                  title="Outra cor"
                />
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>
                  <strong className="font-mono text-slate-800">{currentPaintedCount}</strong> pintados
                  {nestedSubManchas.length > 0 ? ` · ${nestedSubManchas.length} sub-manchas` : ''}
                  {visualManchasMode && dissolvedManchas.length > 0
                    ? ` · ${dissolvedManchas.length} manchas`
                    : ''}
                </span>
                {hasAnyManchasData && (
                  <button
                    type="button"
                    onClick={handleClearColors}
                    className="inline-flex items-center gap-1 text-rose-600 hover:underline cursor-pointer"
                  >
                    <Eraser className="w-3 h-3" />
                    <span>Limpar cores</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="p-4 border border-slate-200 rounded-lg bg-white space-y-3">
            {level === 'country' && (
              <div className="space-y-3 text-xs text-slate-600">
                <div className="font-semibold text-slate-900 text-sm">{selectedCountry.namePt}</div>
                <p>
                  Território real em 2D carregado. Clique diretamente no mapa ou no botão <strong>Ver Estados</strong> para abrir as divisões estaduais e começar a colorir ou explorar municípios.
                </p>
                <button
                  type="button"
                  onClick={handleViewStates}
                  className="w-full py-2 px-3 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer"
                >
                  Abrir Estados de {selectedCountry.namePt}
                </button>
              </div>
            )}

            {isPaintableLevel && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">
                    {level === 'continent'
                      ? `Países em ${activeContinentMeta.name}`
                      : level === 'states'
                      ? 'Lista de Estados'
                      : 'Lista de Municípios'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">{sidebarList.length}</span>
                </div>

                <input
                  type="text"
                  value={filterList}
                  onChange={(e) => setFilterList(e.target.value)}
                  placeholder={`Filtrar ${
                    level === 'continent' ? 'país' : level === 'states' ? 'estado' : 'município'
                  }...`}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-500"
                />

                <div className="max-h-[250px] overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-md">
                  {sidebarList.slice(0, 160).map((f, idx) => {
                    const fid = String(f.properties?.id || f.id || f.properties?.name || '');
                    const c = activeColorMap[fid];
                    const isSel =
                      (level === 'continent' && selectedContinentCountry?.properties?.id === f.properties?.id) ||
                      (level === 'states' && selectedState?.properties?.id === f.properties?.id) ||
                      (level === 'municipalities' && selectedMuni?.properties?.id === f.properties?.id);
                    return (
                      <div
                        key={fid || idx}
                        className={`flex items-center justify-between px-2.5 py-1.5 text-xs ${
                          isSel ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleFeatureClick(f)}
                          className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <span
                            className="w-3 h-3 rounded-sm border border-slate-300 shrink-0"
                            style={{ backgroundColor: c || '#F1F5F9' }}
                          />
                          <span className="truncate text-slate-800 font-medium">
                            {f.properties?.name}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (level === 'continent') handleOpenContinentCountry(f);
                            else if (level === 'states') handleViewMunicipalities(f);
                            else handleViewStreets(f);
                          }}
                          className="ml-2 text-[11px] font-medium text-blue-700 hover:underline shrink-0 cursor-pointer"
                        >
                          {level === 'continent'
                            ? 'Abrir País'
                            : level === 'states'
                            ? 'Municípios'
                            : 'Ruas'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {level === 'streets' && selectedMuni && (
              <div className="space-y-3 text-xs">
                <div className="font-semibold text-slate-900 text-sm">
                  Rotas de {selectedMuni.properties?.name}
                </div>
                <p className="text-slate-600">
                  Exibindo <strong className="font-mono text-slate-900">{streetFeatures.length}</strong> trechos de vias reais (rodovias, avenidas e ruas residenciais). Use os botões de zoom ou arraste o mapa para explorar os detalhes.
                </p>
                <div className="space-y-1.5 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-blue-600 inline-block" />
                    <span className="text-slate-700">Rodovias e Vias Principais</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-teal-600 inline-block" />
                    <span className="text-slate-700">Vias Secundárias e Coletoras</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-slate-500 inline-block" />
                    <span className="text-slate-700">Ruas Residenciais</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ChartToolbar
        onReplay={replay}
        onClear={hasAnyManchasData ? handleClearColors : undefined}
        onExportLottie={handleExportLottie}
        onExportPng={handleExportPng}
        onExportSvg={handleExportSvg}
      />
    </section>
  );
};
