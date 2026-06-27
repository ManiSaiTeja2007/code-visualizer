import React from "react";

interface Variable {
  name: string;
  type: string;
  value: string;
  addr: string;
}

interface StackFrame {
  name: string;
  variables: Variable[];
}

interface HeapBlock {
  addr: string;
  size: string;
  value: string;
  label: string;
}

interface CrashDetails {
  type: string;
  msg: string;
  target: string;
}

interface MemoryVisualizerProps {
  stepData: {
    stack?: StackFrame[];
    heap?: HeapBlock[];
    crash?: CrashDetails | null;
  };
  showAddresses: boolean;
}

export const MemoryVisualizer: React.FC<MemoryVisualizerProps> = ({
  stepData,
  showAddresses
}) => {
  const stack = stepData?.stack || [];
  const heap = stepData?.heap || [];
  const crash = stepData?.crash || null;

  const svgWidth = 800;
  const svgHeight = 440;

  // Coordinate mapping for 3D pointer lines
  const addrToCoords: Record<string, [number, number]> = {};
  const ptrCoords: Array<{
    fromAddr: string;
    toAddr: string;
    fromCoord: [number, number];
    isNull: boolean;
  }> = [];

  // Theme styling configurations
  const text_primary = "#E2E8F0";
  const text_secondary = "#94A3B8";
  const accent_green = "#00FF66";
  const accent_blue = "#00F0FF";
  const accent_red = "#FF3366";
  const accent_purple = "#A855F7";

  // Helper to draw a 3D block/prism in SVG
  const render3DBlock = (
    x: number,
    y: number,
    w: number,
    h: number,
    d: number,
    fillFront: string,
    fillTop: string,
    fillSide: string,
    strokeColor: string,
    key: string,
    glow: boolean = false
  ) => {
    const topPoints = `${x},${y} ${x + d},${y - d} ${x + w + d},${y - d} ${x + w},${y}`;
    const sidePoints = `${x + w},${y} ${x + w + d},${y - d} ${x + w + d},${y - d + h} ${x + w},${y + h}`;
    const filter = glow ? "url(#glow-filter)" : undefined;

    return (
      <g key={key} filter={filter}>
        {/* Top Face */}
        <polygon points={topPoints} fill={fillTop} stroke={strokeColor} strokeWidth="1" />
        {/* Side Face */}
        <polygon points={sidePoints} fill={fillSide} stroke={strokeColor} strokeWidth="1" />
        {/* Front Face */}
        <rect x={x} y={y} width={w} height={h} fill={fillFront} stroke={strokeColor} strokeWidth="1" />
      </g>
    );
  };

  // 1. Stack grows upwards from the bottom of the board
  // We stack 3D blocks on top of each other
  let stackY = 360; // Start near the bottom
  const stackElements: React.ReactNode[] = [];

  stack.forEach((frame, frameIdx) => {
    const frameName = frame.name || "main";
    const varsList = frame.variables || [];
    
    // Draw stack variables stacking upwards
    varsList.forEach((variable) => {
      const varName = variable.name;
      const varType = variable.type;
      const varVal = variable.value;
      const varAddr = variable.addr;

      const isPtr = varType.includes("*");
      const isNullptr =
        isPtr &&
        (varVal === "NULL" || varVal === "0x0" || varVal === "0x00000000");

      const isCrashTarget = isNullptr && crash;

      // Color scheme for 3D blocks
      let front = "#1E1B4B";
      let top = "#312E81";
      let side = "#0B0A1A";
      let stroke = "#4F46E5";

      if (isPtr) {
        front = isCrashTarget ? "#4C0519" : "#3B0764";
        top = isCrashTarget ? "#881337" : "#581C87";
        side = "#140224";
        stroke = isCrashTarget ? accent_red : accent_purple;
      }

      // Height of each 3D block
      const blockH = 30;
      const depth = 8;

      // Coordinates for text placement on Front Face
      const tx = 50;
      const ty = stackY;

      // Save connector coords (connecting from the side/right face center)
      addrToCoords[varAddr] = [xCoordForStack(tx), ty + blockH / 2];

      if (isPtr) {
        ptrCoords.push({
          fromAddr: varAddr,
          toAddr: varVal,
          fromCoord: [tx + 270 + depth, ty - depth / 2 + blockH / 2],
          isNull: isNullptr
        });
      }

      // Render the 3D variable brick
      stackElements.push(
        <g key={varAddr} className="transition-all duration-300">
          {render3DBlock(tx, ty, 270, blockH, depth, front, top, side, stroke, `blk-${varAddr}`, !!isCrashTarget)}
          {showAddresses && (
            <text x={tx + 8} y={ty + 18} fill="#64748B" fontSize="10" fontFamily="monospace">
              {varAddr}
            </text>
          )}
          <text x={tx + 75} y={ty + 18} fill={text_primary} fontSize="11" fontWeight="500">
            {varType} {varName} =
          </text>
          <text
            x={tx + 200}
            y={ty + 18}
            fill={isPtr ? (isNullptr ? accent_red : accent_blue) : accent_green}
            fontSize="11"
            fontWeight="bold"
          >
            {varVal}
          </text>
        </g>
      );

      // Decrement y coordinate to grow stack upwards (along negative Y axis)
      stackY -= (blockH + depth + 6);
    });

    // Label for the function scope frame
    if (varsList.length > 0) {
      stackElements.push(
        <text
          key={`frame-lbl-${frameIdx}`}
          x="50"
          y={stackY + 12}
          fill={text_secondary}
          fontSize="10"
          fontWeight="bold"
          letterSpacing="0.5"
          className="uppercase opacity-70"
        >
          Scope: {frameName}()
        </text>
      );
      stackY -= 15;
    }
  });

  // Helper coordinate adapter
  function xCoordForStack(x: number) {
    return x;
  }

  // 2. Heap blocks float as independent 3D blocks on the right side
  let heapY = 110;
  const heapElements = heap.map((block, blockIdx) => {
    const blockAddr = block.addr;
    const blockVal = block.value;
    const blockLabel = block.label || "malloc'd";
    const blockSize = block.size || "";

    const blockH = 36;
    const depth = 8;
    const hx = 440;
    const hy = heapY;

    // Save target coordinate for pointers (connecting to the left face center of the 3D block)
    addrToCoords[blockAddr] = [hx, hy + blockH / 2];
    heapY += (blockH + depth + 20);

    return (
      <g key={blockIdx} className="transition-all duration-300">
        {render3DBlock(
          hx,
          hy,
          300,
          blockH,
          depth,
          "#022C22", // Front
          "#047857", // Top
          "#021711", // Side
          accent_green,
          `heap-${blockAddr}`
        )}
        {showAddresses && (
          <text x={hx + 8} y={hy + 22} fill="#64748B" fontSize="10" fontFamily="monospace">
            {blockAddr}
          </text>
        )}
        <text x={hx + 85} y={hy + 22} fill={text_primary} fontSize="11">
          {blockLabel} ({blockSize}) =
        </text>
        <text x={hx + 230} y={hy + 22} fill={accent_green} fontSize="11" fontWeight="bold">
          {blockVal}
        </text>
      </g>
    );
  });

  // Calculate pointer connector curves in 3D perspective space
  const connectorElements = ptrCoords.map((p, idx) => {
    const [fromX, fromY] = p.fromCoord;
    const toAddr = p.toAddr;

    if (p.isNull) {
      if (crash) {
        return (
          <g key={`nullptr-${idx}`}>
            <line
              x1={fromX}
              y1={fromY}
              x2={fromX + 25}
              y2={fromY}
              stroke={accent_red}
              strokeWidth="2"
              strokeDasharray="2,2"
            />
            <circle cx={fromX + 25} cy={fromY} r="3" fill={accent_red} />
          </g>
        );
      }
      return null;
    }

    const targetCoord = addrToCoords[toAddr];
    if (targetCoord) {
      const [toX, toY] = targetCoord;
      const dx = toX - fromX;
      // Bezier curve path connecting from right face of stack block to left face of heap block
      const pathD = `M ${fromX} ${fromY} C ${fromX + dx * 0.3} ${fromY}, ${toX - dx * 0.3} ${toY}, ${toX} ${toY}`;

      return (
        <path
          key={`ptr-${idx}`}
          d={pathD}
          fill="none"
          stroke={accent_blue}
          strokeWidth="1.8"
          markerEnd="url(#arrow-blue)"
          opacity="0.8"
          className="transition-all duration-300"
        />
      );
    } else {
      // Wild pointer
      return (
        <g key={`wild-${idx}`}>
          <line
            x1={fromX}
            y1={fromY}
            x2={fromX + 30}
            y2={fromY}
            stroke={accent_red}
            strokeWidth="1.8"
            markerEnd="url(#arrow-red)"
          />
          <text x={fromX + 35} y={fromY + 4} fill={accent_red} fontSize="9" fontWeight="bold">
            WILD
          </text>
        </g>
      );
    }
  });

  return (
    <div className="flex justify-center w-full relative">
      <svg
        width="100%"
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        className="bg-[#0B0B16] rounded-xl border border-white/5"
        style={{
          boxShadow: "0 15px 40px rgba(0, 0, 0, 0.4)",
          fontFamily: "'JetBrains Mono', monospace"
        }}
      >
        <defs>
          <marker
            id="arrow-blue"
            viewBox="0 0 10 10"
            refX="4"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 2 L 10 5 L 0 8 z" fill={accent_blue} />
          </marker>
          <marker
            id="arrow-red"
            viewBox="0 0 10 10"
            refX="4"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 2 L 10 5 L 0 8 z" fill={accent_red} />
          </marker>
          <linearGradient id="glow-red" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF3366" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0B0B16" stopOpacity="0.9" />
          </linearGradient>
          <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 3D Stack Container Outline */}
        <g>
          {/* Base plate */}
          <polygon points="30,400 38,392 378,392 370,400" fill="#14142B" stroke="#222244" />
          {/* Back Wall */}
          <rect x="38" y="60" width="340" height="332" fill="#0C0C1B" opacity="0.6" />
          <line x1="38" y1="60" x2="38" y2="392" stroke="#222244" />
          <line x1="378" y1="60" x2="378" y2="392" stroke="#222244" />
          <text x="50" y="48" fill={accent_purple} fontSize="12" fontWeight="bold" letterSpacing="0.8">
            STACK MEMORY
          </text>
        </g>

        {/* 3D Heap Container Outline */}
        <g>
          {/* Base plate */}
          <polygon points="420,400 428,392 768,392 760,400" fill="#0B1A24" stroke="#162E3B" />
          {/* Back Wall */}
          <rect x="428" y="60" width="340" height="332" fill="#081017" opacity="0.6" />
          <line x1="428" y1="60" x2="428" y2="392" stroke="#162E3B" />
          <line x1="768" y1="60" x2="768" y2="392" stroke="#162E3B" />
          <text x="440" y="48" fill={accent_blue} fontSize="12" fontWeight="bold" letterSpacing="0.8">
            HEAP MEMORY
          </text>
        </g>

        {/* Stack 3D Bricks */}
        {stackElements}

        {/* Heap 3D Bricks */}
        {heapElements}

        {/* Pointer paths */}
        {connectorElements}

        {/* Segment violation Overlay */}
        {crash && (
          <g>
            <rect
              x="10"
              y="10"
              width={svgWidth - 20}
              height={svgHeight - 20}
              rx="12"
              fill="url(#glow-red)"
              stroke={accent_red}
              strokeWidth="2"
            />
            {/* Crash dialog */}
            <g transform="translate(150, 90)">
              <rect x="0" y="0" width="500" height="230" rx="8" fill="#1C0A10" stroke={accent_red} strokeWidth="1.5" />
              <text x="250" y="32" fill={accent_red} fontSize="15" fontWeight="bold" textAnchor="middle" letterSpacing="1">
                💥 SEGMENTATION FAULT (SIGSEGV)
              </text>
              <text x="30" y="65" fill={text_primary} fontSize="12" fontWeight="bold">
                Access Violation:
              </text>
              <text x="30" y="85" fill={text_secondary} fontSize="11" fontFamily="monospace">
                - Message: {crash.msg}
              </text>
              <text x="30" y="105" fill={text_secondary} fontSize="11" fontFamily="monospace">
                - Memory Target: {crash.target}
              </text>
              
              <rect x="25" y="125" width="450" height="80" rx="4" fill="#0A0305" stroke="#4C121A" strokeWidth="1" />
              <text x="35" y="142" fill={accent_purple} fontSize="10" fontWeight="bold">
                Memory Corruption Post-Mortem:
              </text>
              <text x="35" y="160" fill={text_secondary} fontSize="9">
                The application attempted to read or write to an invalid address (e.g. nullptr).
              </text>
              <text x="35" y="175" fill={text_secondary} fontSize="9">
                The CPU MMU caught the instruction and generated a hardware interrupt trap,
              </text>
              <text x="35" y="190" fill={text_secondary} fontSize="9">
                causing the OS kernel to instantly terminate the thread with a Core Dump.
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
