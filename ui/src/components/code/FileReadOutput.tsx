import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface FileReadOutputProps {
  args: any;
  result: any;
}

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  sql: 'sql',
};

function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_LANG[ext] ?? 'text';
}

export default function FileReadOutput({ args, result }: FileReadOutputProps) {
  const [expanded, setExpanded] = useState(false);

  const content = typeof result === 'string' ? result : result?.content ?? '';
  const filePath = args?.path ?? args?.file_path ?? '';
  const language = getLanguage(filePath);

  const lines = content.split('\n');
  const totalLines = lines.length;
  const truncated = totalLines > 100 && !expanded;
  const displayContent = truncated ? lines.slice(0, 50).join('\n') : content;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
      {filePath && (
        <div className="px-3 py-1.5 text-xs font-mono text-[#8b949e] border-b border-[#30363d] bg-[#1c2129]">
          {filePath}
        </div>
      )}

      <div className="max-h-[500px] overflow-y-auto">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers
          customStyle={{
            margin: 0,
            padding: '0.5rem',
            background: '#161b22',
            fontSize: '0.875rem',
          }}
        >
          {displayContent}
        </SyntaxHighlighter>
      </div>

      {truncated && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full px-3 py-1.5 text-xs font-mono text-blue-400 hover:text-blue-300 bg-[#1c2129] border-t border-[#30363d] cursor-pointer"
        >
          Show all {totalLines} lines
        </button>
      )}
    </div>
  );
}
