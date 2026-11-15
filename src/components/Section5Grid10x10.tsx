import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ChartToolbar } from './ChartToolbar';
import {
  buildLottieAnimation,
  downloadJsonFile,
  downloadSvgElementAsPng,
  downloadSvgElementAsSvg,
  LottieRectSpec,
} from '../utils/exportStudio';

type CellMode = 'escala' | 'estimativa' | 'ambos';

interface GridSubject {
  id: string;
  name: string;
  mode: CellMode;
  solidCount: number; // Escala (pintados)
  stripedCount: number; // Estimativa (listrinhas)
  color: string;
  unitLabel: string;
}

const INITIAL_SUBJECTS: GridSubject[] = [
  {
    id: 'g10-eu',
    name: 'Europa',
    mode: 'escala',
    solidCount: 5,
    stripedCount: 0,
    color: '#2563EB',
    unitLabel: 'Escala confirmada',
  },
  {
    id: 'g10-as',
    name: 'Ásia',
    mode: 'estimativa',
    solidCount: 0,
    stripedCount: 24,
    color: '#DC2626',
    unitLabel: 'Estimativa projetada',
  },
  {
    id: 'g10-am',
    name: 'América',
    mode: 'ambos',
    solidCount: 18,
    stripedCount: 14,
    color: '#0D9488',
    unitLabel: 'Escala + Estimativa',
  },
];

export const Section5Grid10x10: React.FC = () => {
  const { containerRef, isVisible, animKey, replay } = useScrollReveal(0.2);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [subjects, setSubjects] = useState<GridSubject[]>(INITIAL_SUBJECTS);
  const [activeId, setActiveId] = useState<string>('g10-eu');
  const [isCleared, setIsCleared] = useState(false);

  const active = useMemo(
    () => subjects.find((s) => s.id === activeId) || subjects[0],
    [subjects, activeId]
  );

  // Build 100 cells (10 horizontal x 10 vertical)
  const cellStates = useMemo(() => {
    if (!active) return Array.from({ length: 100 }, (_, i) => ({ index: i, kind: 'empty' as const }));

    const solid =
      active.mode === 'escala' || active.mode === 'ambos'
        ? Math.max(0, Math.min(100, active.solidCount))
        : 0;
    const striped =
      active.mode === 'estimativa' || active.mode === 'ambos'
        ? Math.max(0, Math.min(100 - solid, active.stripedCount))
        : 0;

    return Array.from({ length: 100 }, (_, i) => {
      if (i < solid) return { index: i, kind: 'solid' as const };
      if (i < solid + striped) return { index: i, kind: 'striped' as const };
      return { index: i, kind: 'empty' as const };
    });
  }, [active]);

  const cellSize = 32;
  const cellGap = 4;
  const pad = 16;
  const cubeSize = pad * 2 + 10 * cellSize + 9 * cellGap;

  const updateActive = (patch: Partial<GridSubject>) => {
    if (!active) return;
    setSubjects((prev) => prev.map((s) => (s.id === active.id ? { ...s, ...patch } : s)));
  };

  const handleAddSubject = () => {
    setIsCleared(false);
    const id = `g10-${Date.now()}`;
    const palette = ['#2563EB', '#DC2626', '#0D9488', '#7C3AED', '#D97706'];
    const next: GridSubject = {
      id,
      name: `Novo Tema ${subjects.length + 1}`,
      mode: 'escala',
      solidCount: 12,
      stripedCount: 10,
      color: palette[subjects.length % palette.length],
      unitLabel: 'Escala personalizada',
    };
    setSubjects((prev) => [...prev, next]);
    setActiveId(id);
  };

  const handleClear = () => {
    setIsCleared(true);
    setSubjects([]);
  };

  const handleRestore = () => {
    setIsCleared(false);
    setSubjects(INITIAL_SUBJECTS);
    setActiveId('g10-eu');
    replay();
  };

  const handleExportLottie = () => {
    if (!active) return;
    const rects: LottieRectSpec[] = cellStates.map((c, idx) => {
      const col = idx % 10;
      const row = Math.floor(idx / 10);
      const x = pad + col * (cellSize + cellGap);
      const y = pad + row * (cellSize + cellGap);
      const fill =
        c.kind === 'solid'
          ? active.color
          : c.kind === 'striped'
          ? active.color
          : '#FFFFFF';
      return {
        name: `Célula ${idx + 1} (${c.kind})`,
        x,
        y,
        w: cellSize,
        h: cellSize,
        color: fill,
        opacity: c.kind === 'striped' ? 0.35 : 1,
        strokeColor: c.kind === 'empty' ? '#CBD5E1' : active.color,
        strokeWidth: 1.2,
        rx: 4,
        delayFrames: Math.round((idx / 100) * 35),
        durationFrames: 20,
        scaleOrigin: 'center',
      };
    });

    const lottie = buildLottieAnimation({
      title: `Proporção 10x10 - ${active.name}`,
      width: cubeSize,
      height: cubeSize,
      rects,
      durationFrames: 100,
    });
    downloadJsonFile(lottie, `proporcao-10x10-${active.name.toLowerCase()}.json`);
  };

  const handleExportPng = () => {
    if (svgRef.current) downloadSvgElementAsPng(svgRef.current, `proporcao-10x10-${active?.name || 'cubo'}.png`);
  };

  const handleExportSvg = () => {
    if (svgRef.current) downloadSvgElementAsSvg(svgRef.current, `proporcao-10x10-${active?.name || 'cubo'}.svg`);
  };

  const solidTotal = cellStates.filter((c) => c.kind === 'solid').length;
  const stripedTotal = cellStates.filter((c) => c.kind === 'striped').length;
  const emptyTotal = 100 - solidTotal - stripedTotal;

  return (
    <section
      id="proporcao-10x10"
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <span>Seção 06</span>
            <span aria-hidden="true">·</span>
            <span>Matriz 10×10 (100 Unidades)</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Gráfico de Proporção 10×10 (Escala e Estimativa)
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            Cubo formado por 10 quadradinhos na horizontal e 10 na vertical. Escolha se o valor representa uma <strong>Escala</strong> (quadradinhos pintados) ou uma <strong>Estimativa</strong> (quadradinhos com listrinhas dentro). O restante permanece totalmente branco.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddSubject}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md self-start cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Adicionar Região / Item</span>
        </button>
      </div>

      {!active ? (
        <div className="h-[260px] flex flex-col items-center justify-center text-xs text-slate-500 gap-2 border border-dashed border-slate-300 rounded-lg">
          <p>Nenhum item de proporção 10×10 ativo.</p>
          <button
            type="button"
            onClick={handleRestore}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 cursor-pointer"
          >
            Restaurar Exemplo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 10x10 Cube SVG */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center bg-slate-50/70 border border-slate-200/80 rounded-lg p-5">
            <svg
              ref={svgRef}
              key={`${animKey}-${active.id}`}
              viewBox={`0 0 ${cubeSize} ${cubeSize}`}
              className="w-full max-w-[360px] h-auto select-none"
            >
              <defs>
                <pattern
                  id={`hatch-${active.id}`}
                  width="6"
                  height="6"
                  patternTransform="rotate(45 0 0)"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="6" height="6" fill="#FFFFFF" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke={active.color} strokeWidth="2.4" />
                </pattern>
              </defs>

              {cellStates.map((cell, idx) => {
                const col = idx % 10;
                const row = Math.floor(idx / 10);
                const x = pad + col * (cellSize + cellGap);
                const y = pad + row * (cellSize + cellGap);

                const fill =
                  cell.kind === 'solid'
                    ? active.color
                    : cell.kind === 'striped'
                    ? `url(#hatch-${active.id})`
                    : '#FFFFFF';

                const stroke = cell.kind === 'empty' ? '#CBD5E1' : active.color;

                return (
                  <rect
                    key={idx}
                    x={x}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                    rx={4}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.25}
                    style={{
                      transformOrigin: `${x + cellSize / 2}px ${y + cellSize / 2}px`,
                      transform: isVisible ? 'scale(1)' : 'scale(0.75)',
                      opacity: isVisible ? 1 : 0,
                      transition: `transform 380ms cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(idx * 4, 280)}ms, opacity 300ms ease`,
                    }}
                  >
                    <title>
                      {cell.kind === 'solid'
                        ? `${active.name}: Escala (Pintado)`
                        : cell.kind === 'striped'
                        ? `${active.name}: Estimativa (Listrado)`
                        : 'Restante (Branco)'}
                    </title>
                  </rect>
                );
              })}
            </svg>

            <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs text-slate-600">
              {solidTotal > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-sm inline-block" style={{ backgroundColor: active.color }} />
                  <span>Escala: <strong className="font-mono tabular-nums text-slate-900">{solidTotal}/100</strong></span>
                </div>
              )}
              {stripedTotal > 0 && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-sm inline-block border"
                    style={{
                      borderColor: active.color,
                      backgroundImage: `repeating-linear-gradient(45deg, ${active.color}, ${active.color} 2px, #ffffff 2px, #ffffff 5px)`,
                    }}
                  />
                  <span>Estimativa: <strong className="font-mono tabular-nums text-slate-900">{stripedTotal}/100</strong></span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm inline-block bg-white border border-slate-300" />
                <span>Restante: <strong className="font-mono tabular-nums text-slate-900">{emptyTotal}/100</strong></span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="lg:col-span-6 space-y-4">
            {/* Subject tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    active.id === s.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>

            {/* Active subject configuration */}
            <div className="p-4 border border-slate-200 rounded-lg space-y-4 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="color"
                    value={active.color}
                    onChange={(e) => updateActive({ color: e.target.value })}
                    className="w-7 h-7 rounded border-0 p-0 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={active.name}
                    onChange={(e) => updateActive({ name: e.target.value })}
                    className="flex-1 px-2.5 py-1.5 text-sm font-semibold border border-slate-200 rounded"
                    placeholder="Nome (ex: Europa)"
                  />
                </div>
                {subjects.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = subjects.filter((s) => s.id !== active.id);
                      setSubjects(remaining);
                      setActiveId(remaining[0].id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    title="Excluir este item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Mode Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 block">Tipo de Preenchimento</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => updateActive({ mode: 'escala' })}
                    className={`py-1.5 px-2 text-xs font-medium rounded transition-colors cursor-pointer ${
                      active.mode === 'escala'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Escala (Pintado)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateActive({ mode: 'estimativa' })}
                    className={`py-1.5 px-2 text-xs font-medium rounded transition-colors cursor-pointer ${
                      active.mode === 'estimativa'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Estimativa (Listrado)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateActive({ mode: 'ambos' })}
                    className={`py-1.5 px-2 text-xs font-medium rounded transition-colors cursor-pointer ${
                      active.mode === 'ambos'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ambos (Misto)
                  </button>
                </div>
              </div>

              {/* Sliders */}
              {(active.mode === 'escala' || active.mode === 'ambos') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">Quantidade em Escala (Pintados)</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {active.solidCount} / 100
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={active.solidCount}
                      onChange={(e) => updateActive({ solidCount: Number(e.target.value) })}
                      className="flex-1 accent-slate-900 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={active.solidCount}
                      onChange={(e) =>
                        updateActive({ solidCount: Math.max(0, Math.min(100, Number(e.target.value))) })
                      }
                      className="w-16 px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded text-center"
                    />
                  </div>
                </div>
              )}

              {(active.mode === 'estimativa' || active.mode === 'ambos') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">Quantidade em Estimativa (Listrinhas)</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {active.stripedCount} / 100
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={active.stripedCount}
                      onChange={(e) => updateActive({ stripedCount: Number(e.target.value) })}
                      className="flex-1 accent-slate-900 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={active.stripedCount}
                      onChange={(e) =>
                        updateActive({
                          stripedCount: Math.max(0, Math.min(100, Number(e.target.value))),
                        })
                      }
                      className="w-16 px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded text-center"
                    />
                  </div>
                </div>
              )}
            </div>
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
