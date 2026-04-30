import React, { useState } from 'react';

interface GrepOutputProps {
  args: any;
  result: any;
}

interface GrepMatch {
  file: string;
  line: string;
  content: string;
}

function parseGrepOutput(raw: string): GrepMatch[] {
  const matches: GrepMatch[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const match = line.match(/^(.+?):(\d+):(.*)$/);
    if (match) {
      matches.push({ file: match[1], line: match[2], content: match[3] });
    }
  }
  return matches;
}

function groupByFile(matches: GrepMatch[]): Map<string, GrepMatch[]> {
  const groups = new Map<string, GrepMatch[]>();
  for (const m of matches) {
    const existing = groups.get(m.file);
    if (existing) existing.push(m);
    else groups.set(m.file, [m]);
  }
  return groups;
}

export default function GrepOutput({ args, result }: GrepOutputProps) {
  const [expanded, setExpanded] = useState(false);

  const raw = typeof result === 'string' ? result : result?.output ?? result?.matches ?? '';
  if (!raw) return null;

  const allMatches = parseGrepOutput(raw);

  if (allMatches.length === 0) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-md p-3">
        <pre className="text-sm font-mono text-[#c9d1d9] whitespace-pre-wrap break-words">{raw}</pre>
      </div>
    );
  }

  const truncated = allMatches.length > 50 && !expanded;
  const displayMatches = truncated ? allMatches.slice(0, 20) : allMatches;
  const grouped = groupByFile(displayMatches);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden max-h-[500px] overflow-y-auto">
      {Array.from(grouped.entries()).map(([file, matches]) => (
        <div key={file}>
          <div className="px-3 py-1.5 text-xs font-mono text-[#8b949e] bg-[#1c2129] border-b border-[#30363d] sticky top-0">
            {file}
          </div>
          {matches.map((m, i) => (
            <div key={i} className="px-3 py-0.5 text-sm font-mono text-[#c9d1d9] hover:bg-[#1c2129] flex">
              <span className="text-[#8b949e] select-none mr-3 min-w-[3rem] text-right">{m.line}</span>
              <span className="whitespace-pre-wrap break-words">{m.content}</span>
            </div>
          ))}
        </div>
      ))}

      {truncated && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full px-3 py-1.5 text-xs font-mono text-blue-400 hover:text-blue-300 bg-[#1c2129] border-t border-[#30363d] cursor-pointer sticky bottom-0"
        >
          Show all {allMatches.length} matches
        </button>
      )}
    </div>
  );
}
