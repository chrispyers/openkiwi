import React, { useState } from 'react';

interface BashOutputProps {
  result: any;
}

function truncateLines(text: string, maxLines: number, showFirst: number, showLast: number) {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return { text, totalLines: lines.length, truncated: false };
  const top = lines.slice(0, showFirst);
  const bottom = lines.slice(-showLast);
  return {
    text: top.join('\n') + '\n' + bottom.join('\n'),
    totalLines: lines.length,
    truncated: true,
  };
}

export default function BashOutput({ result }: BashOutputProps) {
  const [expanded, setExpanded] = useState(false);

  if (!result) return null;

  const hasError = result.error;
  const stdout = result.stdout ?? result.output ?? (typeof result === 'string' ? result : '');
  const stderr = result.stderr ?? '';
  const exitCode = result.exitCode ?? 0;

  const stdoutInfo = truncateLines(stdout, 200, 50, 50);
  const displayStdout = expanded ? stdout : stdoutInfo.text;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
      {exitCode !== 0 && (
        <div className="px-3 py-1 bg-[#3d1f1f] border-b border-[#30363d] text-red-400 text-xs font-mono">
          Exit code: {exitCode}
        </div>
      )}

      {hasError && (
        <pre className="px-3 py-2 text-sm font-mono text-red-400 whitespace-pre-wrap break-words">
          {result.error}
        </pre>
      )}

      {stdout && (
        <pre className="px-3 py-2 text-sm font-mono text-[#c9d1d9] whitespace-pre-wrap break-words max-h-[500px] overflow-y-auto">
          {displayStdout}
        </pre>
      )}

      {stderr && (
        <pre className="px-3 py-2 text-sm font-mono text-orange-400 whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto border-t border-[#30363d]">
          {stderr}
        </pre>
      )}

      {stdoutInfo.truncated && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full px-3 py-1.5 text-xs font-mono text-blue-400 hover:text-blue-300 bg-[#1c2129] border-t border-[#30363d] cursor-pointer"
        >
          Show all {stdoutInfo.totalLines} lines
        </button>
      )}
    </div>
  );
}
