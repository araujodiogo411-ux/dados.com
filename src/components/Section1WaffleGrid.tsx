import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Plus, Play, Pause, Trash2, Clock, Pencil, Check, X } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ChartToolbar } from './ChartToolbar';
import {
  buildLottieAnimation,
  downloadJsonFile,
  downloadSvgElementAsPng,
  downloadSvgElementAsSvg,
  LottieRectSpec,
} from '../utils/exportStudio';

interface TopicItem {
  id: string;
  label: string;
  color: string;
  quantity: number;
  percentage: number;
}

interface TimelineFrame {
  id: string;
  label: string;
  items: TopicItem[];
}

interface ThemeDef {
  id: string;
  name: string;
  mandatory?: boolean;
  isGeneral?: boolean;
  frames: TimelineFrame[];
}

const INITIAL_THEMES: ThemeDef[] = [
  {
    id: 'geral',
    name: 'Geral',
    mandatory: true,
    isGeneral: true,
    frames: [
      {
        id: 'g-1',
        label: 'Base',
        items: [{ id: 'g-all', label: 'Geral', color: '#94A3B8', quantity: 1000, percentage: 100 }],
      },
    ],
  },
  {
    id: 'regiao',
    name: 'Região',
    frames: [
      {
        id: 'reg-2002',
        label: '2002',
        items: [
          { id: 'r-eu', label: 'Europa', color: '#2563EB', quantity: 480, percentage: 48 },
          { id: 'r-as', label: 'Ásia', color: '#DC2626', quantity: 260, percentage: 26 },
          { id: 'r-am', label: 'América', color: '#0D9488', quantity: 180, percentage: 18 },
          { id: 'r-ou', label: 'Outros', color: '#D97706', quantity: 80, percentage: 8 },
        ],
      },
      {
        id: 'reg-2014',
        label: '2014',
        items: [
          { id: 'r-eu', label: 'Europa', color: '#2563EB', quantity: 340, percentage: 34 },
          { id: 'r-as', label: 'Ásia', color: '#DC2626', quantity: 420, percentage: 42 },
          { id: 'r-am', label: 'América', color: '#0D9488', quantity: 160, percentage: 16 },
          { id: 'r-ou', label: 'Outros', color: '#D97706', quantity: 80, percentage: 8 },
        ],
      },
      {
        id: 'reg-2024',
        label: '2024',
        items: [
          { id: 'r-eu', label: 'Europa', color: '#2563EB', quantity: 220, percentage: 22 },
          { id: 'r-as', label: 'Ásia', color: '#DC2626', quantity: 560, percentage: 56 },
          { id: 'r-am', label: 'América', color: '#0D9488', quantity: 140, percentage: 14 },
          { id: 'r-ou', label: 'Outros', color: '#D97706', quantity: 80, percentage: 8 },
        ],
      },
    ],
  },
  {
    id: 'timer',
    name: 'Timer',
    frames: [
      {
        id: 'tf-1',
        label: 'Etapa 1 (2002)',
        items: [
          { id: 't-eu', label: 'Europa', color: '#2563EB', quantity: 540, percentage: 54 },
          { id: 't-as', label: 'Ásia', color: '#DC2626', quantity: 240, percentage: 24 },
          { id: 't-am', label: 'América', color: '#0D9488', quantity: 150, percentage: 15 },
          { id: 't-ou', label: 'Outros', color: '#D97706', quantity: 70, percentage: 7 },
        ],
      },
      {
        id: 'tf-2',
        label: 'Etapa 2 (2016)',
        items: [
          { id: 't-eu', label: 'Europa', color: '#2563EB', quantity: 310, percentage: 31 },
          { id: 't-as', label: 'Ásia', color: '#DC2626', quantity: 470, percentage: 47 },
          { id: 't-am', label: 'América', color: '#0D9488', quantity: 150, percentage: 15 },
          { id: 't-ou', label: 'Outros', color: '#D97706', quantity: 70, percentage: 7 },
        ],
      },
      {
        id: 'tf-3',
        label: 'Etapa 3 (2025)',
        items: [
          { id: 't-eu', label: 'Europa', color: '#2563EB', quantity: 200, percentage: 20 },
          { id: 't-as', label: 'Ásia', color: '#DC2626', quantity: 580, percentage: 58 },
          { id: 't-am', label: 'América', color: '#0D9488', quantity: 140, percentage: 14 },
          { id: 't-ou', label: 'Outros', color: '#D97706', quantity: 80, percentage: 8 },
        ],
      },
    ],
  },
  {
    id: 'pais',
    name: 'País',
    frames: [
      {
        id: 'p-1',
        label: '2024',
        items: [
          { id: 'p-br', label: 'Brasil', color: '#16A34A', quantity: 350, percentage: 35 },
          { id: 'p-us', label: 'Estados Unidos', color: '#2563EB', quantity: 300, percentage: 30 },
          { id: 'p-jp', label: 'Japão', color: '#DC2626', quantity: 200, percentage: 20 },
          { id: 'p-ou', label: 'Outros', color: '#64748B', quantity: 150, percentage: 15 },
        ],
      },
    ],
  },
];

export const Section1WaffleGrid: React.FC = () => {
  const { containerRef, isVisible, animKey, replay } = useScrollReveal(0.05);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [themes, setThemes] = useState<ThemeDef[]>(INITIAL_THEMES);
  const [activeThemeId, setActiveThemeId] = useState<string>('regiao');
  const [frameIdxByTheme, setFrameIdxByTheme] = useState<Record<string, number>>({});
  const [isPlayingTimer, setIsPlayingTimer] = useState(false);
  const [totalBudgetSquares, setTotalBudgetSquares] = useState<number>(100);
  const [newThemeName, setNewThemeName] = useState('');
  const [renamingThemeId, setRenamingThemeId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [isCleared, setIsCleared] = useState(false);

  const activeTheme = useMemo(
    () => themes.find((t) => t.id === activeThemeId) || themes[0],
    [themes, activeThemeId]
  );

  const activeFrameIdx = Math.min(
    frameIdxByTheme[activeTheme.id] || 0,
    Math.max(0, activeTheme.frames.length - 1)
  );
  const activeFrame = activeTheme.frames[activeFrameIdx] || activeTheme.frames[0];

  // Auto-advance Timeline when playing on ANY theme with > 1 frame
  useEffect(() => {
    if (!isPlayingTimer || activeTheme.isGeneral || activeTheme.frames.length <= 1) return;
    const interval = setInterval(() => {
      setFrameIdxByTheme((prev) => {
        const cur = prev[activeTheme.id] || 0;
        return { ...prev, [activeTheme.id]: (cur + 1) % activeTheme.frames.length };
      });
    }, 1700);
    return () => clearInterval(interval);
  }, [isPlayingTimer, activeTheme]);

  // Active items sorted descending by percentage/quantity so overtaking topics reorder automatically!
  const activeItems: TopicItem[] = useMemo(() => {
    if (isCleared && !activeTheme.isGeneral) return [];
    if (activeTheme.isGeneral) {
      return [{ id: 'g-all', label: 'Geral (Obrigatório)', color: '#94A3B8', quantity: 1000, percentage: 100 }];
    }
    return [...(activeFrame?.items || [])].sort(
      (a, b) => b.percentage - a.percentage || b.quantity - a.quantity
    );
  }, [activeTheme, activeFrame, isCleared]);

  // Compute exact painted square counts per topic using largest remainder
  const topicBlocks = useMemo(() => {
    if (activeTheme.isGeneral) return [];
    if (activeItems.length === 0) return [];

    const totalPct = activeItems.reduce((acc, it) => acc + Math.max(0, it.percentage), 0) || 100;
    const exactCounts = activeItems.map((it) => (Math.max(0, it.percentage) / totalPct) * totalBudgetSquares);
    const floored = exactCounts.map((v) => Math.floor(v));
    let remainder = totalBudgetSquares - floored.reduce((a, b) => a + b, 0);
    const remainders = exactCounts
      .map((v, i) => ({ i, rem: v - floored[i] }))
      .sort((a, b) => b.rem - a.rem);
    for (let r = 0; r < remainder && r < remainders.length; r++) {
      floored[remainders[r].i] += 1;
    }

    return activeItems.map((it, idx) => {
      const count = Math.max(0, floored[idx]);
      // Form a compact square/rectangle for this topic's painted squares
      const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
      const rows = Math.max(1, Math.ceil(count / cols));
      return {
        item: it,
        count,
        cols,
        rows,
      };
    });
  }, [activeItems, activeTheme.isGeneral, totalBudgetSquares]);

  const updateCurrentFrameItems = (updater: (items: TopicItem[]) => TopicItem[]) => {
    setIsCleared(false);
    setThemes((prev) =>
      prev.map((t) => {
        if (t.id !== activeTheme.id) return t;
        return {
          ...t,
          frames: t.frames.map((f, idx) =>
            idx === activeFrameIdx ? { ...f, items: updater(f.items) } : f
          ),
        };
      })
    );
  };

  const handleQuantityChange = (itemId: string, newQty: number) => {
    const safeQty = Math.max(0, newQty);
    updateCurrentFrameItems((items) => {
      const updated = items.map((it) => (it.id === itemId ? { ...it, quantity: safeQty } : it));
      const sum = updated.reduce((a, b) => a + b.quantity, 0);
      if (sum <= 0) return updated.map((it) => ({ ...it, percentage: 0 }));
      return updated.map((it) => ({
        ...it,
        percentage: Number(((it.quantity / sum) * 100).toFixed(1)),
      }));
    });
  };

  const handlePercentageChange = (itemId: string, newPct: number) => {
    const safePct = Math.max(0, Math.min(100, newPct));
    updateCurrentFrameItems((items) =>
      items.map((it) => (it.id === itemId ? { ...it, percentage: safePct } : it))
    );
  };

  const handleAddTopic = () => {
    const palette = ['#2563EB', '#DC2626', '#0D9488', '#D97706', '#7C3AED', '#DB2777', '#059669'];
    const color = palette[activeItems.length % palette.length];
    const newId = `topic-${Date.now()}`;
    const newLabel = `Tópico ${activeItems.length + 1}`;
    setIsCleared(false);
    setThemes((prev) =>
      prev.map((t) => {
        if (t.id !== activeTheme.id) return t;
        return {
          ...t,
          frames: t.frames.map((f) => {
            const next = [...f.items, { id: newId, label: newLabel, color, quantity: 120, percentage: 15 }];
            const sum = next.reduce((a, b) => a + b.quantity, 0) || 1;
            return {
              ...f,
              items: next.map((it) => ({
                ...it,
                percentage: Number(((it.quantity / sum) * 100).toFixed(1)),
              })),
            };
          }),
        };
      })
    );
  };

  const handleAddTimelineStep = () => {
    if (activeTheme.isGeneral) return;
    setIsCleared(false);
    const lastFrame = activeTheme.frames[activeTheme.frames.length - 1];
    const numericYear = parseInt(lastFrame?.label || '', 10);
    const nextLabel = !Number.isNaN(numericYear)
      ? String(numericYear + 5)
      : `Etapa ${activeTheme.frames.length + 1}`;

    // Clone last frame's items so user can smoothly tweak how values changed over time
    const clonedItems = (lastFrame?.items || []).map((it) => ({ ...it }));
    const newFrame: TimelineFrame = {
      id: `tf-${Date.now()}`,
      label: nextLabel,
      items: clonedItems,
    };

    setThemes((prev) =>
      prev.map((t) => (t.id === activeTheme.id ? { ...t, frames: [...t.frames, newFrame] } : t))
    );
    setFrameIdxByTheme((prev) => ({ ...prev, [activeTheme.id]: activeTheme.frames.length }));
  };

  const handleDeleteTimelineStep = (idxToDelete: number) => {
    if (activeTheme.frames.length <= 1) return;
    setIsPlayingTimer(false);
    setThemes((prev) =>
      prev.map((t) =>
        t.id === activeTheme.id
          ? { ...t, frames: t.frames.filter((_, i) => i !== idxToDelete) }
          : t
      )
    );
    setFrameIdxByTheme((prev) => ({
      ...prev,
      [activeTheme.id]: Math.max(0, Math.min(activeFrameIdx, activeTheme.frames.length - 2)),
    }));
  };

  const handleCreateCustomTheme = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newThemeName.trim();
    if (!trimmed) return;
    const id = `custom-${Date.now()}`;
    const newTheme: ThemeDef = {
      id,
      name: trimmed,
      frames: [
        {
          id: `${id}-f1`,
          label: '2024',
          items: [
            { id: `${id}-1`, label: 'Grupo A', color: '#2563EB', quantity: 60, percentage: 60 },
            { id: `${id}-2`, label: 'Grupo B', color: '#DC2626', quantity: 40, percentage: 40 },
          ],
        },
      ],
    };
    setThemes((prev) => [...prev, newTheme]);
    setActiveThemeId(id);
    setNewThemeName('');
    setIsCleared(false);
  };

  const handleDeleteTheme = (themeId: string) => {
    const target = themes.find((t) => t.id === themeId);
    if (!target || target.mandatory) return;
    setIsPlayingTimer(false);
    const remaining = themes.filter((t) => t.id !== themeId);
    setThemes(remaining);
    if (activeThemeId === themeId) {
      setActiveThemeId(remaining[0]?.id || 'geral');
    }
  };

  const handleSaveRename = (themeId: string) => {
    const clean = renameDraft.trim();
    if (clean) {
      setThemes((prev) => prev.map((t) => (t.id === themeId ? { ...t, name: clean } : t)));
    }
    setRenamingThemeId(null);
  };

  // Compute SVG geometry:
  // - If Geral: single unified 10x10 or 20x10 gray grid
  // - If segmented theme: separate square blocks per topic side by side with topic title on top!
  const svgGeometry = useMemo(() => {
    if (activeTheme.isGeneral) {
      const cols = totalBudgetSquares === 100 ? 10 : 20;
      const rows = 10;
      const cellSize = cols === 10 ? 30 : 22;
      const gap = 4;
      const pad = 20;
      const w = pad * 2 + cols * cellSize + (cols - 1) * gap;
      const h = pad * 2 + rows * cellSize + (rows - 1) * gap;
      const squares = Array.from({ length: totalBudgetSquares }, (_, i) => ({
        x: pad + (i % cols) * (cellSize + gap),
        y: pad + Math.floor(i / cols) * (cellSize + gap),
        size: cellSize,
        color: '#94A3B8',
        label: 'Geral',
      }));
      return { w, h, generalSquares: squares, blocks: [] as any[] };
    }

    const cellSize = totalBudgetSquares === 100 ? 22 : 16;
    const cellGap = 3;
    const blockGap = 28;
    const padX = 24;
    const headerH = 42;
    const padY = 20;
    const maxRowWidth = 680;

    let cursorX = padX;
    let cursorY = padY;
    let rowMaxH = 0;
    let maxUsedW = 460;

    const placedBlocks = topicBlocks.map((tb) => {
      const blockW = Math.max(110, tb.cols * cellSize + (tb.cols - 1) * cellGap);
      const gridH = tb.rows * cellSize + (tb.rows - 1) * cellGap;
      const totalBlockH = headerH + gridH;

      if (cursorX > padX && cursorX + blockW > maxRowWidth) {
        cursorX = padX;
        cursorY += rowMaxH + blockGap;
        rowMaxH = 0;
      }

      const bx = cursorX;
      const by = cursorY;
      cursorX += blockW + blockGap;
      maxUsedW = Math.max(maxUsedW, bx + blockW + padX);
      rowMaxH = Math.max(rowMaxH, totalBlockH);

      const squares = Array.from({ length: tb.count }, (_, idx) => {
        const col = idx % tb.cols;
        const row = Math.floor(idx / tb.cols);
        return {
          x: bx + col * (cellSize + cellGap),
          y: by + headerH + row * (cellSize + cellGap),
          size: cellSize,
          color: tb.item.color,
        };
      });

      return {
        item: tb.item,
        count: tb.count,
        x: bx,
        y: by,
        w: blockW,
        squares,
      };
    });

    const totalH = Math.max(220, cursorY + rowMaxH + padY);
    return {
      w: Math.max(540, maxUsedW),
      h: totalH,
      generalSquares: [],
      blocks: placedBlocks,
    };
  }, [activeTheme.isGeneral, totalBudgetSquares, topicBlocks]);

  const handleExportLottie = () => {
    const rects: LottieRectSpec[] = [];

    if (activeTheme.isGeneral) {
      svgGeometry.generalSquares.forEach((sq, idx) => {
        rects.push({
          name: `Geral ${idx + 1}`,
          x: sq.x,
          y: sq.y,
          w: sq.size,
          h: sq.size,
          color: sq.color,
          rx: 3,
          delayFrames: Math.round((idx / totalBudgetSquares) * 40),
          durationFrames: 20,
          scaleOrigin: 'center',
        });
      });
    } else {
      svgGeometry.blocks.forEach((blk, bIdx) => {
        blk.squares.forEach((sq: any, sIdx: number) => {
          rects.push({
            name: `${blk.item.label} #${sIdx + 1}`,
            x: sq.x,
            y: sq.y,
            w: sq.size,
            h: sq.size,
            color: sq.color,
            rx: 3,
            delayFrames: bIdx * 10 + Math.round((sIdx / Math.max(1, blk.count)) * 28),
            durationFrames: 20,
            scaleOrigin: 'center',
          });
        });
      });
    }

    const lottie = buildLottieAnimation({
      title: `Quadradinhos - ${activeTheme.name}`,
      width: svgGeometry.w,
      height: svgGeometry.h,
      rects,
      durationFrames: 120,
    });
    downloadJsonFile(lottie, `grafico-quadradinhos-${activeTheme.name.toLowerCase()}.json`);
  };

  const handleExportPng = () => {
    if (svgRef.current) {
      downloadSvgElementAsPng(svgRef.current, `grafico-quadradinhos-${activeTheme.name.toLowerCase()}.png`);
    }
  };

  const handleExportSvg = () => {
    if (svgRef.current) {
      downloadSvgElementAsSvg(svgRef.current, `grafico-quadradinhos-${activeTheme.name.toLowerCase()}.svg`);
    }
  };

  const handleClear = () => {
    setIsPlayingTimer(false);
    setIsCleared(true);
  };

  const handleRestore = () => {
    setIsCleared(false);
    setThemes(INITIAL_THEMES);
    setActiveThemeId('regiao');
    setFrameIdxByTheme({});
    replay();
  };

  return (
    <section
      id="quadradinhos"
      ref={containerRef}
      className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <span>Seção 01</span>
            <span aria-hidden="true">·</span>
            <span>Blocos Proporcionais & Linha Temporal</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Gráfico de Quadradinhos por Tema e Linha Temporal
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            No tema obrigatório <strong>Geral</strong>, todos os quadrados ficam juntos em cinza. Nos demais temas, cada tópico forma seu próprio bloco separado de quadradinhos ordenados do maior ao menor — e você pode renomear, remover temas ou adicionar etapas de linha do tempo em qualquer tema.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTotalBudgetSquares(100)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              totalBudgetSquares === 100
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            100 Quadrados
          </button>
          <button
            type="button"
            onClick={() => setTotalBudgetSquares(200)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              totalBudgetSquares === 200
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            200 Quadrados
          </button>
        </div>
      </div>

      {/* Theme Selector Tabs (Geral mandatory; all others editable & removable) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          {themes.map((t) => {
            const isActive = activeTheme.id === t.id;
            const isRenaming = renamingThemeId === t.id;
            return (
              <div
                key={t.id}
                className={`inline-flex items-center gap-1 rounded-md transition-colors ${
                  isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isRenaming ? (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <input
                      type="text"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(t.id);
                        if (e.key === 'Escape') setRenamingThemeId(null);
                      }}
                      autoFocus
                      className="w-24 text-xs px-1.5 py-0.5 border border-blue-400 rounded focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveRename(t.id)}
                      className="p-0.5 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveThemeId(t.id);
                        setIsPlayingTimer(false);
                      }}
                      className="px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t.name}
                      {t.mandatory ? ' (Obrigatório)' : ''}
                    </button>
                    {!t.mandatory && isActive && (
                      <div className="flex items-center pr-1.5 gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingThemeId(t.id);
                            setRenameDraft(t.name);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                          title="Renomear tema"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTheme(t.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Remover tema"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleCreateCustomTheme} className="flex items-center gap-2">
          <input
            type="text"
            value={newThemeName}
            onChange={(e) => setNewThemeName(e.target.value)}
            placeholder="Novo tema (ex: Produtos)..."
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Tema</span>
          </button>
        </form>
      </div>

      {/* Universal Timeline / Timer Bar available on ANY non-general theme */}
      {!activeTheme.isGeneral && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-lg">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-700">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Linha do Tempo ({activeTheme.name}):</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {activeTheme.frames.map((f, idx) => (
                <div key={f.id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => setFrameIdxByTheme((p) => ({ ...p, [activeTheme.id]: idx }))}
                    className={`px-2.5 py-1 text-xs font-mono rounded-l transition-colors cursor-pointer ${
                      activeFrameIdx === idx
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    } ${activeTheme.frames.length <= 1 ? 'rounded-r' : ''}`}
                  >
                    {f.label}
                  </button>
                  {activeTheme.frames.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTimelineStep(idx)}
                      className={`px-1 py-1 text-xs border-y border-r rounded-r transition-colors cursor-pointer ${
                        activeFrameIdx === idx
                          ? 'bg-blue-700 border-blue-700 text-blue-100 hover:text-white'
                          : 'bg-white border-slate-200 text-slate-400 hover:text-rose-600'
                      }`}
                      title="Remover etapa"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddTimelineStep}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Adicionar Etapa / Ano</span>
              </button>
            </div>
          </div>

          {activeTheme.frames.length > 1 && (
            <button
              type="button"
              onClick={() => setIsPlayingTimer((p) => !p)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isPlayingTimer ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlayingTimer ? 'Pausar Linha do Tempo' : 'Simular Mudança no Tempo'}</span>
            </button>
          )}
        </div>
      )}

      {/* Main Split: Visualization + Topic Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-50/70 border border-slate-200/80 rounded-lg p-4 overflow-x-auto">
          <svg
            ref={svgRef}
            key={`${animKey}-${activeTheme.id}`}
            viewBox={`0 0 ${svgGeometry.w} ${svgGeometry.h}`}
            className="w-full h-auto select-none"
            role="img"
            aria-label={`Gráfico de quadradinhos do tema ${activeTheme.name}`}
          >
            {/* GERAL: all gray squares together in one continuous block */}
            {activeTheme.isGeneral &&
              svgGeometry.generalSquares.map((sq, idx) => (
                <rect
                  key={idx}
                  x={sq.x}
                  y={sq.y}
                  width={sq.size}
                  height={sq.size}
                  rx={3}
                  fill={sq.color}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transformOrigin: `${sq.x + sq.size / 2}px ${sq.y + sq.size / 2}px`,
                    transform: isVisible ? 'scale(1)' : 'scale(0.65)',
                    transition: `transform 360ms cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(idx * 3, 240)}ms, opacity 280ms ease`,
                  }}
                >
                  <title>Geral (100%)</title>
                </rect>
              ))}

            {/* SEGMENTED THEMES: each topic in its OWN separated square block, ordered largest -> smallest */}
            {!activeTheme.isGeneral &&
              svgGeometry.blocks.map((blk: any, bIdx: number) => (
                <g key={blk.item.id}>
                  {/* Topic header on top of its own block */}
                  <text
                    x={blk.x}
                    y={blk.y + 14}
                    className="fill-slate-900 text-[13px] font-bold"
                  >
                    {blk.item.label}
                  </text>
                  <text
                    x={blk.x}
                    y={blk.y + 30}
                    className="fill-slate-500 text-[11px] font-mono tabular-nums"
                  >
                    {blk.item.percentage.toFixed(1)}% · {blk.count} quad.
                  </text>

                  {/* Painted squares inside this topic's own container */}
                  {blk.squares.map((sq: any, sIdx: number) => (
                    <rect
                      key={`${blk.item.id}-${sIdx}`}
                      x={sq.x}
                      y={sq.y}
                      width={sq.size}
                      height={sq.size}
                      rx={3}
                      fill={sq.color}
                      style={{
                        opacity: isVisible ? 1 : 0,
                        transformOrigin: `${sq.x + sq.size / 2}px ${sq.y + sq.size / 2}px`,
                        transform: isVisible ? 'scale(1)' : 'scale(0.65)',
                        transition: `transform 380ms cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(bIdx * 60 + sIdx * 4, 280)}ms, opacity 280ms ease, fill 350ms ease`,
                      }}
                    >
                      <title>{`${blk.item.label}: ${blk.item.percentage.toFixed(1)}% (${blk.item.quantity})`}</title>
                    </rect>
                  ))}
                </g>
              ))}
          </svg>
        </div>

        {/* Right: Topic Data Editor for Active Theme / Active Timeline Frame */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Tópicos de "{activeTheme.name}"
              </h3>
              {!activeTheme.isGeneral && activeFrame && (
                <input
                  type="text"
                  value={activeFrame.label}
                  onChange={(e) => {
                    const val = e.target.value;
                    setThemes((prev) =>
                      prev.map((t) =>
                        t.id === activeTheme.id
                          ? {
                              ...t,
                              frames: t.frames.map((f, idx) =>
                                idx === activeFrameIdx ? { ...f, label: val } : f
                              ),
                            }
                          : t
                      )
                    );
                  }}
                  className="w-24 px-2 py-0.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                  title="Editar rótulo da etapa/ano"
                />
              )}
            </div>
            {!activeTheme.isGeneral && (
              <button
                type="button"
                onClick={handleAddTopic}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Tópico</span>
              </button>
            )}
          </div>

          {activeTheme.isGeneral ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
              <p className="font-medium text-slate-800">Modo Geral Ativo (Obrigatório)</p>
              <p>
                Todos os {totalBudgetSquares} quadradinhos ficam reunidos em um único bloco cinza sólido. Selecione outro tema ou crie um novo para dividir em blocos separados por cor.
              </p>
            </div>
          ) : activeItems.length === 0 ? (
            <div className="p-5 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 space-y-2">
              <p>Os dados desta visualização foram limpos.</p>
              <button
                type="button"
                onClick={handleRestore}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 cursor-pointer"
              >
                Restaurar Exemplo
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {activeItems.map((it, idx) => (
                <div
                  key={it.id}
                  className="grid grid-cols-12 gap-2 items-center p-2.5 border border-slate-200 rounded-lg bg-white"
                >
                  <input
                    type="color"
                    value={it.color}
                    onChange={(e) =>
                      updateCurrentFrameItems((items) =>
                        items.map((x) => (x.id === it.id ? { ...x, color: e.target.value } : x))
                      )
                    }
                    className="col-span-1 w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                    title="Cor do tópico"
                  />
                  <div className="col-span-4 flex flex-col">
                    <span className="text-[10px] text-slate-400">Posição #{idx + 1}</span>
                    <input
                      type="text"
                      value={it.label}
                      onChange={(e) =>
                        updateCurrentFrameItems((items) =>
                          items.map((x) => (x.id === it.id ? { ...x, label: e.target.value } : x))
                        )
                      }
                      className="px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                      placeholder="Nome"
                    />
                  </div>
                  <div className="col-span-3 flex flex-col">
                    <span className="text-[10px] text-slate-400">Quantidade</span>
                    <input
                      type="number"
                      min={0}
                      value={it.quantity}
                      onChange={(e) => handleQuantityChange(it.id, Number(e.target.value))}
                      className="px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-3 flex flex-col">
                    <span className="text-[10px] text-slate-400">Porcentagem %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={it.percentage}
                      onChange={(e) => handlePercentageChange(it.id, Number(e.target.value))}
                      className="px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateCurrentFrameItems((items) => items.filter((x) => x.id !== it.id))
                    }
                    disabled={activeItems.length <= 1}
                    className="col-span-1 flex items-center justify-center p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                    title="Remover tópico"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
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
