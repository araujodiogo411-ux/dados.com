import React, { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ChartToolbar } from './ChartToolbar';
import { getMonochromeShade, mixHex } from '../utils/colorRamp';
import {
  buildLottieAnimation,
  downloadJsonFile,
  downloadSvgElementAsPng,
  downloadSvgElementAsSvg,
  LottieRectSpec,
} from '../utils/exportStudio';

interface DivergingRow {
  id: string;
  theme: string;
  leftLabel: string;
  rightLabel: string;
  leftPct: number;
  neutralPct: number;
  rightPct: number;
  leftColor: string;
  rightColor: string;
  neutralColor: string;
}

const PALETTE_PAIRS = [
  { name: 'Vermelho ↔ Azul', left: '#DC2626', right: '#2563EB' },
  { name: 'Laranja ↔ Turquesa', left: '#EA580C', right: '#0D9488' },
  { name: 'Roxo ↔ Esmeralda', left: '#7C3AED', right: '#059669' },
  { name: 'Rosa ↔ Índigo', left: '#DB2777', right: '#4338CA' },
  { name: 'Âmbar ↔ Ardósia', left: '#D97706', right: '#334155' },
];

const INITIAL_ROWS: DivergingRow[] = [
  {
    id: 'div-1',
    theme: 'Transição Energética',
    leftLabel: 'Fóssil',
    rightLabel: 'Renovável',
    leftPct: 32,
    neutralPct: 14,
    rightPct: 54,
    leftColor: '#DC2626',
    rightColor: '#2563EB',
    neutralColor: '#E2E8F0',
  },
  {
    id: 'div-2',
    theme: 'Preferência de Consumo',
    leftLabel: 'Presencial',
    rightLabel: 'Digital',
    leftPct: 44,
    neutralPct: 16,
    rightPct: 40,
    leftColor: '#EA580C',
    rightColor: '#0D9488',
    neutralColor: '#E2E8F0',
  },
];

export const Section6DivergingBars: React.FC = () => {
  const { containerRef, isVisible, animKey, replay } = useScrollReveal(0.2);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [rows, setRows] = useState<DivergingRow[]>(INITIAL_ROWS);
  const [isCleared, setIsCleared] = useState(false);

  const W = 760;
  const rowH = 88;
  const topPad = 24;
  const H = Math.max(150, topPad + rows.length * rowH + 26);
  const centerX = W / 2;
  const halfTrackW = 310; // max width on each side from center black line

  const updateRow = (id: string, patch: Partial<DivergingRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleAddRow = () => {
    setIsCleared(false);
    const pair = PALETTE_PAIRS[rows.length % PALETTE_PAIRS.length];
    setRows((prev) => [
      ...prev,
      {
        id: `div-${Date.now()}`,
        theme: `Novo Tema ${prev.length + 1}`,
        leftLabel: 'Lado A',
        rightLabel: 'Lado B',
        leftPct: 35,
        neutralPct: 12,
        rightPct: 53,
        leftColor: pair.left,
        rightColor: pair.right,
        neutralColor: '#E2E8F0',
      },
    ]);
  };

  const handleClear = () => {
    setIsCleared(true);
    setRows([]);
  };

  const handleRestore = () => {
    setIsCleared(false);
    setRows(INITIAL_ROWS);
    replay();
  };

  const handleExportLottie = () => {
    const rects: LottieRectSpec[] = [];

    rows.forEach((r, idx) => {
      const y = topPad + idx * rowH + 26;
      const barH = 30;
      const maxScale = 100;
      const neutralHalfW = ((r.neutralPct / 2) / maxScale) * halfTrackW;
      const leftW = (r.leftPct / maxScale) * halfTrackW;
      const rightW = (r.rightPct / maxScale) * halfTrackW;

      // Neutral left + right
      if (neutralHalfW > 0) {
        rects.push({
          name: `${r.theme} - Neutro Esq`,
          x: centerX - neutralHalfW,
          y,
          w: neutralHalfW,
          h: barH,
          color: r.neutralColor,
          delayFrames: idx * 10,
          durationFrames: 20,
          scaleOrigin: 'right',
        });
        rects.push({
          name: `${r.theme} - Neutro Dir`,
          x: centerX,
          y,
          w: neutralHalfW,
          h: barH,
          color: r.neutralColor,
          delayFrames: idx * 10,
          durationFrames: 20,
          scaleOrigin: 'left',
        });
      }

      // Stepped left segments (light near center -> dark at far left tip)
      const steps = 4;
      for (let s = 0; s < steps; s++) {
        const segW = leftW / steps;
        const sx = centerX - neutralHalfW - (s + 1) * segW;
        const shade = getMonochromeShade(r.leftColor, 0.25 + (s / (steps - 1)) * 0.65);
        rects.push({
          name: `${r.theme} - Esq ${s + 1}`,
          x: sx,
          y,
          w: Math.max(1, segW),
          h: barH,
          color: shade,
          delayFrames: idx * 10 + 10 + s * 4,
          durationFrames: 24,
          scaleOrigin: 'right',
        });
      }

      // Stepped right segments (light near center -> dark at far right tip)
      for (let s = 0; s < steps; s++) {
        const segW = rightW / steps;
        const sx = centerX + neutralHalfW + s * segW;
        const shade = getMonochromeShade(r.rightColor, 0.25 + (s / (steps - 1)) * 0.65);
        rects.push({
          name: `${r.theme} - Dir ${s + 1}`,
          x: sx,
          y,
          w: Math.max(1, segW),
          h: barH,
          color: shade,
          delayFrames: idx * 10 + 10 + s * 4,
          durationFrames: 24,
          scaleOrigin: 'left',
        });
      }
    });

    // Compact Central Black Axis Line per bar
    rows.forEach((_, idx) => {
      const y = topPad + idx * rowH + 26;
      rects.push({
        name: `Linha Central Preta ${idx + 1}`,
        x: centerX - 1.25,
        y: y - 4,
        w: 2.5,
        h: 40,
        color: '#000000',
        delayFrames: idx * 10,
        durationFrames: 18,
        scaleOrigin: 'center',
      });
    });

    const lottie = buildLottieAnimation({
      title: 'Gráfico de Porcentagem Divergente',
      width: W,
      height: H,
      rects,
      durationFrames: 120,
    });
    downloadJsonFile(lottie, 'grafico-divergente-bilateral.json');
  };

  const handleExportPng = () => {
    if (svgRef.current) downloadSvgElementAsPng(svgRef.current, 'grafico-divergente.png');
  };

  const handleExportSvg = () => {
    if (svgRef.current) downloadSvgElementAsSvg(svgRef.current, 'grafico-divergente.svg');
  };

  return (
    <section
      id="divergente"
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <span>Seção 07</span>
            <span aria-hidden="true">·</span>
            <span>Comparação Bilateral & Zona Neutra</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Gráfico de Porcentagem Divergente (Esquerda × Neutro × Direita)
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            Uma linha preta central divide os dois lados a partir de uma faixa neutra. Os lados se esticam conforme a porcentagem, ficando mais claros perto do centro e mais escuros nas extremidades. Crie quantas barras temáticas quiser abaixo uma da outra.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md self-start cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Criar Mais Uma Barra</span>
        </button>
      </div>

      {/* SVG Visualization */}
      <div className="bg-slate-50/70 border border-slate-200/80 rounded-lg p-4 overflow-x-auto">
        {rows.length === 0 ? (
          <div className="h-[220px] flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
            <p>Nenhuma barra divergente ativa.</p>
            <button
              type="button"
              onClick={handleRestore}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 cursor-pointer"
            >
              Restaurar Exemplo
            </button>
          </div>
        ) : (
          <svg ref={svgRef} key={animKey} viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[620px] h-auto select-none">
            <defs>
              {rows.map((r) => {
                const leftLight = mixHex('#FFFFFF', r.leftColor, 0.35);
                const leftDark = mixHex(r.leftColor, '#090D16', 0.48);
                const rightLight = mixHex('#FFFFFF', r.rightColor, 0.35);
                const rightDark = mixHex(r.rightColor, '#090D16', 0.48);
                return (
                  <React.Fragment key={`grad-${r.id}`}>
                    {/* Left bar: x1=0% (far left = dark) -> x2=100% (near center = light) */}
                    <linearGradient id={`grad-left-${r.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={leftDark} />
                      <stop offset="55%" stopColor={r.leftColor} />
                      <stop offset="100%" stopColor={leftLight} />
                    </linearGradient>
                    {/* Right bar: x1=0% (near center = light) -> x2=100% (far right = dark) */}
                    <linearGradient id={`grad-right-${r.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={rightLight} />
                      <stop offset="45%" stopColor={r.rightColor} />
                      <stop offset="100%" stopColor={rightDark} />
                    </linearGradient>
                  </React.Fragment>
                );
              })}
            </defs>

            {/* Subtle background scale markers */}
            {[-75, -50, -25, 25, 50, 75].map((pct) => {
              const x = centerX + (pct / 100) * halfTrackW;
              return (
                <line
                  key={pct}
                  x1={x}
                  y1={topPad}
                  x2={x}
                  y2={H - 18}
                  stroke="#E2E8F0"
                  strokeDasharray="3 3"
                />
              );
            })}

            {rows.map((r, idx) => {
              const rowTop = topPad + idx * rowH;
              const barY = rowTop + 26;
              const barH = 32;

              // Scale proportionally so neutral + side fits cleanly
              const maxSide = Math.max(100, r.leftPct + r.neutralPct / 2, r.rightPct + r.neutralPct / 2);
              const neutralHalfW = ((r.neutralPct / 2) / maxSide) * halfTrackW;
              const leftW = (r.leftPct / maxSide) * halfTrackW;
              const rightW = (r.rightPct / maxSide) * halfTrackW;

              return (
                <g key={r.id}>
                  {/* Theme Header */}
                  <text
                    x={centerX}
                    y={rowTop + 14}
                    textAnchor="middle"
                    className="fill-slate-900 text-[13px] font-bold"
                  >
                    {r.theme}
                  </text>

                  {/* Neutral Zone spanning both sides of center black line */}
                  <rect
                    x={centerX - neutralHalfW}
                    y={barY}
                    width={neutralHalfW * 2}
                    height={barH}
                    fill={r.neutralColor}
                    style={{
                      transformOrigin: `${centerX}px ${barY + barH / 2}px`,
                      transform: isVisible ? 'scaleX(1)' : 'scaleX(0)',
                      transition: `transform 420ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 100}ms`,
                    }}
                  >
                    <title>{`Zona Neutra: ${r.neutralPct}%`}</title>
                  </rect>

                  {/* Left Bar (grows outward from neutral left edge toward left) */}
                  <rect
                    x={centerX - neutralHalfW - leftW}
                    y={barY}
                    width={Math.max(0, leftW)}
                    height={barH}
                    rx={3}
                    fill={`url(#grad-left-${r.id})`}
                    style={{
                      transformOrigin: `${centerX - neutralHalfW}px ${barY + barH / 2}px`,
                      transform: isVisible ? 'scaleX(1)' : 'scaleX(0)',
                      transition: `transform 640ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 100 + 120}ms`,
                    }}
                  >
                    <title>{`${r.leftLabel}: ${r.leftPct}%`}</title>
                  </rect>

                  {/* Right Bar (grows outward from neutral right edge toward right) */}
                  <rect
                    x={centerX + neutralHalfW}
                    y={barY}
                    width={Math.max(0, rightW)}
                    height={barH}
                    rx={3}
                    fill={`url(#grad-right-${r.id})`}
                    style={{
                      transformOrigin: `${centerX + neutralHalfW}px ${barY + barH / 2}px`,
                      transform: isVisible ? 'scaleX(1)' : 'scaleX(0)',
                      transition: `transform 640ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 100 + 120}ms`,
                    }}
                  >
                    <title>{`${r.rightLabel}: ${r.rightPct}%`}</title>
                  </rect>

                  {/* Left Label & Value */}
                  <text
                    x={Math.max(12, centerX - neutralHalfW - leftW - 8)}
                    y={barY + 20}
                    textAnchor={centerX - neutralHalfW - leftW > 95 ? 'end' : 'start'}
                    className="fill-slate-800 text-[12px] font-semibold font-mono tabular-nums"
                  >
                    {r.leftLabel} {r.leftPct}%
                  </text>

                  {/* Neutral badge text inside neutral zone if wide enough */}
                  {neutralHalfW * 2 > 34 && (
                    <text
                      x={centerX}
                      y={barY + barH + 14}
                      textAnchor="middle"
                      className="fill-slate-500 text-[10px] font-mono tabular-nums"
                    >
                      Neutro {r.neutralPct}%
                    </text>
                  )}

                  {/* Right Label & Value */}
                  <text
                    x={Math.min(W - 12, centerX + neutralHalfW + rightW + 8)}
                    y={barY + 20}
                    textAnchor={centerX + neutralHalfW + rightW < W - 95 ? 'start' : 'end'}
                    className="fill-slate-800 text-[12px] font-semibold font-mono tabular-nums"
                  >
                    {r.rightPct}% {r.rightLabel}
                  </text>

                  {/* Compact Central Black Line scoped to this bar */}
                  <line
                    x1={centerX}
                    y1={barY - 4}
                    x2={centerX}
                    y2={barY + barH + 4}
                    stroke="#000000"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Row Editors */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((r, idx) => (
            <div key={r.id} className="p-4 border border-slate-200 rounded-lg bg-white space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-mono text-slate-400">#{idx + 1}</span>
                  <input
                    type="text"
                    value={r.theme}
                    onChange={(e) => updateRow(r.id, { theme: e.target.value })}
                    className="flex-1 px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded"
                    placeholder="Tema da barra"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                  disabled={rows.length <= 1}
                  className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                  title="Excluir barra"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Palettes */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 mr-1">Paleta:</span>
                {PALETTE_PAIRS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => updateRow(r.id, { leftColor: p.left, rightColor: p.right })}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
                    title={p.name}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.left }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.right }} />
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-slate-50 rounded border border-slate-200/70 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={r.leftColor}
                      onChange={(e) => updateRow(r.id, { leftColor: e.target.value })}
                      className="w-4 h-4 rounded border-0 p-0 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={r.leftLabel}
                      onChange={(e) => updateRow(r.id, { leftLabel: e.target.value })}
                      className="w-full text-[11px] font-medium bg-transparent border-b border-slate-300 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={r.leftPct}
                      onChange={(e) => updateRow(r.id, { leftPct: Math.max(0, Number(e.target.value)) })}
                      className="w-full px-1.5 py-0.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded"
                    />
                    <span className="text-[11px] text-slate-400">%</span>
                  </div>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-200/70 space-y-1">
                  <span className="text-[11px] font-medium text-slate-600 block">Neutro Central</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={r.neutralPct}
                      onChange={(e) => updateRow(r.id, { neutralPct: Math.max(0, Number(e.target.value)) })}
                      className="w-full px-1.5 py-0.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded"
                    />
                    <span className="text-[11px] text-slate-400">%</span>
                  </div>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-200/70 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={r.rightColor}
                      onChange={(e) => updateRow(r.id, { rightColor: e.target.value })}
                      className="w-4 h-4 rounded border-0 p-0 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={r.rightLabel}
                      onChange={(e) => updateRow(r.id, { rightLabel: e.target.value })}
                      className="w-full text-[11px] font-medium bg-transparent border-b border-slate-300 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={r.rightPct}
                      onChange={(e) => updateRow(r.id, { rightPct: Math.max(0, Number(e.target.value)) })}
                      className="w-full px-1.5 py-0.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded"
                    />
                    <span className="text-[11px] text-slate-400">%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
