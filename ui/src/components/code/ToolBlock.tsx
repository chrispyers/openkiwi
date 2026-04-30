import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTerminal, faEye, faPen, faMagnifyingGlass, faFolder, faGlobe,
  faBoltLightning, faChevronDown, faChevronRight, faBrain, faScroll
} from '@fortawesome/free-solid-svg-icons';
import ToolOutputRenderer from './ToolOutputRenderer';

interface ToolBlockProps {
  name: string;
  args: any;
  result: any;
  durationMs?: number;
  success?: boolean;
}

function getBasename(filePath: string): string {
  if (!filePath) return '';
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return filePath;
  return '…/' + parts.slice(-2).join('/');
}

function getToolMeta(name: string, args: any): { icon: any; summary: string } {
  try {
    switch (name) {
      case 'bash':
        return { icon: faTerminal, summary: `$ ${args?.command || ''}` };
      case 'read':
        return { icon: faEye, summary: getBasename(args?.path || args?.file_path || '') };
      case 'write':
        return { icon: faPen, summary: getBasename(args?.path || args?.file_path || '') };
      case 'edit':
      case 'multi_edit':
        return { icon: faPen, summary: getBasename(args?.path || args?.file_path || '') };
      case 'grep':
        return { icon: faMagnifyingGlass, summary: `"${args?.pattern || ''}"` };
      case 'glob':
        return { icon: faMagnifyingGlass, summary: `"${args?.pattern || ''}"` };
      case 'ls':
        return { icon: faFolder, summary: getBasename(args?.path || '.') };
      case 'web_fetch':
        return { icon: faGlobe, summary: args?.url || '' };
      case 'web_search':
        return { icon: faMagnifyingGlass, summary: `"${args?.query || ''}"` };
      case 'memory_search':
        return { icon: faBrain, summary: `"${args?.query || ''}"` };
      case 'execute_workflow':
      case 'list_workflows':
        return { icon: faScroll, summary: name };
      default:
        return { icon: faBoltLightning, summary: name };
    }
  } catch {
    return { icon: faBoltLightning, summary: name };
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ToolBlock({ name, args, result, durationMs, success }: ToolBlockProps) {
  const hasError = success === false || (result && typeof result === 'object' && result.error);
  const [isExpanded, setIsExpanded] = useState(hasError);
  const { icon, summary } = getToolMeta(name, args);

  return (
    <div className="my-1.5">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-t-md text-left font-mono text-xs cursor-pointer transition-colors ${
          isExpanded ? 'rounded-b-none' : 'rounded-b-md'
        } ${
          hasError
            ? 'bg-[#2d1515] border border-red-900/50 hover:bg-[#3d1f1f] text-red-300'
            : 'bg-[#1c2129] border border-[#30363d] hover:bg-[#252d38] text-[#8b949e]'
        }`}
      >
        <FontAwesomeIcon
          icon={isExpanded ? faChevronDown : faChevronRight}
          className="w-2.5 text-[#484f58]"
        />
        <FontAwesomeIcon icon={icon} className={`w-3 ${hasError ? 'text-red-400' : 'text-[#58a6ff]'}`} />
        <span className={`font-semibold ${hasError ? 'text-red-300' : 'text-[#c9d1d9]'}`}>{name}</span>
        <span className="truncate flex-1 text-[#8b949e]">{summary}</span>
        {durationMs != null && (
          <span className="text-[#484f58] ml-auto shrink-0">{formatDuration(durationMs)}</span>
        )}
      </button>

      {isExpanded && result != null && (
        <div className="border border-t-0 border-[#30363d] rounded-b-md overflow-hidden">
          <ToolOutputRenderer name={name} args={args} result={result} />
        </div>
      )}
    </div>
  );
}
