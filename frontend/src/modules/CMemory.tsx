import React, { useState, useEffect, useRef } from "react";
import { CodeViewer } from "../components/CodeViewer";
import { PlaybackControls } from "../components/PlaybackControls";
import { MemoryVisualizer } from "../components/MemoryVisualizer";
import { Terminal, Lightbulb, Info } from "lucide-react";

interface LessonData {
  code: string;
  steps: any[];
}

const LESSONS: Record<string, LessonData> = {
  "1. Dereferencing NULL pointer (SIGSEGV)": {
    code: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int *ptr = NULL;
    *ptr = 42; // Access Violation!
    return 0;
}`,
    steps: [
      {
        line: 4,
        description: "The execution enters main(). The operating system allocates the stack frame for main in local memory. All local variables declared in main will live here.",
        stack: [{"name": "main", "variables": []}],
        heap: [],
        crash: null
      },
      {
        line: 5,
        description: "Declaring 'int *ptr = NULL'. A pointer variable 'ptr' is pushed onto the stack. Since it's initialized to NULL, it contains memory address 0x00000000 (representing 'nothing'). It is safe until we try to read/write through it.",
        stack: [{"name": "main", "variables": [{"name": "ptr", "type": "int*", "value": "0x00000000", "addr": "0x7ffe10"}]}],
        heap: [],
        crash: null
      },
      {
        line: 6,
        description: "CRASH INITIATED! The code dereferences ptr: '*ptr = 42'. The CPU tries to write the integer 42 to the RAM address stored in ptr (0x00000000). The Memory Management Unit (MMU) catches this access to page zero, which is reserved and protected for safety. It sends a SIGSEGV signal, halting program execution.",
        stack: [{"name": "main", "variables": [{"name": "ptr", "type": "int*", "value": "0x00000000", "addr": "0x7ffe10"}]}],
        heap: [],
        crash: { type: "SIGSEGV (Segmentation Fault)", msg: "Dereferencing NULL pointer (0x0)", target: "0x00000000" }
      }
    ]
  },
  "2. Buffer Overflow / Stack Smashing": {
    code: `#include <string.h>

int main() {
    char buf[4];
    strcpy(buf, "HELLO!"); // Overflow!
    return 0;
}`,
    steps: [
      {
        line: 3,
        description: "Entering main() frame. Stack storage allocated.",
        stack: [{"name": "main", "variables": []}],
        heap: [],
        crash: null
      },
      {
        line: 4,
        description: "Declaring 'char buf[4]'. A local array 'buf' of size 4 bytes is allocated on the stack. Directly above it sits the return address (ret_addr) which tells the CPU where to go when main() finishes (e.g. back to OS handler at 0x08048F00).",
        stack: [{
          name: "main",
          variables: [
            { name: "buf[0..3]", type: "char[4]", value: "'\\0','\\0','\\0','\\0'", addr: "0x7ffe10" },
            { name: "ret_addr", type: "void*", value: "0x08048F00", addr: "0x7ffe14" }
          ]
        }],
        heap: [],
        crash: null
      },
      {
        line: 5,
        description: "Calling 'strcpy(buf, \"HELLO!\")'. strcpy writes the string into 'buf' character-by-character. Since 'HELLO!' is 6 characters + 1 null-terminator (7 bytes total) and 'buf' is only 4 bytes, the write overflows. The extra bytes ('O', '!', '\\0') overwrite the neighboring Return Address, corrupting it to 0x004F2100 ('O', '!')!",
        stack: [{
          name: "main",
          variables: [
            { name: "buf[0..3]", type: "char[4]", value: "'H','E','L','L'", addr: "0x7ffe10" },
            { name: "ret_addr (CORRUPTED)", type: "void*", value: "0x004F2100", addr: "0x7ffe14" }
          ]
        }],
        heap: [],
        crash: null
      },
      {
        line: 6,
        description: "CRASH! The main() function reaches 'return 0;'. The CPU tries to pop the return address off the stack to jump back. But the address is corrupted to 0x004F2100. Jumping to this invalid segment triggers a memory violation. Stack Smashing is detected, the OS terminates the process and creates a Core Dump.",
        stack: [{
          name: "main",
          variables: [
            { name: "buf[0..3]", type: "char[4]", value: "'H','E','L','L'", addr: "0x7ffe10" },
            { name: "ret_addr (CORRUPTED)", type: "void*", value: "0x004F2100", addr: "0x7ffe14" }
          ]
        }],
        heap: [],
        crash: { type: "SIGSEGV (Stack Smashing)", msg: "Instruction Pointer jumped to corrupted return address 0x004F2100", target: "0x004F2100" }
      }
    ]
  },
  "3. Memory Leak (Missing free)": {
    code: `#include <stdlib.h>

void run() {
    int *p = malloc(16);
    *p = 100;
    // p goes out of scope without free(p)!
}

int main() {
    run();
    return 0;
}`,
    steps: [
      {
        line: 9,
        description: "Entering main(). The main function starts.",
        stack: [{"name": "main", "variables": []}],
        heap: [],
        crash: null
      },
      {
        line: 10,
        description: "Calling run(). A new stack frame for run() is pushed on top of main()'s frame.",
        stack: [
          { name: "main", variables: [] },
          { name: "run", variables: [] }
        ],
        heap: [],
        crash: null
      },
      {
        line: 4,
        description: "Calling 'malloc(16)'. A 16-byte block is allocated on the HEAP (dynamic memory) at address 0x8090. A pointer variable 'p' is allocated on the STACK (in run's frame) storing 0x8090.",
        stack: [
          { name: "main", variables: [] },
          { name: "run", variables: [{ name: "p", type: "int*", value: "0x8090", addr: "0x7ffe10" }] }
        ],
        heap: [{ addr: "0x8090", size: "16 bytes", value: "??", label: "malloc'd" }],
        crash: null
      },
      {
        line: 5,
        description: "Writing '*p = 100'. We dereference 'p', going to address 0x8090 on the heap, and write the value 100 inside it.",
        stack: [
          { name: "main", variables: [] },
          { name: "run", variables: [{ name: "p", type: "int*", value: "0x8090", addr: "0x7ffe10" }] }
        ],
        heap: [{ addr: "0x8090", size: "16 bytes", value: "100", label: "malloc'd" }],
        crash: null
      },
      {
        line: 6,
        description: "Exiting run() function. The stack frame of run() is popped off and destroyed, which deletes the local pointer variable 'p'. However, the heap block at 0x8090 was NEVER freed. It is now orphaned! We have leaked 16 bytes of RAM. We can no longer reference it, and it stays active until the process terminates.",
        stack: [
          { name: "main", variables: [] }
        ],
        heap: [{ addr: "0x8090", size: "16 bytes", value: "100", label: "ORPHANED / LEAKED" }],
        crash: null
      }
    ]
  }
};

export const CMemory: React.FC = () => {
  const [selectedLesson, setSelectedLesson] = useState<string>(Object.keys(LESSONS)[0]);
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(0.8);
  const [showAddresses, setShowAddresses] = useState<boolean>(true);

  const playTimerRef = useRef<any>(null);

  const lesson = LESSONS[selectedLesson];
  const steps = lesson.steps;
  const currentStep = steps[stepIdx];

  // Reset steps when lesson changes
  useEffect(() => {
    setStepIdx(0);
    setPlaying(false);
  }, [selectedLesson]);

  // Autoplay loop
  useEffect(() => {
    if (playing) {
      playTimerRef.current = setTimeout(() => {
        if (stepIdx < steps.length - 1) {
          setStepIdx(prev => prev + 1);
        } else {
          setPlaying(false);
        }
      }, speed * 1000);
    } else {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
      }
    }

    return () => {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
      }
    };
  }, [playing, stepIdx, steps.length, speed]);

  const activeLine = currentStep ? currentStep.line : 1;
  const prevLine = stepIdx > 0 && steps[stepIdx - 1] ? steps[stepIdx - 1].line : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Intro */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          💾 C Memory & Core Dump Simulator
        </h1>
        <p className="text-slate-400 text-sm max-w-4xl">
          Learn how the stack and heap layout behaves in low-level memory architecture. 
          Step through memory segmentation, pointer reference mappings, and find out what triggers a 
          <span className="text-rose-400 font-semibold"> Segmentation Fault (SIGSEGV / Core Dump)</span> and memory leaks.
        </p>
      </div>

      {/* Selector and Settings Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.01]">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Tutorial:</label>
          <select
            value={selectedLesson}
            onChange={(e) => setSelectedLesson(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-white/10 bg-slate-900/60 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/40"
          >
            {Object.keys(LESSONS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-hex"
            checked={showAddresses}
            onChange={(e) => setShowAddresses(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
          />
          <label htmlFor="show-hex" className="text-xs font-semibold text-slate-300 select-none cursor-pointer">
            Show Hex Memory Addresses
          </label>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side - Code & Step Log */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Terminal size={14} className="text-cyan-400" />
            <span>C Program Code</span>
          </div>

          <CodeViewer code={lesson.code} activeLineNo={activeLine} prevLineNo={prevLine} />

          {/* Explanation Box */}
          <div className="flex flex-col gap-2 p-4 rounded-xl border border-cyan-500/10 bg-cyan-500/[0.02] text-slate-300">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              <Lightbulb size={14} />
              <span>Step Analysis</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-300 font-medium">
              {currentStep?.description}
            </p>
          </div>
        </div>

        {/* Right Side - Playback Controls and Memory Map SVG */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Reusable Playback Bar */}
          <PlaybackControls
            stepIdx={stepIdx}
            totalSteps={steps.length}
            playing={playing}
            onPrev={() => setStepIdx(prev => Math.max(0, prev - 1))}
            onNext={() => setStepIdx(prev => Math.min(steps.length - 1, prev + 1))}
            onPlayToggle={() => setPlaying(!playing)}
            onReset={() => {
              setStepIdx(0);
              setPlaying(false);
            }}
            speed={speed}
            onSpeedChange={setSpeed}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Info size={14} className="text-cyan-400" />
              <span>RAM Memory Map (Stack & Heap Connectors)</span>
            </div>
            <MemoryVisualizer stepData={currentStep} showAddresses={showAddresses} />
          </div>
        </div>
      </div>
    </div>
  );
};
