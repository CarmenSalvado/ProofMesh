"use client";

import { useRef, useState, useCallback, useEffect, RefObject, useMemo } from "react";

export interface ZoomPanState {
  zoom: number;
  pan: { x: number; y: number };
}

export interface UseCanvasZoomPanOptions {
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
  initialPan?: { x: number; y: number };
}

export interface UseCanvasZoomPanReturn {
  zoom: number;
  pan: { x: number; y: number };
  isPanning: boolean;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setIsPanning: (isPanning: boolean) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleFit: (nodes: Array<{ x: number; y: number; width?: number; height?: number }>) => void;
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  canvasToScreen: (x: number, y: number) => { x: number; y: number };
  handleWheelZoom: (e: WheelEvent) => void;
  startPanning: (e: React.MouseEvent) => void;
  updatePanning: (e: React.MouseEvent) => void;
  stopPanning: () => void;
  panStartRef: RefObject<{ x: number; y: number; panX: number; panY: number }>;
  minimapViewport: { left: number; top: number; width: number; height: number };
}

export function useCanvasZoomPan(
  canvasRef: RefObject<HTMLDivElement | null>,
  options: UseCanvasZoomPanOptions = {}
): UseCanvasZoomPanReturn {
  const {
    minZoom = 0.25,
    maxZoom = 3,
    initialZoom = 1,
    initialPan = { x: 50, y: 50 },
  } = options;

  const [zoom, setZoom] = useState(initialZoom);
  const [pan, setPan] = useState(initialPan);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z * 1.2, maxZoom));
  }, [maxZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z / 1.2, minZoom));
  }, [minZoom]);

  const handleFit = useCallback(
    (nodes: Array<{ x: number; y: number; width?: number; height?: number }>) => {
      if (nodes.length === 0) {
        setZoom(1);
        setPan({ x: 50, y: 50 });
        return;
      }

      const minX = Math.min(...nodes.map((n) => n.x));
      const minY = Math.min(...nodes.map((n) => n.y));
      const maxX = Math.max(...nodes.map((n) => n.x + (n.width || 260)));
      const maxY = Math.max(...nodes.map((n) => n.y + (n.height || 140)));

      const width = maxX - minX + 100;
      const height = maxY - minY + 100;

      const canvasWidth = canvasRef.current?.clientWidth || 800;
      const canvasHeight = canvasRef.current?.clientHeight || 600;

      const scaleX = canvasWidth / width;
      const scaleY = canvasHeight / height;
      const scale = Math.min(scaleX, scaleY, 1.5);

      setZoom(scale);
      setPan({
        x: (canvasWidth - width * scale) / 2 - minX * scale + 50,
        y: (canvasHeight - height * scale) / 2 - minY * scale + 50,
      });
    },
    [canvasRef]
  );

  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (screenX - rect.left - pan.x) / zoom,
        y: (screenY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom, canvasRef]
  );

  const canvasToScreen = useCallback(
    (x: number, y: number) => {
      return {
        x: x * zoom + pan.x,
        y: y * zoom + pan.y,
      };
    },
    [pan, zoom]
  );

  const handleWheelZoom = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom((z) => Math.max(minZoom, Math.min(maxZoom, z * delta)));
      } else {
        setPan((p) => ({
          x: p.x - e.deltaX,
          y: p.y - e.deltaY,
        }));
      }
    },
    [minZoom, maxZoom]
  );

  const startPanning = useCallback(
    (e: React.MouseEvent) => {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan]
  );

  const updatePanning = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    });
  }, [isPanning]);

  const stopPanning = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Attach wheel listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", handleWheelZoom, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheelZoom);
  }, [handleWheelZoom, canvasRef]);

  // Memoize minimap viewport
  const minimapViewport = useMemo(() => {
    return {
      left: Math.max(0, (-pan.x / 2500 / zoom) * 100),
      top: Math.max(0, (-pan.y / 1800 / zoom) * 100),
      width: Math.min(100, (100 / zoom) * 0.8),
      height: Math.min(100, (100 / zoom) * 0.8),
    };
  }, [pan, zoom]);

  return {
    zoom,
    pan,
    isPanning,
    setZoom,
    setPan,
    setIsPanning,
    handleZoomIn,
    handleZoomOut,
    handleFit,
    screenToCanvas,
    canvasToScreen,
    handleWheelZoom,
    startPanning,
    updatePanning,
    stopPanning,
    panStartRef,
    minimapViewport,
  };
}
