import React from 'react';
import BashOutput from './BashOutput';
import FileReadOutput from './FileReadOutput';
import DiffOutput from './DiffOutput';
import GrepOutput from './GrepOutput';
import GenericOutput from './GenericOutput';

interface ToolOutputRendererProps {
  name: string;
  args: any;
  result: any;
}

export default function ToolOutputRenderer({ name, args, result }: ToolOutputRendererProps) {
  switch (name) {
    case 'bash':
      return <BashOutput result={result} />;
    case 'read':
      return <FileReadOutput args={args} result={result} />;
    case 'edit':
    case 'multi_edit':
      return <DiffOutput args={args} result={result} />;
    case 'write':
      return <DiffOutput args={args} result={result} isWrite />;
    case 'grep':
      return <GrepOutput args={args} result={result} />;
    default:
      return <GenericOutput result={result} />;
  }
}
