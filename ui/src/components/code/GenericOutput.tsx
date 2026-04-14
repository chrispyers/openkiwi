import React from 'react';

interface GenericOutputProps {
  result: any;
}

export default function GenericOutput({ result }: GenericOutputProps) {
  if (result == null) return null;

  const hasError = typeof result === 'object' && result.error;
  const content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

  return (
    <div
      className={`bg-[#161b22] border rounded-md overflow-hidden ${
        hasError ? 'border-red-800 border-l-4 border-l-red-500' : 'border-[#30363d]'
      }`}
    >
      <pre
        className={`px-3 py-2 text-sm font-mono whitespace-pre-wrap break-words max-h-[500px] overflow-y-auto ${
          hasError ? 'text-red-400' : 'text-[#c9d1d9]'
        }`}
      >
        {content}
      </pre>
    </div>
  );
}
