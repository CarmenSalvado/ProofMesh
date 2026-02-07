"use client";

import { useRef, useState } from "react";
import { toJpeg, toPng } from "html-to-image";
import { ProofCanvasV2 } from "@/components/canvas/ProofCanvasV2";
import { CanvasEdge, CanvasNode } from "@/components/canvas/types";

const THUMBNAIL_NODES: CanvasNode[] = [
  {
    id: "def-prime",
    type: "DEFINITION",
    title: "Prime Number",
    formula: "$n \\in \\mathbb{N}, n > 1$",
    x: 120,
    y: 80,
    width: 280,
    status: "DRAFT",
    dependencies: [],
  },
  {
    id: "lem-euclid",
    type: "LEMMA",
    title: "Euclid's Construction",
    content: "$N = p_1 \\cdots p_n + 1$",
    x: 850,
    y: 95,
    width: 280,
    status: "VERIFIED",
    dependencies: [],
  },
  {
    id: "thm-inf",
    type: "THEOREM",
    title: "Infinitude of Primes",
    formula: "$\\exists^\\infty p : \\mathrm{Prime}(p)$",
    x: 500,
    y: 360,
    width: 290,
    status: "VERIFIED",
    dependencies: [],
  },
  {
    id: "formal-check",
    type: "FORMAL_TEST",
    title: "Lean Verification PASS",
    content: "lean-runner> theorem `prime_infinite` compiled.",
    x: 110,
    y: 380,
    width: 330,
    status: "VERIFIED",
    dependencies: [],
  },
];

const THUMBNAIL_EDGES: CanvasEdge[] = [
  { id: "edge-1", from: "def-prime", to: "thm-inf", type: "implies" },
  { id: "edge-2", from: "lem-euclid", to: "thm-inf", type: "implies" },
  { id: "edge-3", from: "formal-check", to: "thm-inf", type: "references" },
];

const MATH_SYMBOLS: Array<{
  symbol: string;
  className: string;
  style: { top?: string; bottom?: string; left?: string; right?: string; transform?: string };
}> = [
  {
    symbol: "∫",
    className: "text-[138px] text-indigo-500/62 drop-shadow-[0_0_8px_rgba(99,102,241,0.18)]",
    style: { top: "8.5%", left: "4.5%", transform: "rotate(-12deg)" },
  },
  {
    symbol: "cos",
    className: "text-[76px] text-rose-500/48 drop-shadow-[0_0_5px_rgba(244,63,94,0.14)]",
    style: { top: "8.8%", left: "21%", transform: "rotate(-6deg)" },
  },
  {
    symbol: "≈",
    className: "text-[84px] text-sky-500/50 drop-shadow-[0_0_6px_rgba(14,165,233,0.16)]",
    style: { top: "7.6%", left: "38%", transform: "rotate(-7deg)" },
  },
  {
    symbol: "log",
    className: "text-[70px] text-blue-500/46 drop-shadow-[0_0_5px_rgba(59,130,246,0.14)]",
    style: { top: "8.6%", left: "56%", transform: "rotate(8deg)" },
  },
  {
    symbol: "∑",
    className: "text-[80px] text-indigo-500/46 drop-shadow-[0_0_5px_rgba(99,102,241,0.14)]",
    style: { top: "8.2%", right: "24%", transform: "rotate(8deg)" },
  },
  {
    symbol: "√",
    className: "text-[118px] text-cyan-500/62 drop-shadow-[0_0_8px_rgba(6,182,212,0.18)]",
    style: { top: "9.5%", right: "5.5%", transform: "rotate(9deg)" },
  },
  {
    symbol: "∞",
    className: "text-[104px] text-violet-500/56 drop-shadow-[0_0_7px_rgba(139,92,246,0.16)]",
    style: { top: "30%", left: "8.5%", transform: "rotate(-8deg)" },
  },
  {
    symbol: "tan",
    className: "text-[76px] text-cyan-500/48 drop-shadow-[0_0_5px_rgba(6,182,212,0.14)]",
    style: { top: "47%", left: "4.8%", transform: "rotate(-8deg)" },
  },
  {
    symbol: "π",
    className: "text-[112px] text-fuchsia-500/56 drop-shadow-[0_0_7px_rgba(217,70,239,0.16)]",
    style: { top: "32%", right: "8.8%", transform: "rotate(-10deg)" },
  },
  {
    symbol: "f(x)",
    className: "text-[72px] text-rose-500/46 drop-shadow-[0_0_5px_rgba(244,63,94,0.14)]",
    style: { top: "50%", right: "4.8%", transform: "rotate(9deg)" },
  },
  {
    symbol: "∝",
    className: "text-[74px] text-emerald-500/46 drop-shadow-[0_0_5px_rgba(16,185,129,0.14)]",
    style: { bottom: "30%", left: "16.5%", transform: "rotate(-7deg)" },
  },
  {
    symbol: "sin",
    className: "text-[70px] text-fuchsia-500/46 drop-shadow-[0_0_5px_rgba(217,70,239,0.14)]",
    style: { bottom: "30.5%", right: "16.8%", transform: "rotate(7deg)" },
  },
  {
    symbol: "∫",
    className: "text-[92px] text-cyan-500/50 drop-shadow-[0_0_6px_rgba(6,182,212,0.16)]",
    style: { bottom: "8.2%", left: "6.2%", transform: "rotate(-10deg)" },
  },
  {
    symbol: "dx",
    className: "text-[86px] text-amber-500/50 drop-shadow-[0_0_6px_rgba(245,158,11,0.16)]",
    style: { bottom: "8.5%", left: "27%", transform: "rotate(9deg)" },
  },
  {
    symbol: "∞",
    className: "text-[92px] text-indigo-500/50 drop-shadow-[0_0_6px_rgba(99,102,241,0.16)]",
    style: { bottom: "5.2%", left: "44.5%", transform: "rotate(-8deg)" },
  },
  {
    symbol: "lim",
    className: "text-[84px] text-blue-500/50 drop-shadow-[0_0_6px_rgba(59,130,246,0.16)]",
    style: { bottom: "8.5%", right: "27%", transform: "rotate(-8deg)" },
  },
  {
    symbol: "√",
    className: "text-[90px] text-emerald-500/50 drop-shadow-[0_0_6px_rgba(16,185,129,0.16)]",
    style: { bottom: "8.2%", right: "6.2%", transform: "rotate(10deg)" },
  },
];

const noop = () => {};
const EXPORT_WIDTH = 1500;
const EXPORT_HEIGHT = 1000; // 3:2
const MAX_EXPORT_BYTES = 5 * 1024 * 1024; // 5MB

function GeminiMiniMark() {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200/60 bg-white/85 shadow-sm">
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <defs>
          <linearGradient id="geminiCore" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="50%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <path
          d="M12 2.5l1.55 4.16 4.2 1.52-4.2 1.52L12 13.86l-1.55-4.16-4.2-1.52 4.2-1.52L12 2.5z"
          fill="url(#geminiCore)"
        />
        <circle cx="17.7" cy="15.8" r="2.1" fill="#34D399" />
        <circle cx="6.2" cy="16.4" r="1.9" fill="#F59E0B" />
      </svg>
    </span>
  );
}

export default function ThumbnailPage() {
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const dataUrlToBlob = async (dataUrl: string) => {
    const res = await fetch(dataUrl);
    return res.blob();
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadThumbnail = async (format: "png" | "jpg") => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const renderBase = {
        cacheBust: true,
        pixelRatio: 1,
        backgroundColor: "#f5f5f5",
        canvasWidth: EXPORT_WIDTH,
        canvasHeight: EXPORT_HEIGHT,
      };

      if (format === "png") {
        const pngDataUrl = await toPng(exportRef.current, renderBase);
        const pngBlob = await dataUrlToBlob(pngDataUrl);
        if (pngBlob.size <= MAX_EXPORT_BYTES) {
          triggerDownload(pngBlob, `proofmesh-thumbnail-${EXPORT_WIDTH}x${EXPORT_HEIGHT}.png`);
          return;
        }

        // Fallback: if PNG is too heavy, export as JPEG under the 5MB target.
        const jpegDataUrl = await toJpeg(exportRef.current, {
          ...renderBase,
          quality: 0.9,
        });
        const jpegBlob = await dataUrlToBlob(jpegDataUrl);
        triggerDownload(jpegBlob, `proofmesh-thumbnail-${EXPORT_WIDTH}x${EXPORT_HEIGHT}.jpg`);
        return;
      }

      const jpegDataUrl = await toJpeg(exportRef.current, {
        ...renderBase,
        quality: 0.92,
      });
      const jpegBlob = await dataUrlToBlob(jpegDataUrl);
      triggerDownload(jpegBlob, `proofmesh-thumbnail-${EXPORT_WIDTH}x${EXPORT_HEIGHT}.jpg`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-6 md:p-10">
      <div className="mx-auto w-full max-w-[1400px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2">
          <div className="text-xs text-neutral-600">Export 3:2 (1500x1000) with margin, max 5MB target</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadThumbnail("png")}
              disabled={exporting}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
            >
              {exporting ? "Exporting..." : "Download PNG"}
            </button>
            <button
              type="button"
              onClick={() => downloadThumbnail("jpg")}
              disabled={exporting}
              className="rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {exporting ? "Exporting..." : "Download JPG"}
            </button>
          </div>
        </div>

        <div
          ref={exportRef}
          className="relative aspect-[3/2] overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-100 p-5 shadow-[0_40px_100px_-35px_rgba(0,0,0,0.45)]"
        >
          <div className="relative h-full w-full overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-white/58 via-white/12 to-white/68" />
            <div className="pointer-events-none absolute inset-0 z-21 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.32)_45%,rgba(255,255,255,0.06)_100%)]" />

            <div className="absolute left-0 top-0 z-30 flex w-full items-center border-b border-neutral-200 bg-white/88 px-4 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                </div>
                <div className="text-[11px] font-medium tracking-wide text-neutral-600">
                  Built for collaborative math proving
                </div>
              </div>
            </div>

            <div className="absolute inset-0 z-10 pt-12">
              <div className="h-full w-full scale-[1.01] blur-[1.8px]">
                <ProofCanvasV2
                  nodes={THUMBNAIL_NODES}
                  edges={THUMBNAIL_EDGES}
                  selectedNodeId={null}
                  onNodeSelect={noop}
                  readOnly={true}
                  disableInteraction={true}
                  hideZoomControls={true}
                  hideMinimap={true}
                  hideHelpText={true}
                />
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 z-25">
              {MATH_SYMBOLS.map((item, index) => (
                <span
                  key={`${item.symbol}-${index}`}
                  className={`absolute select-none font-semibold leading-none ${item.className}`}
                  style={item.style}
                >
                  {item.symbol}
                </span>
              ))}
            </div>

            <div className="absolute inset-x-0 top-1/2 z-40 -translate-y-1/2 px-8 text-center">
              <div className="mx-auto max-w-[1080px] rounded-2xl border border-white/65 bg-white/70 px-8 py-7 shadow-[0_16px_45px_-30px_rgba(0,0,0,0.35)] backdrop-blur-[1.5px]">
                <h1 className="text-[136px] md:text-[172px] leading-none font-semibold tracking-tight text-neutral-950">
                  ProofMesh
                </h1>
                <p className="mx-auto mt-3 max-w-4xl text-[56px] leading-[1.06] font-bold text-neutral-900">
                  Collaborative math proving
                  <br />
                  <span className="bg-[linear-gradient(180deg,transparent_56%,rgba(59,130,246,0.34)_56%)] px-2 text-neutral-900">
                    AI-assisted verification
                  </span>
                </p>
                <div className="mt-4 flex items-center justify-center gap-3 text-[40px] font-bold tracking-wide text-indigo-700">
                  <GeminiMiniMark />
                  <span>Built for Gemini 3 Hackathon 2026</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
