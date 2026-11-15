import React from 'react';
import { RotateCcw, Trash2, Sparkles, FileJson, ImageDown, FileCode2 } from 'lucide-react';

interface ChartToolbarProps {
  onReplay: () => void;
  onClear?: () => void;
  onRestore?: () => void;
  onExportLottie: () => void;
  onExportPng: () => void;
  onExportSvg?: () => void;
  isCleared?: boolean;
  extraControls?: React.ReactNode;
}

export const ChartToolbar: React.FC<ChartToolbarProps> = ({
  onReplay,
  onClear,
  onRestore,
  onExportLottie,
  onExportPng,
  onExportSvg,
  isCleared = false,
  extraControls,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/80">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onReplay}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Reiniciar apenas a animação mantendo seus dados"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Reiniciar Animação</span>
        </button>

        {onClear && !isCleared && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-white border border-slate-200 rounded-md hover:bg-rose-50 hover:border-rose-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Apagar Dados</span>
          </button>
        )}

        {onRestore && isCleared && (
          <button
            type="button"
            onClick={onRestore}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Restaurar Exemplo</span>
          </button>
        )}

        {extraControls}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onExportLottie}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Baixar animação interativa no formato Lottie JSON"
        >
          <FileJson className="w-3.5 h-3.5" />
          <span>Baixar JSON (Animação)</span>
        </button>

        <button
          type="button"
          onClick={onExportPng}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ImageDown className="w-3.5 h-3.5 text-slate-500" />
          <span>Baixar PNG</span>
        </button>

        {onExportSvg && (
          <button
            type="button"
            onClick={onExportSvg}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Baixar SVG</span>
          </button>
        )}
      </div>
    </div>
  );
};
