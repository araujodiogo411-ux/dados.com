import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ChartToolbar } from './ChartToolbar';
import {
  buildLottieAnimation,
  downloadJsonFile,
  downloadSvgElementAsPng,
  downloadSvgElementAsSvg,
  LottiePathSpec,
} from '../utils/exportStudio';

interface LineSeries {
  id: string;
  name: string;
  color: string;
  values: number[];
}

const INITIAL_LABELS = ['2002', '2006', '2010', '2014', '2018', '2024'];
const INITIAL_SERIES: LineSeries[] = [
  { id: 's-eu', name: 'Europa', color: '#2563EB', values: [68, 61, 55, 49, 44, 38] },
  { id: 's-as', name: 'Ásia', color: '#DC2626', values: [24, 35, 46, 58, 71, 84] },
  { id: 's-am', name: 'América', color: '#0D9488', values: [42, 48, 52, 57, 61, 65] },
];

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cx1 = p0.x + (p1.x - p0.x) * 0.42;
    const cy1 = p0.y;
    const cx2 = p0.x + (p1.x - p0.x) * 0.58;
    const cy2 = p1.y;
    d += ` C ${cx1.toFixed(2)} ${cy1.toFixed(2)}, ${cx2.toFixed(2)} ${cy2.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  return d;
}

function buildLinearPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  return pts
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}

export const Section2LineChart: React.FC = () => {
  const { containerRef, isVisible, animKey, replay } = useScrollReveal(0.2);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [labels, setLabels] = useState<string[]>(INITIAL_LABELS);
  const [series, setSeries] = useState<LineSeries[]>(INITIAL_SERIES);
  const [smooth, setSmooth] = useState<boolean>(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [isCleared, setIsCleared] = useState(false);

  const W = 720;
  const H = 320;
  const padL = 52;
  const padR = 28;
  const padT = 26;
  const padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const { maxVal, yTicks } = useMemo(() => {
    const allVals = series.flatMap((s) => s.values);
    const rawMax = allVals.length ? Math.max(...allVals, 10) : 100;
    const ceilMax = Math.ceil(rawMax / 20) * 20;
    const max = Math.max(100, ceilMax);
    return {
      maxVal: max,
      yTicks: [0, max * 0.25, max * 0.5, max * 0.75, max],
    };
  }, [series]);

  const computedSeries = useMemo(() => {
    const n = Math.max(1, labels.length);
    return series.map((s) => {
      const pts = labels.map((_, idx) => {
        const val = s.values[idx] ?? 0;
        const x = n === 1 ? padL + plotW / 2 : padL + (idx / (n - 1)) * plotW;
        const y = padT + plotH - (Math.max(0, val) / maxVal) * plotH;
        return { x, y, val };
      });
      const d = smooth ? buildSmoothPath(pts) : buildLinearPath(pts);
      return { ...s, pts, d };
    });
  }, [series, labels, maxVal, plotW, plotH, smooth]);

  const handleAddYear = () => {
    setIsCleared(false);
    const last = labels[labels.length - 1];
    const nextNum = Number(last);
    const nextLabel = !Number.isNaN(nextNum) ? String(nextNum + 2) : `P${labels.length + 1}`;
    setLabels((prev) => [...prev, nextLabel]);
    setSeries((prev) =>
      prev.map((s) => ({
        ...s,
        values: [...s.values, s.values[s.values.length - 1] ?? 50],
      }))
    );
  };

  const handleAddSeries = () => {
    setIsCleared(false);
    const colors = ['#7C3AED', '#D97706', '#2563EB', '#DC2626', '#0D9488'];
    const c = colors[series.length % colors.length];
    setSeries((prev) => [
      ...prev,
      {
        id: `s-${Date.now()}`,
        name: `Série ${prev.length + 1}`,
        color: c,
        values: labels.map((_, i) => Math.min(95, 25 + i * 10)),
      },
    ]);
  };

  const handleClear = () => {
    setIsCleared(true);
    setSeries([]);
  };

  const handleRestore = () => {
    setIsCleared(false);
    setLabels(INITIAL_LABELS);
    setSeries(INITIAL_SERIES);
    replay();
  };

  const handleExportLottie = () => {
    const paths: LottiePathSpec[] = computedSeries.map((s, idx) => ({
      name: s.name,
      d: s.d,
      strokeColor: s.color,
      strokeWidth: 3.5,
      delayFrames: idx * 12,
      durationFrames: 55,
      animateTrim: true,
    }));

    const lottie = buildLottieAnimation({
      title: 'Gráfico de Linhas Animado',
      width: W,
      height: H,
      paths,
      durationFrames: 120,
    });
    downloadJsonFile(lottie, 'grafico-de-linhas-animado.json');
  };

  const handleExportPng = () => {
    if (svgRef.current) downloadSvgElementAsPng(svgRef.current, 'grafico-de-linhas.png');
  };

  const handleExportSvg = () => {
    if (svgRef.current) downloadSvgElementAsSvg(svgRef.current, 'grafico-de-linhas.svg');
  };

  return (
    <section
      id="linhas"
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <span>Seção 03</span>
            <span aria-hidden="true">·</span>
            <span>Evolução Temporal</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Gráfico de Linhas com Animação de Traçado
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            As curvas são desenhadas automaticamente quando você desce até esta seção. Você pode reiniciar a animação sem perder os dados editados ou exportar o arquivo JSON animado.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSmooth(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              smooth ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Curva Suave
          </button>
          <button
            type="button"
            onClick={() => setSmooth(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              !smooth ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Segmentos Retos
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative bg-slate-50/70 border border-slate-200/80 rounded-lg p-4">
        {series.length === 0 ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
            <p>Nenhuma série cadastrada no momento.</p>
            <button
              type="button"
              onClick={handleRestore}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 cursor-pointer"
            >
              Restaurar Exemplo
            </button>
          </div>
        ) : (
          <svg
            ref={svgRef}
            key={animKey}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto select-none overflow-visible"
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Horizontal grid lines */}
            {yTicks.map((tick) => {
              const y = padT + plotH - (tick / maxVal) * plotH;
              return (
                <g key={tick}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={W - padR}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padL - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-500 text-[11px] font-mono tabular-nums"
                  >
                    {Math.round(tick)}%
                  </text>
                </g>
              );
            })}

            {/* X-axis labels */}
            {labels.map((lbl, idx) => {
              const x = labels.length === 1 ? padL + plotW / 2 : padL + (idx / (labels.length - 1)) * plotW;
              return (
                <g key={`${lbl}-${idx}`}>
                  {hoverIdx === idx && (
                    <line
                      x1={x}
                      y1={padT}
                      x2={x}
                      y2={padT + plotH}
                      stroke="#CBD5E1"
                      strokeWidth={1.5}
                    />
                  )}
                  <text
                    x={x}
                    y={H - 12}
                    textAnchor="middle"
                    className="fill-slate-600 text-[11px] font-mono"
                  >
                    {lbl}
                  </text>
                </g>
              );
            })}

            {/* Series Lines */}
            {computedSeries.map((s, sIdx) => (
              <g key={s.id}>
                <path
                  d={s.d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={100}
                  strokeDasharray="100"
                  strokeDashoffset={isVisible ? 0 : 100}
                  style={{
                    transition: `stroke-dashoffset 950ms cubic-bezier(0.16, 1, 0.3, 1) ${sIdx * 140}ms`,
                  }}
                />
                {s.pts.map((pt, pIdx) => (
                  <g
                    key={pIdx}
                    onMouseEnter={() => setHoverIdx(pIdx)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={hoverIdx === pIdx ? 6 : 4}
                      fill="#FFFFFF"
                      stroke={s.color}
                      strokeWidth={2.5}
                      style={{
                        opacity: isVisible ? 1 : 0,
                        transition: `opacity 350ms ease ${sIdx * 140 + 450}ms, r 150ms ease`,
                      }}
                    >
                      <title>{`${s.name} (${labels[pIdx]}): ${pt.val}%`}</title>
                    </circle>
                  </g>
                ))}
              </g>
            ))}
          </svg>
        )}

        {/* Active Hover Readout */}
        {hoverIdx !== null && series.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-700 bg-white border border-slate-200 rounded-md py-1.5 px-3">
            <span className="font-mono font-semibold text-slate-900">{labels[hoverIdx]}:</span>
            {series.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span>{s.name}:</span>
                <strong className="text-slate-900">{s.values[hoverIdx] ?? 0}%</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Inline Spreadsheet Data Editor */}
      {series.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">Tabela de Dados (Edite valores ou adicione pontos)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddSeries}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Linha</span>
              </button>
              <button
                type="button"
                onClick={handleAddYear}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Ponto (Eixo X)</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 px-3 font-medium">Série</th>
                  {labels.map((lbl, idx) => (
                    <th key={idx} className="py-2 px-2 font-mono">
                      <input
                        type="text"
                        value={lbl}
                        onChange={(e) =>
                          setLabels((prev) => prev.map((l, i) => (i === idx ? e.target.value : l)))
                        }
                        className="w-16 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-center font-mono text-xs"
                      />
                    </th>
                  ))}
                  <th className="py-2 px-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {series.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={s.color}
                          onChange={(e) =>
                            setSeries((prev) =>
                              prev.map((x) => (x.id === s.id ? { ...x, color: e.target.value } : x))
                            )
                          }
                          className="w-5 h-5 rounded border-0 p-0 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={s.name}
                          onChange={(e) =>
                            setSeries((prev) =>
                              prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x))
                            )
                          }
                          className="w-28 px-2 py-1 border border-slate-200 rounded text-xs font-medium"
                        />
                      </div>
                    </td>
                    {labels.map((_, idx) => (
                      <td key={idx} className="py-2 px-2">
                        <input
                          type="number"
                          min={0}
                          max={200}
                          value={s.values[idx] ?? 0}
                          onChange={(e) =>
                            setSeries((prev) =>
                              prev.map((x) =>
                                x.id === s.id
                                  ? {
                                      ...x,
                                      values: labels.map((__, vIdx) =>
                                        vIdx === idx ? Number(e.target.value) : (x.values[vIdx] ?? 0)
                                      ),
                                    }
                                  : x
                              )
                            )
                          }
                          className="w-16 px-2 py-1 font-mono tabular-nums text-center border border-slate-200 rounded"
                        />
                      </td>
                    ))}
                    <td className="py-2 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => setSeries((prev) => prev.filter((x) => x.id !== s.id))}
                        disabled={series.length <= 1}
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
