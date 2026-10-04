import { useCallback, useRef } from "react";
import { LiquidGlass, LiquidInteractive } from "./index";
import type { LiquidGlassOptions } from "./core/types";
import "./liquid-glass.css";

type GlassRef<T extends HTMLElement> = (node: T | null) => void;

/**
 * React bridge for the framework-agnostic Liquid Glass engine.
 * Each surface owns one engine instance and cleans it up when React removes it.
 */
export function useLiquidGlass<T extends HTMLElement>(
  options: LiquidGlassOptions = {},
  interactive = false,
): GlassRef<T> {
  const glassRef = useRef<LiquidGlass | null>(null);
  const interactiveRef = useRef<LiquidInteractive | null>(null);
  const optionsRef = useRef(options);

  return useCallback((node: T | null) => {
    interactiveRef.current?.destroy();
    interactiveRef.current = null;
    glassRef.current?.destroy();
    glassRef.current = null;

    if (!node) return;

    glassRef.current = new LiquidGlass(node, optionsRef.current);
    if (interactive) {
      interactiveRef.current = new LiquidInteractive(node);
    }
  }, [interactive]);
}

export function LiquidGlassBackdrop({
  className = "",
  options,
}: {
  className?: string;
  options?: LiquidGlassOptions;
}) {
  const ref = useLiquidGlass<HTMLDivElement>(options ?? {}, false);
  return (
    <div
      ref={ref}
      className={"liquid-glass cookie-liquid-glass-backdrop " + className}
      aria-hidden="true"
    />
  );
}
