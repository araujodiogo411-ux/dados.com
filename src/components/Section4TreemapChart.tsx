import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ChartToolbar } from './ChartToolbar';
import { getContrastTextColor, getMonochromeShade } from '../utils/colorRamp';
import {
  buildLottieAnimation,
  downloadJsonFile,
  downloadSvgElementAsPng,
  downloadSvgElementAsSvg,
  LottieRectSpec,
} from '../utils/exportStudio';

interface TreemapItem {
  id: string;
  name: string;
  metric: string;
  value: number;
}

const INITIAL_ITEMS: TreemapItem[] = [
  { id: 'tm-1', name: 'Europa', metric: 'Legado de infraestrutura', value: 88 },
  { id: 'tm-2', name: 'América', metric: 'Legado de infraestrutura', value: 73 },
  { id: 'tm-3', name: 'Ásia', metric: 'Legado de infraestrutura', value: 61 },
  { id: 'tm-4', name: 'África', metric: 'Legado de infraestrutura', value: 42 },
  { id: 'tm-5', name: 'Oceania', metric: 'Legado de infraestrutura', value: 29 },
];

const COLOR_PRESETS = [
  { name: 'Azul', hex: '#1D4ED8' },
  { name: 'Esmeralda', hex: '#047857' },
  { name: 'Índigo', hex: '#4338CA' },
  { name: 'Carmesim', hex: '#BE123C' },
  { name: 'Âmbar', hex: '#B45309' },
  { name: 'Grafite', hex: '#334155' },
];

interface RectLayout {
  item: TreemapItem;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  textColor: string;
}

// Binary recursive squarified-like treemap layout that guarantees balanced squares & side-by-side rectangles
function layoutTreemap(
  items: { item: TreemapItem; fill: string; textColor: string }[],
  x: number,
  y: number,
  w: number,
  h: number
): RectLayout[] {
  if (items.length === 0 || w <= 0 || h <= 0) return [];
  if (items.length === 1) {
    return [{ ...items[0], x, y, w, h }];
  }

  const total = items.reduce((acc, it) => acc + Math.max(0.1, it.item.value), 0);
  // Split into two balanced weight groups for clean aspect ratios
  let sumA = 0;
  let splitIdx = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < items.length; i++) {
    sumA += Math.max(0.1, items[i - 1].item.value);
    const diff = Math.abs(sumA - total / 2);
    if (diff < bestDiff) {
      bestDiff = diff;
      splitIdx = i;
    }
  }

  const groupA = items.slice(0, splitIdx);
  const groupB = items.slice(splitIdx);
  const weightA = groupA.reduce((acc, it) => acc + Math.max(0.1, it.item.value), 0);
  const ratioA = weightA / total;

  if (w >= h) {
    const wA = w * ratioA;
    return [
      ...layoutTreemap(groupA, x, y, wA, h),
      ...layoutTreemap(groupB, x + wA, y, w - wA, h),
    ];
  } else {
    const hA = h * ratioA;
    return [
      ...layoutTreemap(groupA, x, y, w, hA),
      ...layoutTreemap(groupB, x, y + hA, w, h - hA),
    ];
  }
}

export const Section4TreemapChart: React.FC = () => {
  const { containerRef, isVisible, animKey, replay } = useScrollReveal(0.2);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [items, setItems] = useState<TreemapItem[]>(INITIAL_ITEMS);
  const [baseColor, setBaseColor] = useState<string>('#1D4ED8');
  const [isCleared, setIsCleared] = useState(false);

  const W = 720;
  const H = 360;
  const pad = 8;

  const rects = useMemo(() => {
    if (items.length === 0) return [];
    const sorted = [...items].sort((a, b) => b.value - a.value);
    const minVal = Math.min(...sorted.map((i) => i.value));
    const maxVal = Math.max(...sorted.map((i) => i.value));
    const span = maxVal - minVal || 1;

    const colored = sorted.map((item, idx) => {
      // Combine normalized value + rank so shades are always clearly distinct from darkest (highest) to lightest (lowest)
      const valRatio = (item.value - minVal) / span;
      const rankRatio = sorted.length > 1 ? 1 - idx / (sorted.length - 1) : 1;
      const t = 0.14 + (valRatio * 0.65 + rankRatio * 0.35) * 0.82;
      const fill = getMonochromeShade(baseColor, t);
      const textColor = getContrastTextColor(fill);
      return { item, fill, textColor };
    });

    return layoutTreemap(colored, pad, pad, W - pad * 2, H - pad * 2);
  }, [items, baseColor]);

  const handleAddItem = () => {
    setIsCleared(false);
    setItems((prev) => [
      ...prev,
      {
        id: `tm-${Date.now()}`,
        name: `Região ${prev.length + 1}`,
        metric: 'Legado de infraestrutura',
        value: 50,
      },
    ]);
  };

  const handleClear = () => {
    setIsCleared(true);
    setItems([]);
  };

  const handleRestore = () => {
    setIsCleared(false);
    setItems(INITIAL_ITEMS);
    replay();
  };

  const handleExportLottie = () => {
    const lottieRects: LottieRectSpec[] = rects.map((r, idx) => ({
      name: `${r.item.name} (${r.item.value}%)`,
      x: r.x + 2,
      y: r.y + 2,
      w: Math.max(4, r.w - 4),
      h: Math.max(4, r.h - 4),
      color: r.fill,
      rx: 6,
      delayFrames: idx * 7,
      durationFrames: 30,
      scaleOrigin: 'center',
      strokeColor: '#FFFFFF',
      strokeWidth: 2,
    }));

    const lottie = buildLottieAnimation({
      title: 'Gráfico de Retângulos Proporcionais',
      width: W,
      height: H,
      rects: lottieRects,
      durationFrames: 110,
    });
    downloadJsonFile(lottie, 'grafico-de-retangulos.json');
  };

  const handleExportPng = () => {
    if (svgRef.current) downloadSvgElementAsPng(svgRef.current, 'grafico-de-retangulos.png');
  };

  const handleExportSvg = () => {
    if (svgRef.current) downloadSvgElementAsSvg(svgRef.current, 'grafico-de-retangulos.svg');
  };

  return (
    <section
      id="retangulos"
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <span>Seção 05</span>
            <span aria-hidden="true">·</span>
            <span>Treemap Monocromático</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Gráfico de Retângulos Proporcionais
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            Escolha uma cor geral. Quanto maior a porcentagem (ex: Europa 88%), mais escuro o tom e maior o bloco; valores menores (ex: Ásia 61%) recebem tons progressivamente mais claros.
          </p>
        </div>

        {/* Base Color Picker */}
        <div className="flex flex-wrap items-center gap-2 self-start bg-slate-50 border border-slate-200 rounded-lg p-1.5">
          <span className="text-xs font-medium text-slate-600 px-1.5">Cor Geral:</span>
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setBaseColor(c.hex)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                baseColor.toLowerCase() === c.hex.toLowerCase()
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-300'
                  : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
              <span>{c.name}</span>
            </button>
          ))}
          <input
            type="color"
            value={baseColor}
            onChange={(e) => setBaseColor(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
            title="Escolher qualquer cor personalizada"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-slate-50/70 border border-slate-200/80 rounded-lg p-3">
          {rects.length === 0 ? (
            <div className="h-[320px] flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
              <p>Nenhum retângulo configurado.</p>
              <button
                type="button"
                onClick={handleRestore}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 cursor-pointer"
              >
                Restaurar Exemplo
              </button>
            </div>
          ) : (
            <svg ref={svgRef} key={animKey} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none">
              {rects.map((r, idx) => {
                const gap = 3;
                const rx = r.x + gap;
                const ry = r.y + gap;
                const rw = Math.max(4, r.w - gap * 2);
                const rh = Math.max(4, r.h - gap * 2);
                const showMetric = rw > 120 && rh > 82;
                const showName = rw > 54 && rh > 42;
                return (
                  <g
                    key={r.item.id}
                    style={{
                      transformOrigin: `${rx + rw / 2}px ${ry + rh / 2}px`,
                      transform: isVisible ? 'scale(1)' : 'scale(0.86)',
                      opacity: isVisible ? 1 : 0,
                      transition: `transform 520ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 65}ms, opacity 420ms ease ${idx * 65}ms`,
                    }}
                  >
                    <rect
                      x={rx}
                      y={ry}
                      width={rw}
                      height={rh}
                      rx={8}
                      fill={r.fill}
                    >
                      <title>{`${r.item.name} — ${r.item.metric}: ${r.item.value}%`}</title>
                    </rect>
                    {showName && (
                      <text
                        x={rx + 14}
                        y={ry + 28}
                        fill={r.textColor}
                        className="text-[15px] font-bold"
                      >
                        {r.item.name}
                      </text>
                    )}
                    {showMetric && (
                      <text
                        x={rx + 14}
                        y={ry + 46}
                        fill={r.textColor}
                        opacity={0.85}
                        className="text-[11px]"
                      >
                        {r.item.metric.length > 28 ? `${r.item.metric.slice(0, 27)}…` : r.item.metric}
                      </text>
                    )}
                    {rw > 48 && rh > 34 && (
                      <text
                        x={rx + 14}
                        y={ry + rh - 14}
                        fill={r.textColor}
                        className="text-[20px] font-mono font-bold tabular-nums"
                      >
                        {r.item.value}%
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Blocos e Porcentagens</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Bloco</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[330px] overflow-y-auto pr-1">
            {items.map((it) => (
              <div
                key={it.id}
                className="p-2.5 border border-slate-200 rounded-lg bg-white space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={it.name}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x))
                      )
                    }
                    className="flex-1 px-2 py-1 text-xs font-semibold border border-slate-200 rounded"
                    placeholder="Nome (ex: Europa)"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={it.value}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((x) =>
                            x.id === it.id ? { ...x, value: Math.max(1, Number(e.target.value)) } : x
                          )
                        )
                      }
                      className="w-16 px-2 py-1 text-xs font-mono tabular-nums text-center border border-slate-200 rounded"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                    disabled={items.length <= 1}
                    className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={it.metric}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((x) => (x.id === it.id ? { ...x, metric: e.target.value } : x))
                    )
                  }
                  className="w-full px-2 py-1 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded"
                  placeholder="Descrição (ex: Legado de infraestrutura)"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <ChartToolbar
        onReplay={replay}
        onClear={handleClear}
        onRestore={handleRestore}
        onExportLottie={handleExportLottie}
        onExportPng={handleExportPng}
        onExportSvg={handleExportSvg}
        isCleared={isCleared}
      />
    </section>
  );
};
