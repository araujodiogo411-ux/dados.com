import { useState } from 'react';
import { Section1WaffleGrid } from './components/Section1WaffleGrid';
import { SectionLinearPercentageBar } from './components/SectionLinearPercentageBar';
import { Section2LineChart } from './components/Section2LineChart';
import { Section3BarChart } from './components/Section3BarChart';
import { Section4TreemapChart } from './components/Section4TreemapChart';
import { Section5Grid10x10 } from './components/Section5Grid10x10';
import { Section6DivergingBars } from './components/Section6DivergingBars';
import { Section7CountryMap } from './components/Section7CountryMap';

export default function App() {
  const [globalReplayKey, setGlobalReplayKey] = useState(0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
          <a
            href="#topo"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            PrismaDados
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#quadradinhos"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Quadradinhos
            </a>
            <a
              href="#linha-reta"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Linha Reta
            </a>
            <a
              href="#linhas"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Linhas
            </a>
            <a
              href="#barras"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Barras
            </a>
            <a
              href="#retangulos"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Retângulos
            </a>
            <a
              href="#territorios"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Territórios 2D
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setGlobalReplayKey((k) => k + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Reiniciar Animações
            </button>
          </div>
        </div>
      </header>

      <main id="topo" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 lg:py-10 space-y-10">
        {/* Editorial Intro */}
        <section className="space-y-4 pb-6 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Estúdio de Visualização</span>
            <span aria-hidden="true">·</span>
            <span>8 Módulos Interativos</span>
            <span aria-hidden="true">·</span>
            <span>Exportação Lottie JSON, PNG e SVG</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 max-w-3xl text-balance">
            Gráficos proporcionais, séries animadas e cartografia real em 2D
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
            Edite quantidades, porcentagens, escalas, paletas e territórios reais ao vivo. Cada seção anima ao aparecer na tela e permite reiniciar apenas a animação sem perder seus dados ou baixar o resultado em animação JSON e imagem.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {[
              { href: '#quadradinhos', label: '01. Quadradinhos por Tema' },
              { href: '#linha-reta', label: '02. Porcentagem em Linha Reta' },
              { href: '#linhas', label: '03. Gráfico de Linhas' },
              { href: '#barras', label: '04. Gráfico de Barras' },
              { href: '#retangulos', label: '05. Retângulos Monocromáticos' },
              { href: '#proporcao-10x10', label: '06. Proporção 10×10' },
              { href: '#divergente', label: '07. Divergente Bilateral' },
              { href: '#territorios', label: '08. Territórios Reais 2D' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:border-slate-300 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                {item.label}
              </a>
            ))}
          </div>
        </section>

        {/* All 8 Interactive Sections */}
        <div key={globalReplayKey} className="space-y-10">
          <Section1WaffleGrid />
          <SectionLinearPercentageBar />
          <Section2LineChart />
          <Section3BarChart />
          <Section4TreemapChart />
          <Section5Grid10x10 />
          <Section6DivergingBars />
          <Section7CountryMap />
        </div>
      </main>

      <footer className="max-w-[1280px] mx-auto px-6 py-8 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
        <span>PrismaDados · Dados e Cartografia Interativa</span>
        <span>Limites territoriais reais via IBGE, geoBoundaries, Natural Earth e OpenStreetMap</span>
      </footer>
    </div>
  );
}
