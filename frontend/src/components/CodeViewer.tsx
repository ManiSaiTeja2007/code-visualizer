import React from "react";

const TOOLTIP_DICTIONARY: Record<string, string> = {
  "factorial": "factorial(n): Calculates the product of all integers from 1 to n (e.g. 4! = 4 * 3 * 2 * 1 = 24). Click Next/Autoplay to step inside!",
  "main": "main(): The entry point function where execution begins. For C/C++ textbook code, execution starts in main().",
  "print": "print(...): Prints text output to the console (stdout) for verification.",
  "printf": "printf(...): Formats and prints text to standard output. A standard C library console output tool.",
  "malloc": "malloc(size): Allocates dynamic memory on the Heap. The block stays active until explicitly freed. Missing free() causes a Memory Leak!",
  "free": "free(ptr): Releases/frees dynamic heap memory previously allocated. Crucial to prevent memory leaks.",
  "strcpy": "strcpy(dest, src): Copies a string into buffer 'dest'. Unsafe because it doesn't verify size boundaries (causes Stack Smashing Buffer Overflow if src is larger!).",
  "NULL": "NULL: Memory address 0x00000000. Accessing or writing to this address causes a Segmentation Fault (SIGSEGV) and forces a Core Dump.",
  "SELECT": "SELECT: Specifies which table columns to project into the final output dataset. Evaluated last in the SQL pipeline!",
  "FROM": "FROM: Tells the database which table to load raw data from. This is the very first step executed in a SQL query.",
  "JOIN": "JOIN: Combines records from multiple tables based on a key condition. Creates intermediate cartesian pairs to evaluate.",
  "WHERE": "WHERE: Filters records based on conditions. Executed early to reduce intermediate joined dataset sizes."
};

interface CodeViewerProps {
  code: string;
  activeLineNo: number;
  prevLineNo?: number | null;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ code, activeLineNo, prevLineNo }) => {
  const lines = code.split("\n");

  // A function to render line contents with interactive tooltips safely as JSX nodes
  const renderLineWithTooltips = (lineText: string) => {
    if (!lineText) return <span> </span>;

    // Create a regular expression matching any of the dictionary keywords
    // Sort keys descending by length to match longer words first
    const sortedKeywords = Object.keys(TOOLTIP_DICTIONARY).sort((a, b) => b.length - a.length);
    
    // We match keywords as full words using word boundaries
    const regexParts = sortedKeywords.map(k => `\\b${k}\\b`).join("|");
    const regex = new RegExp(`(${regexParts})`, "g");
    
    const parts = lineText.split(regex);
    
    return parts.map((part: string, index: number) => {
      if (TOOLTIP_DICTIONARY[part]) {
        return (
          <span key={index} className="tooltip-sym">
            {part}
            <span className="tooltip-box">{TOOLTIP_DICTIONARY[part]}</span>
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="code-container">
      {lines.map((line, idx) => {
        const lineNo = idx + 1;
        const isActive = lineNo === activeLineNo;
        const isPrev = lineNo === prevLineNo;

        let rowClass = "";
        let marker = <span className="inactive-line-marker"> </span>;

        if (isActive) {
          rowClass = "active-code-row";
          marker = <span className="active-line-marker" style={{ color: "#FF3366" }}>➔</span>;
        } else if (isPrev) {
          rowClass = "prev-code-row";
          marker = <span className="active-line-marker" style={{ color: "#00FF66" }}>➔</span>;
        }

        return (
          <div key={idx} className={`code-line ${rowClass}`}>
            {marker}
            <span className="line-number">{lineNo}</span>
            <span className="line-content">{renderLineWithTooltips(line)}</span>
          </div>
        );
      })}
    </div>
  );
};
