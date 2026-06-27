import React, { useEffect, useRef } from "react";

interface ControlFlowGraphProps {
  cfgGraphs: Record<string, string>;
  activeLine: number;
  activeScope: string;
}

export const ControlFlowGraph: React.FC<ControlFlowGraphProps> = ({
  cfgGraphs,
  activeLine,
  activeScope
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentSvg = cfgGraphs[activeScope] || cfgGraphs["global"] || "";

  useEffect(() => {
    if (!containerRef.current || !currentSvg) return;

    // 1. Clear previous active highlights
    const previousHighlights = containerRef.current.querySelectorAll(".active-cfg-node");
    previousHighlights.forEach((el) => {
      el.classList.remove("active-cfg-node");
      const shape = el.querySelector("polygon, rect, ellipse, path");
      if (shape) {
        shape.setAttribute("stroke", "#333355");
        shape.setAttribute("stroke-width", "1.5");
        shape.removeAttribute("filter");
      }
      const text = el.querySelector("text");
      if (text) {
        text.setAttribute("fill", "#CCCCCC");
        text.removeAttribute("font-weight");
      }
    });

    // 2. Locate nodes for current active line (using attribute selectors for duplicate safety)
    const activeNodes = containerRef.current.querySelectorAll(`[id='cfg_node_${activeLine}']`);
    if (activeNodes.length > 0) {
      activeNodes.forEach((node) => {
        node.classList.add("active-cfg-node");
        const shape = node.querySelector("polygon, rect, ellipse, path");
        if (shape) {
          shape.setAttribute("stroke", "#FF3366");
          shape.setAttribute("stroke-width", "3");
          shape.setAttribute("filter", "drop-shadow(0 0 8px rgba(255, 51, 102, 0.8))");
        }
        const text = node.querySelector("text");
        if (text) {
          text.setAttribute("fill", "#FFFFFF");
          text.setAttribute("font-weight", "bold");
        }
      });

      // Smooth scroll the first active node into center if container overflows
      activeNodes[0].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest"
      });
    }
  }, [currentSvg, activeLine]);

  return (
    <div className="flex flex-col items-center justify-center p-4 border border-white/5 rounded-xl bg-slate-950/40 min-h-[300px] overflow-hidden relative">
      {!currentSvg ? (
        <div className="text-slate-500 text-sm">
          No control flow graph precompiled.
        </div>
      ) : (
        <div
          ref={containerRef}
          key={activeScope} // Triggers re-mount and CSS zoom-in animation when active scope transitions
          className="w-full overflow-auto flex justify-center py-2 transition-all duration-500 ease-out transform scale-100 opacity-100 animate-zoom-in"
          dangerouslySetInnerHTML={{ __html: currentSvg }}
          style={{
            transformOrigin: "center center"
          }}
        />
      )}
    </div>
  );
};
