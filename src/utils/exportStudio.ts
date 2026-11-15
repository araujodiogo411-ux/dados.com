// Utilitários de exportação para Imagem (PNG / SVG) e Animação Lottie JSON (v5.7.4)

export interface LottieRectSpec {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  rx?: number;
  delayFrames?: number;
  durationFrames?: number;
  scaleOrigin?: 'center' | 'bottom' | 'left' | 'right';
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface LottiePathSpec {
  name: string;
  d: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
  fillOpacity?: number;
  delayFrames?: number;
  durationFrames?: number;
  animateTrim?: boolean;
}

export interface LottieBuildOptions {
  title: string;
  width: number;
  height: number;
  background?: string;
  rects?: LottieRectSpec[];
  paths?: LottiePathSpec[];
  durationFrames?: number;
}

function hexToRgba01(hex: string, alpha = 1): [number, number, number, number] {
  const clean = hex.replace('#', '').trim();
  let r = 15, g = 23, b = 42;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length >= 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }
  return [
    Number((r / 255).toFixed(4)),
    Number((g / 255).toFixed(4)),
    Number((b / 255).toFixed(4)),
    alpha,
  ];
}

// Parse simple SVG path commands (M, L, H, V, C, Z) into Lottie vertices
function parseSvgPathToLottieSubpaths(d: string): Array<{ v: number[][]; i: number[][]; o: number[][]; c: boolean }> {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return [];

  const subpaths: Array<{ v: number[][]; i: number[][]; o: number[][]; c: boolean }> = [];
  let current: { v: number[][]; i: number[][]; o: number[][]; c: boolean } | null = null;
  let cx = 0;
  let cy = 0;
  let idx = 0;
  let cmd = '';

  const num = () => parseFloat(tokens[idx++] || '0');
  const ensureCurrent = () => {
    if (!current) {
      current = { v: [], i: [], o: [], c: false };
      subpaths.push(current);
    }
  };

  while (idx < tokens.length) {
    const tk = tokens[idx];
    if (/^[a-zA-Z]$/.test(tk)) {
      cmd = tk;
      idx++;
      if (cmd === 'Z' || cmd === 'z') {
        if (current) current.c = true;
      }
      continue;
    }

    switch (cmd) {
      case 'M': {
        cx = num();
        cy = num();
        current = { v: [[cx, cy]], i: [[0, 0]], o: [[0, 0]], c: false };
        subpaths.push(current);
        cmd = 'L';
        break;
      }
      case 'm': {
        cx += num();
        cy += num();
        current = { v: [[cx, cy]], i: [[0, 0]], o: [[0, 0]], c: false };
        subpaths.push(current);
        cmd = 'l';
        break;
      }
      case 'L': {
        ensureCurrent();
        cx = num();
        cy = num();
        current!.v.push([cx, cy]);
        current!.i.push([0, 0]);
        current!.o.push([0, 0]);
        break;
      }
      case 'l': {
        ensureCurrent();
        cx += num();
        cy += num();
        current!.v.push([cx, cy]);
        current!.i.push([0, 0]);
        current!.o.push([0, 0]);
        break;
      }
      case 'H': {
        ensureCurrent();
        cx = num();
        current!.v.push([cx, cy]);
        current!.i.push([0, 0]);
        current!.o.push([0, 0]);
        break;
      }
      case 'h': {
        ensureCurrent();
        cx += num();
        current!.v.push([cx, cy]);
        current!.i.push([0, 0]);
        current!.o.push([0, 0]);
        break;
      }
      case 'V': {
        ensureCurrent();
        cy = num();
        current!.v.push([cx, cy]);
        current!.i.push([0, 0]);
        current!.o.push([0, 0]);
        break;
      }
      case 'v': {
        ensureCurrent();
        cy += num();
        current!.v.push([cx, cy]);
        current!.i.push([0, 0]);
        current!.o.push([0, 0]);
        break;
      }
      case 'C': {
        ensureCurrent();
        const x1 = num(), y1 = num();
        const x2 = num(), y2 = num();
        const x3 = num(), y3 = num();
        const prevIdx = current!.v.length - 1;
        if (prevIdx >= 0) {
          const [px, py] = current!.v[prevIdx];
          current!.o[prevIdx] = [x1 - px, y1 - py];
        }
        current!.v.push([x3, y3]);
        current!.i.push([x2 - x3, y2 - y3]);
        current!.o.push([0, 0]);
        cx = x3;
        cy = y3;
        break;
      }
      default: {
        idx++;
        break;
      }
    }
  }

  return subpaths.filter((s) => s.v.length >= 2);
}

export function buildLottieAnimation(opts: LottieBuildOptions) {
  const totalFrames = opts.durationFrames || 120;
  const layers: any[] = [];
  let ind = 1;

  // Paths (lines, map polygons, street routes)
  for (const p of opts.paths || []) {
    const subpaths = parseSvgPathToLottieSubpaths(p.d);
    if (subpaths.length === 0) continue;

    const startF = Math.min(totalFrames - 10, Math.max(0, Math.round(p.delayFrames ?? 0)));
    const endF = Math.min(totalFrames, startF + Math.max(12, Math.round(p.durationFrames ?? 40)));

    const shapeItems: any[] = subpaths.map((sp, sIdx) => ({
      ty: 'sh',
      nm: `Caminho ${sIdx + 1}`,
      ks: { a: 0, k: sp },
    }));

    if (p.fillColor) {
      shapeItems.push({
        ty: 'fl',
        c: { a: 0, k: hexToRgba01(p.fillColor, 1) },
        o: { a: 0, k: (p.fillOpacity ?? 1) * 100 },
        r: 1,
        nm: 'Preenchimento',
      });
    }

    if (p.strokeColor && (p.strokeWidth ?? 1.5) > 0) {
      shapeItems.push({
        ty: 'st',
        c: { a: 0, k: hexToRgba01(p.strokeColor, 1) },
        o: { a: 0, k: 100 },
        w: { a: 0, k: p.strokeWidth ?? 2 },
        lc: 2,
        lj: 2,
        nm: 'Contorno',
      });
    }

    if (p.animateTrim) {
      shapeItems.push({
        ty: 'tm',
        s: { a: 0, k: 0 },
        e: {
          a: 1,
          k: [
            { t: startF, s: [0], i: { x: [0.16], y: [1] }, o: { x: [0.3], y: [0] } },
            { t: endF, s: [100] },
          ],
        },
        o: { a: 0, k: 0 },
        m: 1,
        nm: 'Desenho Progressivo',
      });
    }

    shapeItems.push({
      ty: 'tr',
      p: { a: 0, k: [0, 0] },
      a: { a: 0, k: [0, 0] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
    });

    const opacityAnim = p.animateTrim
      ? { a: 0, k: 100 }
      : {
          a: 1,
          k: [
            { t: startF, s: [0], i: { x: [0.2], y: [1] }, o: { x: [0.3], y: [0] } },
            { t: endF, s: [100] },
          ],
        };

    layers.push({
      ddd: 0,
      ind: ind++,
      ty: 4,
      nm: p.name,
      sr: 1,
      ks: {
        o: opacityAnim,
        r: { a: 0, k: 0 },
        p: { a: 0, k: [0, 0, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [{ ty: 'gr', it: shapeItems, nm: p.name }],
      ip: 0,
      op: totalFrames,
      st: 0,
      bm: 0,
    });
  }

  // Rects (squares, bars, treemap tiles, diverging segments)
  for (const r of opts.rects || []) {
    const startF = Math.min(totalFrames - 8, Math.max(0, Math.round(r.delayFrames ?? 0)));
    const endF = Math.min(totalFrames, startF + Math.max(10, Math.round(r.durationFrames ?? 26)));

    let ax = r.x + r.w / 2;
    let ay = r.y + r.h / 2;
    let startScale = [0, 0, 100];

    if (r.scaleOrigin === 'bottom') {
      ax = r.x + r.w / 2;
      ay = r.y + r.h;
      startScale = [100, 0, 100];
    } else if (r.scaleOrigin === 'left') {
      ax = r.x;
      ay = r.y + r.h / 2;
      startScale = [0, 100, 100];
    } else if (r.scaleOrigin === 'right') {
      ax = r.x + r.w;
      ay = r.y + r.h / 2;
      startScale = [0, 100, 100];
    }

    const items: any[] = [
      {
        ty: 'rc',
        d: 1,
        s: { a: 0, k: [r.w, r.h] },
        p: { a: 0, k: [r.x + r.w / 2, r.y + r.h / 2] },
        r: { a: 0, k: r.rx ?? 2 },
        nm: 'Retângulo',
      },
      {
        ty: 'fl',
        c: { a: 0, k: hexToRgba01(r.color, 1) },
        o: { a: 0, k: (r.opacity ?? 1) * 100 },
        r: 1,
        nm: 'Cor',
      },
    ];

    if (r.strokeColor && (r.strokeWidth ?? 0) > 0) {
      items.push({
        ty: 'st',
        c: { a: 0, k: hexToRgba01(r.strokeColor, 1) },
        o: { a: 0, k: 100 },
        w: { a: 0, k: r.strokeWidth },
        nm: 'Borda',
      });
    }

    items.push({
      ty: 'tr',
      p: { a: 0, k: [0, 0] },
      a: { a: 0, k: [0, 0] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
    });

    layers.push({
      ddd: 0,
      ind: ind++,
      ty: 4,
      nm: r.name,
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: startF, s: [0], i: { x: [0.2], y: [1] }, o: { x: [0.3], y: [0] } },
            { t: Math.min(endF, startF + 8), s: [100] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [ax, ay, 0] },
        a: { a: 0, k: [ax, ay, 0] },
        s: {
          a: 1,
          k: [
            { t: startF, s: startScale, i: { x: [0.16, 0.16, 0.16], y: [1, 1, 1] }, o: { x: [0.3, 0.3, 0.3], y: [0, 0, 0] } },
            { t: endF, s: [100, 100, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [{ ty: 'gr', it: items, nm: r.name }],
      ip: 0,
      op: totalFrames,
      st: 0,
      bm: 0,
    });
  }

  // Background solid layer
  layers.push({
    ddd: 0,
    ind: ind++,
    ty: 1,
    nm: 'Fundo',
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [opts.width / 2, opts.height / 2, 0] },
      a: { a: 0, k: [opts.width / 2, opts.height / 2, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    sw: opts.width,
    sh: opts.height,
    sc: opts.background || '#ffffff',
    ip: 0,
    op: totalFrames,
    st: 0,
    bm: 0,
  });

  return {
    v: '5.7.4',
    fr: 60,
    ip: 0,
    op: totalFrames,
    w: Math.round(opts.width),
    h: Math.round(opts.height),
    nm: opts.title,
    ddd: 0,
    assets: [],
    layers,
  };
}

export function downloadJsonFile(data: unknown, filename: string) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function serializeSvgElement(svgEl: SVGSVGElement): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const vb = svgEl.viewBox.baseVal;
  const width = vb && vb.width ? vb.width : svgEl.clientWidth || 800;
  const height = vb && vb.height ? vb.height : svgEl.clientHeight || 480;

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  // Prepend clean white background rect so exported PNG/SVG isn't transparent
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height));
  bg.setAttribute('fill', '#FFFFFF');
  clone.insertBefore(bg, clone.firstChild);

  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

export function downloadSvgElementAsSvg(svgEl: SVGSVGElement, filename: string) {
  const svgString = serializeSvgElement(svgEl);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadSvgElementAsPng(svgEl: SVGSVGElement, filename: string, scale = 2) {
  const vb = svgEl.viewBox.baseVal;
  const width = vb && vb.width ? vb.width : svgEl.clientWidth || 800;
  const height = vb && vb.height ? vb.height : svgEl.clientHeight || 480;

  const svgString = serializeSvgElement(svgEl);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          reject(new Error('PNG generation failed'));
          return;
        }
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, 'image/png');
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
