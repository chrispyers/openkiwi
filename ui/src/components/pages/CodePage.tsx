import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTerminal, faPaperPlane, faSquare, faRotateRight, faRobot
} from '@fortawesome/free-solid-svg-icons';
import MarkdownRenderer from '../MarkdownRenderer';
import ToolBlock from '../code/ToolBlock';
import type { Message, Agent, Config } from '../../types';

interface CodePageProps {
  gatewayAddr: string;
  gatewayToken: string;
  agents: Agent[];
  config: Config | null;
  isGatewayConnected: boolean;
  getApiUrl: (path: string, addr?: string) => string;
  getWsUrl: () => string;
}

interface ToolResult {
  name: string;
  args: any;
  result: any;
  durationMs?: number;
  success?: boolean;
}

interface ToolApprovalRequest {
  id: string;
  name: string;
  args: any;
}

export default function CodePage({
  gatewayAddr,
  gatewayToken,
  agents,
  config,
  isGatewayConnected,
  getApiUrl,
  getWsUrl,
}: CodePageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolResults, setToolResults] = useState<Map<string, ToolResult>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<any>(null);
  const [lastStats, setLastStats] = useState<any>(null);
  const [pendingApproval, setPendingApproval] = useState<ToolApprovalRequest | null>(null);
  const autoApprovedToolsRef = useRef<Set<string>>(new Set());

  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-select default agent
  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      const defaultAgent = agents.find(a => a.isDefault);
      setSelectedAgentId(defaultAgent?.id || agents[0].id);
    }
  }, [agents, selectedAgentId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTool]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
      textareaRef.current.style.overflowY = scrollHeight > 200 ? 'auto' : 'hidden';
    }
  }, [inputText]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || isStreaming || !selectedAgentId) return;

    const currentInput = inputText;
    setInputText('');
    setIsStreaming(true);

    const aiResponseTimestamp = Math.floor(Date.now() / 1000);
    const newUserMsg: Message = { role: 'user', content: currentInput, timestamp: Math.floor(Date.now() / 1000) };
    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);

    const sessionToUse = sessionId || `code_${Date.now()}`;
    if (!sessionId) setSessionId(sessionToUse);

    const socket = new WebSocket(getWsUrl());
    ws.current = socket;

    socket.onopen = () => {
      const payload = {
        sessionId: sessionToUse,
        agentId: selectedAgentId,
        mode: 'code',
        messages: newMessages
          .filter(m => !m.isEphemeral)
          .map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            tool_calls: m.tool_calls,
            tool_call_id: (m as any).tool_call_id,
            name: m.name,
          })),
        shouldSummarize: false,
      };
      socket.send(JSON.stringify(payload));
    };

    socket.onerror = () => {
      setIsStreaming(false);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Check your gateway connection.',
        timestamp: Math.floor(Date.now() / 1000),
        isError: true,
      }]);
    };

    let currentAiMessage = '';
    let currentReasoning = '';
    let isInsideReasoning = false;
    let inChannelHeader = false;
    let pendingTools: any[] = [];
    let completedSegments: Message[] = [];
    let currentActiveTool: any = null;

    const buildStreamingMsgs = (): Message[] => {
      const msgs: Message[] = [...newMessages];
      if (currentReasoning) {
        msgs.push({ role: 'reasoning', content: currentReasoning, timestamp: aiResponseTimestamp });
      }
      for (const seg of completedSegments) {
        msgs.push(seg);
      }
      if (pendingTools.length > 0 || currentAiMessage) {
        msgs.push({
          role: 'assistant',
          content: currentAiMessage,
          timestamp: aiResponseTimestamp,
          tool_calls: [...pendingTools],
        } as Message);
      }
      return msgs;
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'delta') {
        const chunk = data.content;
        if (chunk.includes('<think>') || chunk.includes('<thought>') || chunk.includes('<reasoning>')) {
          isInsideReasoning = true;
        }
        if (chunk.includes('<|channel|>')) {
          isInsideReasoning = true;
          inChannelHeader = true;
        }

        if (isInsideReasoning) {
          if (inChannelHeader) {
            if (chunk.includes('<|message|>')) {
              inChannelHeader = false;
              const afterMessage = chunk.split('<|message|>').slice(1).join('').replace(/<\|im_end\|>/g, '');
              currentReasoning += afterMessage;
            }
          } else {
            currentReasoning += chunk
              .replace(/<(think|thought|reasoning)>|<\/(think|thought|reasoning)>/gi, '')
              .replace(/<\|channel\|>|<\|message\|>|<\|im_end\|>/g, '');
          }
          if (chunk.includes('</think>') || chunk.includes('</thought>') || chunk.includes('</reasoning>') || chunk.includes('<|im_end|>')) {
            isInsideReasoning = false;
            inChannelHeader = false;
          }
        } else {
          currentAiMessage += chunk;
          if (!currentReasoning && currentAiMessage.includes('</think>')) {
            const closeIdx = currentAiMessage.indexOf('</think>');
            currentReasoning = currentAiMessage.slice(0, closeIdx);
            currentAiMessage = currentAiMessage.slice(closeIdx + '</think>'.length).replace(/^\n+/, '');
          }
        }
        setMessages(buildStreamingMsgs());
      } else if (data.type === 'tool_call') {
        const toolCall = data.toolCall;
        currentActiveTool = { ...toolCall, startedAt: Date.now() };
        setActiveTool(currentActiveTool);

        // Store tool args for rendering
        const tcId = toolCall.id;
        const toolName = toolCall.function?.name || toolCall.name || '';
        let toolArgs: any = {};
        try {
          toolArgs = JSON.parse(toolCall.function?.arguments || toolCall.arguments || '{}');
        } catch { /* ignore */ }

        setToolResults(prev => {
          const next = new Map(prev);
          next.set(tcId, { name: toolName, args: toolArgs, result: null });
          return next;
        });

        setMessages(buildStreamingMsgs());
      } else if (data.type === 'tool_end') {
        if (currentActiveTool) {
          const completedTool = { ...currentActiveTool, durationMs: data.durationMs };
          currentActiveTool = null;
          setActiveTool(null);

          // Store tool result
          if (data.toolCallId && data.result !== undefined) {
            setToolResults(prev => {
              const next = new Map(prev);
              const existing = next.get(data.toolCallId);
              if (existing) {
                next.set(data.toolCallId, {
                  ...existing,
                  result: data.result,
                  durationMs: data.durationMs,
                  success: data.success,
                });
              } else {
                next.set(data.toolCallId, {
                  name: data.name,
                  args: {},
                  result: data.result,
                  durationMs: data.durationMs,
                  success: data.success,
                });
              }
              return next;
            });
          }

          if (currentAiMessage) {
            completedSegments.push({
              role: 'assistant',
              content: currentAiMessage,
              tool_calls: [...pendingTools, completedTool],
              timestamp: aiResponseTimestamp,
            } as Message);
            pendingTools = [];
            currentAiMessage = '';
          } else {
            pendingTools.push(completedTool);
          }

          setMessages(buildStreamingMsgs());
        }
      } else if (data.type === 'usage') {
        const stats = {
          tps: data.usage.tps,
          tokens: data.usage.completion_tokens || data.usage.output_tokens || data.usage.total_output_tokens,
          inputTokens: data.usage.prompt_tokens || data.usage.input_tokens,
          outputTokens: data.usage.completion_tokens || data.usage.output_tokens || data.usage.total_output_tokens,
          totalTokens: data.usage.total_tokens,
        };
        setLastStats(stats);
        setMessages(prev => {
          const newMsgs = [...prev];
          for (let k = newMsgs.length - 1; k >= 0; k--) {
            if (newMsgs[k].role === 'assistant') {
              newMsgs[k] = { ...newMsgs[k], stats };
              break;
            }
          }
          return newMsgs;
        });
      } else if (data.type === 'done') {
        setIsStreaming(false);
        setActiveTool(null);
        socket.close();
        if (data.messages && data.messages.length > 0) {
          // Process messages but keep our tool results map
          const processed = processMessages(data.messages);
          setMessages(processed);
        }
      } else if (data.type === 'tool_approval_request') {
        const { id, name, args } = data;
        // Auto-approve if user previously selected "approve all" for this tool
        if (autoApprovedToolsRef.current.has(name)) {
          socket.send(JSON.stringify({ type: 'tool_approval_response', id, approved: true }));
        } else {
          setPendingApproval({ id, name, args });
        }
      } else if (data.type === 'error') {
        setIsStreaming(false);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message,
          timestamp: aiResponseTimestamp,
          isError: true,
        }]);
        socket.close();
      }
    };
  }, [inputText, isStreaming, selectedAgentId, messages, sessionId, getWsUrl]);

  const handleStop = useCallback(() => {
    if (isStreaming && ws.current) {
      ws.current.send(JSON.stringify({ type: 'stop' }));
    }
  }, [isStreaming]);

  const handleClear = useCallback(() => {
    if (isStreaming) return;
    setMessages([]);
    setToolResults(new Map());
    setSessionId(null);
    setLastStats(null);
    setPendingApproval(null);
    autoApprovedToolsRef.current.clear();
    textareaRef.current?.focus();
  }, [isStreaming]);

  const respondToApproval = useCallback((approved: boolean, approveAll: boolean = false) => {
    if (!pendingApproval || !ws.current) return;
    if (approveAll && approved) {
      autoApprovedToolsRef.current.add(pendingApproval.name);
    }
    ws.current.send(JSON.stringify({
      type: 'tool_approval_response',
      id: pendingApproval.id,
      approved,
    }));
    setPendingApproval(null);
  }, [pendingApproval]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      handleStop();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      handleClear();
    }
  }, [handleSend, handleStop, handleClear]);

  const currentAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <FontAwesomeIcon icon={faTerminal} className="text-[#58a6ff]" />
        <span className="font-mono text-sm font-semibold text-[#c9d1d9]">Code</span>

        <div className="ml-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faRobot} className="text-[#8b949e] text-xs" />
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs font-mono text-[#c9d1d9] focus:border-[#58a6ff] focus:outline-none cursor-pointer"
          >
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
        </div>

        {lastStats && (
          <div className="ml-auto text-xs font-mono text-[#484f58] flex items-center gap-3">
            {lastStats.inputTokens && <span>{lastStats.inputTokens.toLocaleString()} in</span>}
            {lastStats.outputTokens && <span>{lastStats.outputTokens.toLocaleString()} out</span>}
            {lastStats.tps && <span>{Math.round(lastStats.tps)} tok/s</span>}
          </div>
        )}

        <button
          onClick={handleClear}
          disabled={isStreaming}
          className="ml-2 p-1.5 rounded text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#30363d] disabled:opacity-30 transition-colors cursor-pointer"
          title="Clear (⌘K)"
        >
          <FontAwesomeIcon icon={faRotateRight} className="text-xs" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-[#484f58] font-mono">
            <FontAwesomeIcon icon={faTerminal} className="text-4xl mb-4 text-[#30363d]" />
            <p className="text-sm">Ready to code. Ask me anything.</p>
            <p className="text-xs mt-1 text-[#30363d]">
              {currentAgent ? `Agent: ${currentAgent.name}` : 'Select an agent to get started'}
            </p>
          </div>
        )}

        {messages.map((msg, idx) => {
          if (msg.role === 'user') {
            return (
              <div key={idx} className="flex items-start gap-3">
                <span className="text-[#58a6ff] font-mono text-sm font-bold select-none shrink-0 mt-0.5">&gt;</span>
                <div className="font-mono text-sm text-[#c9d1d9] whitespace-pre-wrap break-words flex-1">{msg.content}</div>
              </div>
            );
          }

          if (msg.role === 'reasoning') {
            if (!config?.chat?.showReasoning) return null;
            return (
              <div key={idx} className="ml-5 border-l-2 border-[#30363d] pl-3">
                <details className="group">
                  <summary className="text-xs font-mono text-[#484f58] cursor-pointer select-none hover:text-[#8b949e]">
                    thinking...
                  </summary>
                  <div className="mt-1 text-xs font-mono text-[#8b949e] whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                </details>
              </div>
            );
          }

          if (msg.role === 'assistant') {
            return (
              <div key={idx} className="space-y-1">
                {/* Tool calls */}
                {msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div className="ml-5">
                    {msg.tool_calls.map((tc, tcIdx) => {
                      const tcId = tc.id || `tc-${idx}-${tcIdx}`;
                      const toolData = toolResults.get(tcId);
                      const toolName = tc.function?.name || tc.name || 'unknown';
                      let toolArgs: any = {};
                      try {
                        toolArgs = JSON.parse(tc.function?.arguments || tc.arguments || '{}');
                      } catch { /* ignore */ }

                      return (
                        <ToolBlock
                          key={tcId}
                          name={toolName}
                          args={toolData?.args || toolArgs}
                          result={toolData?.result}
                          durationMs={toolData?.durationMs || (tc as any).durationMs}
                          success={toolData?.success}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Assistant text */}
                {msg.content && (
                  <div className={`ml-5 ${msg.isError ? 'text-red-400' : ''}`}>
                    <MarkdownRenderer content={msg.content} className="code-markdown" />
                  </div>
                )}

                {/* Stats */}
                {msg.stats && (
                  <div className="ml-5 text-xs font-mono text-[#484f58] mt-1">
                    {msg.stats.inputTokens && <span>{msg.stats.inputTokens.toLocaleString()} in</span>}
                    {msg.stats.inputTokens && msg.stats.outputTokens && <span> / </span>}
                    {msg.stats.outputTokens && <span>{msg.stats.outputTokens.toLocaleString()} out</span>}
                    {msg.stats.tps && <span> · {Math.round(msg.stats.tps)} tok/s</span>}
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}

        {/* Tool Approval Dialog */}
        {pendingApproval && (
          <div className="ml-5 my-2">
            <div className="bg-[#1c2129] border border-yellow-600/50 rounded-md p-3 font-mono text-xs">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-yellow-400 font-semibold">Approval Required</span>
              </div>
              <div className="mb-2 text-[#c9d1d9]">
                <span className="text-[#8b949e]">Tool: </span>
                <span className="text-[#58a6ff]">{pendingApproval.name}</span>
              </div>
              <div className="mb-3 bg-[#0d1117] rounded p-2 text-[#8b949e] max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                {(() => {
                  const name = pendingApproval.name;
                  const args = pendingApproval.args;
                  if (name === 'bash') return `$ ${args.command || ''}`;
                  if (name === 'write') return `Write to ${args.path || 'file'}`;
                  if (name === 'edit' || name === 'multi_edit') return `Edit ${args.path || 'file'}`;
                  if (name === 'web_search') return `Search: ${args.query || ''}`;
                  if (name === 'web_fetch') return `Fetch: ${args.url || ''}`;
                  return JSON.stringify(args, null, 2);
                })()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => respondToApproval(true)}
                  className="px-3 py-1.5 rounded bg-[#238636] text-white hover:bg-[#2ea043] transition-colors cursor-pointer"
                >
                  Approve
                </button>
                <button
                  onClick={() => respondToApproval(true, true)}
                  className="px-3 py-1.5 rounded bg-[#1f6feb33] text-[#58a6ff] border border-[#1f6feb66] hover:bg-[#1f6feb55] transition-colors cursor-pointer"
                >
                  Approve All {pendingApproval.name}
                </button>
                <button
                  onClick={() => respondToApproval(false)}
                  className="px-3 py-1.5 rounded bg-[#da3633]/20 text-[#f85149] border border-[#da3633]/50 hover:bg-[#da3633]/40 transition-colors cursor-pointer"
                >
                  Deny
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active tool indicator */}
        {activeTool && (
          <div className="ml-5">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1c2129] border border-[#30363d] rounded-md font-mono text-xs text-[#8b949e]">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[#58a6ff] font-semibold">
                {activeTool.function?.name || activeTool.name || 'working'}
              </span>
              <span className="text-[#484f58] truncate">
                {(() => {
                  try {
                    const args = JSON.parse(activeTool.function?.arguments || activeTool.arguments || '{}');
                    const name = activeTool.function?.name || activeTool.name || '';
                    if (name === 'bash') return `$ ${args.command || ''}`;
                    if (name === 'read' || name === 'write' || name === 'edit') return args.path || '';
                    if (name === 'grep') return `"${args.pattern || ''}"`;
                    return '';
                  } catch { return ''; }
                })()}
              </span>
            </div>
          </div>
        )}

        {/* Streaming cursor */}
        {isStreaming && !activeTool && messages.length > 0 && (
          <div className="ml-5">
            <span className="inline-block w-2 h-4 bg-[#58a6ff] animate-pulse" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[#30363d] bg-[#161b22] px-4 py-3">
        <div className="flex items-end gap-2">
          <span className="text-[#58a6ff] font-mono text-sm font-bold select-none mb-2">&gt;</span>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Working...' : 'Ask me to code something...'}
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm font-mono text-[#c9d1d9] placeholder-[#484f58] resize-none focus:border-[#58a6ff] focus:outline-none disabled:opacity-50"
            style={{ minHeight: '38px' }}
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="px-3 py-2 rounded-md bg-red-900/50 border border-red-800 text-red-400 hover:bg-red-900/80 transition-colors font-mono text-sm cursor-pointer"
              title="Stop (Esc)"
            >
              <FontAwesomeIcon icon={faSquare} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || !selectedAgentId}
              className="px-3 py-2 rounded-md bg-[#238636] text-white hover:bg-[#2ea043] disabled:opacity-30 disabled:hover:bg-[#238636] transition-colors font-mono text-sm cursor-pointer"
              title="Send (Enter)"
            >
              <FontAwesomeIcon icon={faPaperPlane} />
            </button>
          )}
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] font-mono text-[#30363d]">
          <span>Enter to send · Shift+Enter for newline · Esc to stop · ⌘K to clear</span>
          {!isGatewayConnected && (
            <span className="text-red-500">Gateway disconnected</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Process session messages from the done event — filters system/reasoning, dedupes
function processMessages(rawMessages: any[]): Message[] {
  const result: Message[] = [];
  for (const msg of rawMessages) {
    if (msg.role === 'system') continue;
    if (msg.role === 'tool') continue; // tool results are in our toolResults map
    if (msg.role === 'reasoning') continue; // reasoning handled separately during streaming
    result.push({
      role: msg.role,
      content: msg.content || '',
      timestamp: msg.timestamp,
      tool_calls: msg.tool_calls,
      stats: msg.stats,
      isError: msg.isError,
      name: msg.name,
    });
  }
  return result;
}
