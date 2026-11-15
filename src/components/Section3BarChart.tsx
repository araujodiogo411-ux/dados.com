import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2, ArrowUpDown } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ChartToolbar } from './ChartToolbar';
import {
  buildLottieAnimation,
  downloadJsonFile,
  downloadSvgElementAsPng,
  downloadSvgElementAsSvg,
  LottieRectSpec,
} from '../utils/exportStudio';

interface BarItem {
  id: string;
  label: string;
  percentage: number;
  color: string;
}

const INITIAL_BARS: BarItem[] = [
  { id: 'b-1', label: 'Europa', percentage: 84, color: '#2563EB' },
  { id: 'b-2', label: 'América do Norte', percentage: 72, color: '#0D9488' },
  { id: 'b-3', label: 'Ásia-Pacífico', percentage: 65, color: '#DC2626' },
  { id: 'b-4', label: 'América Latina', percentage: 49, color: '#D97706' },
  { id: 'b-5', label: 'África', percentage: 34, color: '#7C3AED' },
];

export const Section3BarChart: React.FC = () => {
  const { containerRef, isVisible, animKey, replay } = useScrollReveal(0.2);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [bars, setBars] = useState<BarItem[]>(INITIAL_BARS);
  const [sortDesc, setSortDesc] = useState(false);
  const [isCleared, setIsCleared] = useState(false);

  const displayedBars = useMemo(() => {
    if (!sortDesc) return bars;
    return [...bars].sort((a, b) => b.percentage - a.percentage);
  }, [bars, sortDesc]);

  const W = 720;
  const H = 310;
  const padL = 48;
  const padR = 24;
  const padT = 28;
  const padB = 46;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxPct = useMemo(() => {
    const m = bars.length ? Math.max(...bars.map((b) => b.percentage), 100) : 100;
    return Math.ceil(m / 20) * 20;
  }, [bars]);

  const handleAddBar = () => {
    setIsCleared(false);
    const palette = ['#2563EB', '#0D9488', '#DC2626', '#D97706', '#7C3AED', '#059669'];
    setBars((prev) => [
      ...prev,
      {
        id: `b-${Date.now()}`,
        label: `Categoria ${prev.length + 1}`,
        percentage: 55,
        color: palette[prev.length % palette.length],
      },
    ]);
  };

  const handleClear = () => {
    setIsCleared(true);
    setBars([]);
  };

  const handleRestore = () => {
    setIsCleared(false);
    setBars(INITIAL_BARS);
    replay();
  };

  const handleExportLottie = () => {
    const count = Math.max(1, displayedBars.length);
    const slotW = plotW / count;
    const barW = Math.min(68, slotW * 0.58);

    const rects: LottieRectSpec[] = displayedBars.map((b, idx) => {
      const x = padL + idx * slotW + (slotW - barW) / 2;
      const h = (Math.max(0, b.percentage) / maxPct) * plotH;
      const y = padT + plotH - h;
      return {
        name: `${b.label} (${b.percentage}%)`,
        x,
        y,
        w: barW,
        h: Math.max(2, h),
        color: b.color,
        rx: 6,
        delayFrames: idx * 8,
        durationFrames: 34,
        scaleOrigin: 'bottom',
      };
    });

    const lottie = buildLottieAnimation({
      title: 'Gráfico de Barras Percentuais',
      width: W,
      height: H,
      rects,
      durationFrames: 110,
    });
    downloadJsonFile(lottie, 'grafico-de-barras.json');
  };

  const handleExportPng = () => {
    if (svgRef.current) downloadSvgElementAsPng(svgRef.current, 'grafico-de-barras.png');
  };

  const handleExportSvg = () => {
    if (svgRef.current) downloadSvgElementAsSvg(svgRef.current, 'grafico-de-barras.svg');
  };

  return (
    <section
      id="barras"
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <span>Seção 04</span>
            <span aria-hidden="true">·</span>
            <span>Comparativo Percentual</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Gráfico de Barras Animado
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            Barras percentuais com movimento suave em tempo real conforme você altera os valores, além de ordenação instantânea e exportação em animação JSON ou imagem.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSortDesc((s) => !s)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors self-start cursor-pointer ${
            sortDesc
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>{sortDesc ? 'Ordenado do Maior ao Menor' : 'Ordenar por Porcentagem'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-slate-50/70 border border-slate-200/80 rounded-lg p-4">
          {displayedBars.length === 0 ? (
            <div className="h-[260px] flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
              <p>Nenhuma barra configurada.</p>
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
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const tick = Math.round(maxPct * ratio);
                const y = padT + plotH - ratio * plotH;
                return (
                  <g key={ratio}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={W - padR}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padL - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 text-[11px] font-mono tabular-nums"
                    >
                      {tick}%
                    </text>
                  </g>
                );
              })}

              {displayedBars.map((b, idx) => {
                const slotW = plotW / displayedBars.length;
                const barW = Math.min(68, slotW * 0.58);
                const x = padL + idx * slotW + (slotW - barW) / 2;
                const h = (Math.max(0, b.percentage) / maxPct) * plotH;
                const y = padT + plotH - h;
                return (
                  <g key={b.id}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(2, h)}
                      rx={6}
                      fill={b.color}
                      style={{
                        transformOrigin: `${x + barW / 2}px ${padT + plotH}px`,
                        transform: isVisible ? 'scaleY(1)' : 'scaleY(0)',
                        transition: `transform 620ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 70}ms, y 420ms ease, height 420ms ease`,
                      }}
                    >
                      <title>{`${b.label}: ${b.percentage}%`}</title>
                    </rect>
                    <text
                      x={x + barW / 2}
                      y={y - 8}
                      textAnchor="middle"
                      className="fill-slate-900 text-[12px] font-mono font-semibold tabular-nums"
                      style={{
                        opacity: isVisible ? 1 : 0,
                        transition: `opacity 350ms ease ${idx * 70 + 250}ms`,
                      }}
                    >
                      {b.percentage}%
                    </text>
                    <text
                      x={x + barW / 2}
                      y={H - 14}
                      textAnchor="middle"
                      className="fill-slate-600 text-[11px] font-medium"
                    >
                      {b.label.length > 14 ? `${b.label.slice(0, 13)}…` : b.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Barras e Porcentagens</h3>
            <button
              type="button"
              onClick={handleAddBar}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Barra</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
            {bars.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg bg-white"
              >
                <input
                  type="color"
                  value={b.color}
                  onChange={(e) =>
                    setBars((prev) =>
                      prev.map((x) => (x.id === b.id ? { ...x, color: e.target.value } : x))
                    )
                  }
                  className="w-6 h-6 rounded border-0 p-0 bg-transparent cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={b.label}
                  onChange={(e) =>
                    setBars((prev) =>
                      prev.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x))
                    )
                  }
                  className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 rounded"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={b.percentage}
                  onChange={(e) =>
                    setBars((prev) =>
                      prev.map((x) =>
                        x.id === b.id ? { ...x, percentage: Number(e.target.value) } : x
                      )
                    )
                  }
                  className="w-20 accent-slate-900 cursor-pointer"
                />
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={b.percentage}
                  onChange={(e) =>
                    setBars((prev) =>
                      prev.map((x) =>
                        x.id === b.id ? { ...x, percentage: Number(e.target.value) } : x
                      )
                    )
                  }
                  className="w-14 px-1.5 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded text-center"
                />
                <button
                  type="button"
                  onClick={() => setBars((prev) => prev.filter((x) => x.id !== b.id))}
                  disabled={bars.length <= 1}
                  className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
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
