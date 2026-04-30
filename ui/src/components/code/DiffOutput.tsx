import React from 'react';

interface DiffOutputProps {
  args: any;
  result: any;
  isWrite?: boolean;
}

interface Edit {
  targetString: string;
  replacementString: string;
}

function DiffBlock({ targetString, replacementString }: Edit) {
  const removed = targetString.split('\n');
  const added = replacementString.split('\n');

  return (
    <div className="font-mono text-sm">
      {removed.map((line, i) => (
        <div key={`r-${i}`} className="bg-[#3d1f1f] text-red-300 px-3 py-0.5 whitespace-pre-wrap break-words">
          <span className="select-none text-red-500 mr-2">-</span>{line}
        </div>
      ))}
      {added.map((line, i) => (
        <div key={`a-${i}`} className="bg-[#1f3d1f] text-green-300 px-3 py-0.5 whitespace-pre-wrap break-words">
          <span className="select-none text-green-500 mr-2">+</span>{line}
        </div>
      ))}
    </div>
  );
}

export default function DiffOutput({ args, result, isWrite }: DiffOutputProps) {
  const filePath = args?.path ?? args?.file_path ?? '';

  if (isWrite) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
        <div className="px-3 py-2 flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-800">
            wrote
          </span>
          <span className="text-sm font-mono text-[#c9d1d9]">{filePath}</span>
        </div>
      </div>
    );
  }

  const edits: Edit[] = args?.edits
    ? args.edits
    : args?.targetString != null
      ? [{ targetString: args.targetString, replacementString: args.replacementString ?? '' }]
      : [];

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
      {filePath && (
        <div className="px-3 py-1.5 text-xs font-mono text-[#8b949e] border-b border-[#30363d] bg-[#1c2129]">
          {filePath}
        </div>
      )}

      <div className="max-h-[500px] overflow-y-auto divide-y divide-[#30363d]">
        {edits.map((edit, i) => (
          <DiffBlock key={i} {...edit} />
        ))}
        {edits.length === 0 && (
          <pre className="px-3 py-2 text-sm font-mono text-[#c9d1d9] whitespace-pre-wrap">
            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
