import React, { useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ChartToolbar } from './ChartToolbar';
import {
  buildLottieAnimation,
  downloadJsonFile,
  downloadSvgElementAsPng,
  downloadSvgElementAsSvg,
  LottieRectSpec,
} from '../utils/exportStudio';

interface LinearSegment {
  id: string;
  label: string;
  color: string;
  percentage: number;
}

interface LinearBarRow {
  id: string;
  yearLabel: string;
  segments: LinearSegment[];
}

const INITIAL_LINEAR_ROWS: LinearBarRow[] = [
  {
    id: 'row-2002',
    yearLabel: '2002',
    segments: [
      { id: 's1', label: 'Queda', color: '#DC2626', percentage: 66 },
      { id: 's2', label: 'Comida', color: '#2563EB', percentage: 34 },
    ],
  },
  {
    id: 'row-2016',
    yearLabel: '2016',
    segments: [
      { id: 's1', label: 'Queda', color: '#DC2626', percentage: 45 },
      { id: 's2', label: 'Comida', color: '#2563EB', percentage: 55 },
    ],
  },
];

const SEGMENT_PALETTE = ['#DC2626', '#2563EB', '#0D9488', '#D97706', '#7C3AED', '#059669'];

export const SectionLinearPercentageBar: React.FC = () => {
  const { containerRef, isVisible, animKey, replay } = useScrollReveal(0.05);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [linearRows, setLinearRows] = useState<LinearBarRow[]>(INITIAL_LINEAR_ROWS);
  const [isCleared, setIsCleared] = useState(false);

  const activeRows = isCleared ? [] : linearRows;

  const linW = 760;
  const trackLeft = 84;
  const trackRightPad = 24;
  const trackW = linW - trackLeft - trackRightPad;
  const linH = Math.max(130, activeRows.length * 56 + 44);

  const handleAddRow = () => {
    setIsCleared(false);
    setLinearRows((prev) => {
      const lastYear = parseInt(prev[prev.length - 1]?.yearLabel || '2002', 10);
      const nextYear = !Number.isNaN(lastYear) ? String(lastYear + 6) : `Ano ${prev.length + 1}`;
      return [
        ...prev,
        {
          id: `row-${Date.now()}`,
          yearLabel: nextYear,
          segments: [
            { id: `s1-${Date.now()}`, label: 'Queda', color: '#DC2626', percentage: 40 },
            { id: `s2-${Date.now()}`, label: 'Comida', color: '#2563EB', percentage: 60 },
          ],
        },
      ];
    });
  };

  const handleExportLottie = () => {
    const rects: LottieRectSpec[] = [];
    activeRows.forEach((row, rIdx) => {
      const total = row.segments.reduce((a, b) => a + Math.max(0, b.percentage), 0) || 100;
      let cursorX = trackLeft;
      const y = 20 + rIdx * 56;
      row.segments.forEach((seg, sIdx) => {
        const pct = Math.max(0, seg.percentage);
        const segW = (pct / total) * trackW;
        if (segW > 0) {
          rects.push({
            name: `${row.yearLabel} - ${seg.label} (${pct}%)`,
            x: cursorX,
            y,
            w: segW,
            h: 32,
            color: seg.color,
            rx: 2,
            strokeColor: '#FFFFFF',
            strokeWidth: 1.5,
            delayFrames: rIdx * 10 + sIdx * 6,
            durationFrames: 30,
            scaleOrigin: 'left',
          });
        }
        cursorX += segW;
      });
    });

    const lottie = buildLottieAnimation({
      title: 'Gráfico de Barra de Porcentagem em Linha Reta',
      width: linW,
      height: linH,
      rects,
      durationFrames: 120,
    });
    downloadJsonFile(lottie, 'grafico-barra-linha-reta.json');
  };

  const handleExportPng = () => {
    if (svgRef.current) {
      downloadSvgElementAsPng(svgRef.current, 'grafico-barra-linha-reta.png');
    }
  };

  const handleExportSvg = () => {
    if (svgRef.current) {
      downloadSvgElementAsSvg(svgRef.current, 'grafico-barra-linha-reta.svg');
    }
  };

  const handleClear = () => {
    setIsCleared(true);
  };

  const handleRestore = () => {
    setIsCleared(false);
    setLinearRows(INITIAL_LINEAR_ROWS);
    replay();
  };

  return (
    <section
      id="linha-reta"
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <span>Seção 02</span>
            <span aria-hidden="true">·</span>
            <span>Porcentagem em Linha Reta</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Gráfico de Barras de Porcentagem em Linha Reta
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            Compare séries percentuais em uma barra reta contínua por ano ou período (ex: 2002 Queda 66% vs Comida 34%). Exporte esta visualização de forma independente em JSON animado, PNG ou SVG.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors self-start whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Adicionar Ano / Linha</span>
        </button>
      </div>

      {activeRows.length === 0 ? (
        <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 space-y-2.5">
          <p>As barras em linha reta foram limpas.</p>
          <button
            type="button"
            onClick={handleRestore}
            className="px-3.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 cursor-pointer"
          >
            Restaurar Exemplo
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-lg p-3 overflow-x-auto">
            <svg
              ref={svgRef}
              key={animKey}
              viewBox={`0 0 ${linW} ${linH}`}
              className="w-full h-auto select-none"
              role="img"
              aria-label="Gráfico de barras de porcentagem em linha reta"
            >
              {/* Reference percentage gridlines */}
              {[0, 25, 50, 75, 100].map((tick) => {
                const tx = trackLeft + (tick / 100) * trackW;
                return (
                  <g key={tick}>
                    <line
                      x1={tx}
                      y1={14}
                      x2={tx}
                      y2={linH - 22}
                      stroke="#E2E8F0"
                      strokeDasharray={tick === 0 || tick === 100 ? undefined : '3 3'}
                    />
                    <text
                      x={tx}
                      y={linH - 6}
                      textAnchor="middle"
                      className="fill-slate-400 text-[10px] font-mono tabular-nums"
                    >
                      {tick}%
                    </text>
                  </g>
                );
              })}

              {activeRows.map((row, rIdx) => {
                const total = row.segments.reduce((a, b) => a + Math.max(0, b.percentage), 0) || 100;
                let cursorX = trackLeft;
                const y = 20 + rIdx * 56;
                return (
                  <g key={row.id}>
                    <text
                      x={16}
                      y={y + 21}
                      className="fill-slate-800 text-[13px] font-mono font-semibold tabular-nums"
                    >
                      {row.yearLabel}
                    </text>
                    {row.segments.map((seg, sIdx) => {
                      const pct = Math.max(0, seg.percentage);
                      const segW = (pct / total) * trackW;
                      const sx = cursorX;
                      cursorX += segW;
                      return (
                        <g key={seg.id}>
                          <rect
                            x={sx}
                            y={y}
                            width={Math.max(0, segW)}
                            height={32}
                            rx={2}
                            fill={seg.color}
                            stroke="#FFFFFF"
                            strokeWidth={1.5}
                            style={{
                              transformOrigin: `${sx}px ${y + 16}px`,
                              transform: isVisible ? 'scaleX(1)' : 'scaleX(0)',
                              transition: `transform 620ms cubic-bezier(0.16, 1, 0.3, 1) ${rIdx * 90 + sIdx * 60}ms, width 400ms ease`,
                            }}
                          >
                            <title>{`${row.yearLabel} · ${seg.label}: ${pct}%`}</title>
                          </rect>
                          {segW > 62 && (
                            <text
                              x={sx + segW / 2}
                              y={y + 20}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              className="text-[11px] font-medium font-mono tabular-nums pointer-events-none"
                              style={{
                                opacity: isVisible ? 1 : 0,
                                transition: `opacity 300ms ease ${rIdx * 90 + sIdx * 60 + 220}ms`,
                              }}
                            >
                              {seg.label} {pct}%
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeRows.map((row) => (
              <div key={row.id} className="p-3.5 border border-slate-200 rounded-lg bg-white space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Ano / Rótulo:</span>
                    <input
                      type="text"
                      value={row.yearLabel}
                      onChange={(e) =>
                        setLinearRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, yearLabel: e.target.value } : r))
                        )
                      }
                      className="w-24 px-2 py-1 text-xs font-mono border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setLinearRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id
                              ? {
                                  ...r,
                                  segments: [
                                    ...r.segments,
                                    {
                                      id: `seg-${Date.now()}`,
                                      label: `Item ${r.segments.length + 1}`,
                                      color: SEGMENT_PALETTE[r.segments.length % SEGMENT_PALETTE.length],
                                      percentage: 20,
                                    },
                                  ],
                                }
                              : r
                          )
                        )
                      }
                      className="px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 cursor-pointer"
                    >
                      + Segmento
                    </button>
                    <button
                      type="button"
                      onClick={() => setLinearRows((prev) => prev.filter((r) => r.id !== row.id))}
                      disabled={activeRows.length <= 1}
                      className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                      title="Remover linha"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {row.segments.map((seg) => (
                    <div
                      key={seg.id}
                      className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-200/70"
                    >
                      <input
                        type="color"
                        value={seg.color}
                        onChange={(e) =>
                          setLinearRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? {
                                    ...r,
                                    segments: r.segments.map((s) =>
                                      s.id === seg.id ? { ...s, color: e.target.value } : s
                                    ),
                                  }
                                : r
                            )
                          )
                        }
                        className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                      />
                      <input
                        type="text"
                        value={seg.label}
                        onChange={(e) =>
                          setLinearRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? {
                                    ...r,
                                    segments: r.segments.map((s) =>
                                      s.id === seg.id ? { ...s, label: e.target.value } : s
                                    ),
                                  }
                                : r
                            )
                          )
                        }
                        className="w-20 text-xs bg-transparent border-b border-slate-300 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={seg.percentage}
                        onChange={(e) =>
                          setLinearRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? {
                                    ...r,
                                    segments: r.segments.map((s) =>
                                      s.id === seg.id ? { ...s, percentage: Number(e.target.value) } : s
                                    ),
                                  }
                                : r
                            )
                          )
                        }
                        className="w-12 text-xs font-mono tabular-nums bg-white px-1 py-0.5 rounded border border-slate-200"
                      />
                      <span className="text-[11px] text-slate-400">%</span>
                      {row.segments.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setLinearRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id
                                  ? { ...r, segments: r.segments.filter((s) => s.id !== seg.id) }
                                  : r
                              )
                            )
                          }
                          className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Remover segmento"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
