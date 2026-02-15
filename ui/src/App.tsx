import { useState, useEffect, useRef } from 'react'
import {
  Send,
  Settings,
  MessageSquare,
  User,
  Bot,
  Loader2,
  Cpu,
  History,
  Terminal,
  Globe,
  Plus,
  Trash2,
  BrainCircuit,
  FileText,
  X,
  ChevronRight,
  Folder,
  Smile,
  Save,
  Edit2,
  Wrench,
  RefreshCw,
  Monitor,
  Sun,
  Moon,
  Layout
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Toaster, toast } from 'sonner'
import { useTheme } from './contexts/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Button from './components/Button'
import Input from './components/Input'
import Select from './components/Select'
import Toggle from './components/Toggle'
import {
  faPlus,
  faPlug,
  faSun,
  faMoon,
  faDesktop,
  faSave,
  faServer,
  faComments,
  faGear,
  faTrash,
  faPaperPlane,
  faGlobe,
  faLock,
  faLink,
  faUser,
  faSmile,
  faFolder,
  faCube,
  faRobot
} from '@fortawesome/free-solid-svg-icons'

interface Config {
  lmStudio: {
    baseUrl: string;
    modelId: string;
    showReasoning: boolean;
    includeHistory: boolean;
    systemPrompt: string;
  };
  gateway: {
    port: number;
  };
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  path: string;
  identity: string;
  soul: string;
  systemPrompt: string;
}

interface Message {
  role: 'user' | 'assistant' | 'reasoning' | 'system';
  content: string;
  timestamp?: number;
}

interface Session {
  id: string;
  agentId: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

function App() {
  const [activeView, setActiveView] = useState<'chat' | 'settings'>('chat');
  const [activeSettingsSection, setActiveSettingsSection] = useState<'agents' | 'gateway' | 'general' | 'provider' | 'tools'>('general');
  const { theme, setTheme } = useTheme();
  const [gatewayAddr, setGatewayAddr] = useState(() => {
    return localStorage.getItem('gateway_addr') || 'http://localhost:3808';
  });
  const [gatewayToken, setGatewayToken] = useState(() => {
    return localStorage.getItem('gateway_token') || '';
  });
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<string[]>([]);

  // Agent & Session State
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('clawdbot');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [connectedClients, setConnectedClients] = useState<any[]>([]);

  // Settings: Agent Specific State
  const [settingsAgentId, setSettingsAgentId] = useState<string>('');
  const [agentForm, setAgentForm] = useState({ name: '', emoji: '' });
  const [viewingFile, setViewingFile] = useState<{ title: string, content: string, isEditing: boolean } | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGatewayConnected, setIsGatewayConnected] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const presenceWs = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  useEffect(() => {
    localStorage.setItem('gateway_addr', gatewayAddr);
  }, [gatewayAddr]);

  useEffect(() => {
    localStorage.setItem('gateway_token', gatewayToken);
  }, [gatewayToken]);

  // Helper for Gateway URLs
  const getApiUrl = (path: string) => `${gatewayAddr.replace(/\/$/, '')}${path}`;
  const getWsUrl = () => {
    try {
      const url = new URL(gatewayAddr);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const platform = (navigator as any).platform || 'Unknown OS';
      const deviceId = localStorage.getItem('presence_id') || `Device-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      if (!localStorage.getItem('presence_id')) localStorage.setItem('presence_id', deviceId);

      const hostname = encodeURIComponent(`${deviceId} [${platform}]`);
      return `${protocol}//${url.host}/ws?token=${gatewayToken}&hostname=${hostname}`;
    } catch (e) {
      // Fallback for invalid URLs
      return `ws://${window.location.hostname}:3808/ws`;
    }
  };

  // Presence/Heartbeat connection
  useEffect(() => {
    if (!gatewayAddr || !gatewayToken) return;

    let socket: WebSocket | null = null;
    let retryTimeout: any = null;

    const connect = () => {
      try {
        socket = new WebSocket(getWsUrl());
        presenceWs.current = socket;

        socket.onopen = () => {
          console.log('[Presence] Connected to Gateway');
          setIsGatewayConnected(true);
          // Refresh client list immediately on connection
          if (activeSettingsSection === 'gateway') fetchConnectedClients();
        };

        socket.onclose = () => {
          console.log('[Presence] Disconnected from Gateway');
          setIsGatewayConnected(false);
          presenceWs.current = null;
          // Retry after 5 seconds
          retryTimeout = setTimeout(connect, 5000);
        };

        socket.onerror = (e) => {
          console.error('[Presence] WebSocket Error:', e);
        };
      } catch (error) {
        console.error('[Presence] Connection failed:', error);
        retryTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (socket) {
        socket.onclose = null; // Prevent retry on intentional close
        socket.close();
      }
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [gatewayAddr, gatewayToken]);

  // Only fetch when manually requested or on initial load
  useEffect(() => {
    // Initial load (silent)
    initializeApp(true);
  }, []);

  useEffect(() => {
    if (activeView === 'settings') {
      fetchAgents();
      fetchConfig();
      fetchTools();
      if (activeSettingsSection === 'gateway') {
        fetchConnectedClients();
        const interval = setInterval(fetchConnectedClients, 5000);
        return () => clearInterval(interval);
      }
    }
  }, [activeView, activeSettingsSection, settingsAgentId]);

  useEffect(() => {
    if (config?.lmStudio.baseUrl) {
      fetchModels();
    }
  }, [config?.lmStudio.baseUrl]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  // ... (rest of code) ...

  const initializeApp = async (isSilent = false) => {
    setLoading(true);
    try {
      await Promise.all([
        fetchConfig(),
        fetchAgents(),
        fetchSessions(),
        fetchTools(),
        fetchConnectedClients()
      ]);
      if (!isSilent) {
        toast.success('Connected to Gateway', { description: 'Successfully authenticated and synced.' });
      }
    } catch (e) {
      // Only show error if this was a manual connection attempt or if it's a critical failure that should be bubbled
      // For now, let's keep error visible even on silent init as failure to connect is important
      if (!isSilent) {
        toast.error('Connection Failed', { description: 'Could not connect to Gateway. Check URL and Token.' });
      }
    }
    setLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTimestamp = (unixTimestamp?: number) => {
    if (!unixTimestamp) return '';
    const date = new Date(unixTimestamp * (unixTimestamp > 1e11 ? 1 : 1000));
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  async function fetchConnectedClients() {
    try {
      const response = await fetch(getApiUrl('/api/clients'), {
        headers: { 'Authorization': `Bearer ${gatewayToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch clients');
      const data = await response.json();
      setConnectedClients(data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  }

  async function fetchConfig() {
    try {
      const response = await fetch(getApiUrl('/api/config'), {
        headers: { 'Authorization': `Bearer ${gatewayToken}` }
      });
      if (!response.ok) throw new Error('Auth Failed');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to fetch config:', error);
      throw error;
    }
  }

  async function fetchTools() {
    try {
      const response = await fetch(getApiUrl('/api/tools'), {
        headers: { 'Authorization': `Bearer ${gatewayToken}` }
      });
      if (!response.ok) throw new Error('Auth Failed');
      const data = await response.json();
      setTools(data);
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      throw error;
    }
  }

  async function fetchAgents() {
    try {
      const response = await fetch(getApiUrl('/api/agents'), {
        headers: { 'Authorization': `Bearer ${gatewayToken}` }
      });
      if (!response.ok) throw new Error('Auth Failed');
      const data = await response.json();
      setAgents(data);
      if (data.length > 0 && !settingsAgentId) {
        setSettingsAgentId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      throw error;
    }
  }

  async function fetchSessions() {
    try {
      const response = await fetch(getApiUrl('/api/sessions'), {
        headers: { 'Authorization': `Bearer ${gatewayToken}` }
      });
      if (!response.ok) throw new Error('Auth Failed');
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      throw error;
    }
  }

  async function fetchModels() {
    try {
      const response = await fetch(getApiUrl('/api/models'), {
        headers: { 'Authorization': `Bearer ${gatewayToken}` }
      });
      const data = await response.json();
      const modelList = data.data.map((m: any) => m.id);
      setModels(modelList);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  }

  const saveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!config) return;
    try {
      const response = await fetch(getApiUrl('/api/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gatewayToken}`
        },
        body: JSON.stringify(config),
      });
      if (response.ok && e) {
        if (activeSettingsSection === 'gateway') {
          toast.success('Gateway persistent state updated', {
            description: 'Port changes will take effect next time the service is launched.'
          });
        } else {
          toast.success('Configuration saved successfully!');
        }
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const saveAgentConfig = async () => {
    try {
      const response = await fetch(getApiUrl(`/api/agents/${settingsAgentId}/config`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gatewayToken}`
        },
        body: JSON.stringify(agentForm),
      });
      if (response.ok) {
        toast.success('Agent configuration updated!', {
          description: 'The AI will now recognize its new identity.'
        });
        fetchAgents();
      }
    } catch (error) {
      console.error('Failed to save agent config:', error);
    }
  };

  const saveAgentFile = async () => {
    if (!viewingFile) return;
    try {
      const response = await fetch(getApiUrl(`/api/agents/${settingsAgentId}/files/${viewingFile.title}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gatewayToken}`
        },
        body: JSON.stringify({ content: viewingFile.content }),
      });
      if (response.ok) {
        toast.success('File saved successfully!');
        setViewingFile({ ...viewingFile, isEditing: false });
        fetchAgents();
      }
    } catch (error) {
      console.error('Failed to save agent file:', error);
    }
  };

  const createNewSession = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInputText('');
  };

  const loadSession = (session: Session) => {
    setActiveSessionId(session.id);
    setSelectedAgentId(session.agentId);
    setMessages(session.messages);
    setActiveView('chat');
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(getApiUrl(`/api/sessions/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${gatewayToken}` }
      });
      if (response.ok) {
        if (activeSessionId === id) {
          setActiveSessionId(null);
          setMessages([]);
        }
        fetchSessions();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isStreaming) return;

    const currentInput = inputText;
    setInputText('');
    setIsStreaming(true);

    const aiResponseTimestamp = Math.floor(Date.now() / 1000);
    const newUserMsg: Message = { role: 'user', content: currentInput, timestamp: Math.floor(Date.now() / 1000) };
    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);

    const sessionToUse = activeSessionId || `session_${Date.now()}`;
    if (!activeSessionId) setActiveSessionId(sessionToUse);

    const socket = new WebSocket(getWsUrl());
    ws.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({
        sessionId: sessionToUse,
        agentId: selectedAgentId,
        messages: newMessages.map(m => ({ role: m.role, content: m.content }))
      }));
    };

    socket.onerror = (err) => {
      console.error('Chat WebSocket Error:', err);
      setIsStreaming(false);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Error: Could not establish a connection to the Gateway. It might be offline or your token might be invalid.",
        timestamp: aiResponseTimestamp
      }]);
    };

    let currentAiMessage = '';
    let currentReasoning = '';
    let isInsideReasoning = false;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'delta') {
        const chunk = data.content;
        if (chunk.includes('<think>') || chunk.includes('<thought>') || chunk.includes('<reasoning>')) {
          isInsideReasoning = true;
        }

        if (isInsideReasoning) {
          currentReasoning += chunk.replace(/<(think|thought|reasoning)>|<\/(think|thought|reasoning)>/gi, '');
          if (chunk.includes('</think>') || chunk.includes('</thought>') || chunk.includes('</reasoning>')) {
            isInsideReasoning = false;
          }
        } else {
          currentAiMessage += chunk;
        }

        const streamingMsgs: Message[] = [...newMessages];
        if (currentReasoning) {
          streamingMsgs.push({ role: 'reasoning', content: currentReasoning, timestamp: aiResponseTimestamp });
        }
        if (currentAiMessage) {
          streamingMsgs.push({ role: 'assistant', content: currentAiMessage, timestamp: aiResponseTimestamp });
        }
        setMessages(streamingMsgs);
      } else if (data.type === 'done') {
        setIsStreaming(false);
        socket.close();
        fetchSessions();
      } else if (data.type === 'error') {
        setIsStreaming(false);
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.message}`, timestamp: aiResponseTimestamp }]);
        socket.close();
      }
    };
  };

  const activeAgentInSettings = agents.find(a => a.id === settingsAgentId);

  return (
    <div className="flex h-screen w-full bg-bg-primary text-neutral-600 dark:text-white overflow-hidden">
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontFamily: 'Outfit, sans-serif'
          }
        }}
      />
      {/* Modal Overlay */}
      {viewingFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-200" onClick={() => setViewingFile(null)}>
          <div className="bg-bg-card w-full max-w-4xl h-[80vh] rounded-3xl border border-border-color flex flex-col overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border-color flex justify-between items-center bg-bg-sidebar/50">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-accent-primary" />
                <h2 className="text-xl font-semibold">{viewingFile.title}</h2>
              </div>
              <div className="flex gap-2">
                {!viewingFile.isEditing ? (
                  <button className="h-10 px-5 rounded-lg bg-transparent border border-white/10 hover:bg-white/5 hover:text-white flex items-center justify-center transition-all duration-200" onClick={() => setViewingFile({ ...viewingFile, isEditing: true })}>
                    <Edit2 size={18} />
                  </button>
                ) : (
                  <button className="h-10 px-5 rounded-lg bg-accent-primary text-white border border-accent-primary shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center justify-center transition-all duration-200" onClick={saveAgentFile}>
                    <Save size={18} />
                  </button>
                )}
                <button className="h-10 px-3 rounded-lg hover:text-white transition-all duration-200" onClick={() => setViewingFile(null)}>
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              {viewingFile.isEditing ? (
                <textarea
                  className="w-full h-full p-6 bg-bg-primary border border-border-color rounded-2xl outline-none focus:border-accent-primary transition-colors resize-none font-mono text-sm leading-relaxed text-neutral-600 dark:text-white"
                  value={viewingFile.content}
                  onChange={e => setViewingFile({ ...viewingFile, content: e.target.value })}
                />
              ) : (
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {viewingFile.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <nav className="w-72 bg-bg-sidebar border-r border-border-color flex flex-col z-50 transition-all duration-300">
        <div className="p-5">
          <Button
            className="w-full bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 border border-border-color transition-colors text-neutral-600 dark:text-white"
            icon={faPlus}
            onClick={createNewSession}
            disabled={!isGatewayConnected}
          >
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 py-2 custom-scrollbar">
          {sessions.map(s => (
            <div
              key={s.id}
              className={`group w-full p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 ${activeSessionId === s.id ? 'bg-white-trans text-neutral-600 dark:text-white' : ' hover:bg-white-trans hover:text-neutral-600 dark:text-white'}`}
              onClick={() => loadSession(s)}
            >
              <div className="text-xl flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white-trans rounded-lg">
                {agents.find(a => a.id === s.agentId)?.emoji || '💬'}
              </div>
              <span className="flex-1 text-sm font-medium truncate">{s.title}</span>
              <Button
                className="opacity-0 group-hover:opacity-100 !p-1.5 !rounded-lg"
                icon={faTrash}
                onClick={(e) => deleteSession(s.id, e)}
              />
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border-color flex gap-3">
          <Button
            themed={activeView === 'chat'}
            className={`flex-1 h-11 !px-0 flex items-center justify-center ${activeView !== 'chat' ? '!bg-transparent' : ''}`}
            onClick={() => setActiveView('chat')}
            icon={faComments}
            disabled={!isGatewayConnected}
          />
          <Button
            themed={activeView === 'settings'}
            className={`flex-1 h-11 !px-0 flex items-center justify-center ${activeView !== 'settings' ? '!bg-transparent' : ''}`}
            onClick={() => setActiveView('settings')}
            icon={faGear}
          />
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-bg-primary">
        {activeView === 'chat' ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Agent ToolBar */}
            <div className="px-6 py-4 border-b border-border-color flex justify-between items-center bg-bg-primary/80 backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent-primary flex items-center justify-center text-xl shadow-[0_4px_15px_rgba(99,102,241,0.3)]">
                  {agents.find(a => a.id === selectedAgentId)?.emoji || <BrainCircuit size={18} className="text-white" />}
                </div>
                <div>
                  <div className="font-semibold text-neutral-600 dark:text-white text-sm leading-tight">{agents.find(a => a.id === selectedAgentId)?.name || 'Select Agent'}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    <span className="text-xs uppercase font-bold tracking-wider">Ready to assist</span>
                  </div>
                </div>
              </div>
              <Select
                className="!py-1.5 !text-xs !rounded-lg"
                width="w-48"
                icon={faRobot}
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                options={agents.map(a => ({ value: a.id, label: `${a.emoji} ${a.name}` }))}
              />
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 lg:px-12 py-8 space-y-6">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="w-24 h-24 bg-bg-card border border-border-color rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-sm animate-bounce-slow">
                    {agents.find(a => a.id === selectedAgentId)?.emoji || <Bot size={40} className="text-accent-primary" />}
                  </div>
                  <h2 className="text-3xl font-bold text-neutral-600 dark:text-white mb-2 tracking-tight">Chat with {agents.find(a => a.id === selectedAgentId)?.name}</h2>
                  <p className="max-w-sm leading-relaxed">Your personal AI assistant powered by local inference. Send a message to get started.</p>

                  <div className="grid grid-cols-2 gap-3 mt-10 max-w-lg w-full">
                    {['Analyze some code', 'Write a short story', 'Help me research', 'Explain a concept'].map(hint => (
                      <button
                        key={hint}
                        className="p-4 bg-white-trans border border-white-trans rounded-2xl text-left text-sm hover:bg-accent-primary/5 hover:border-accent-primary/20 transition-all active:scale-95"
                        onClick={() => setInputText(hint)}
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => {
                if (msg.role === 'reasoning' && !config?.lmStudio.showReasoning) return null;
                if (msg.role === 'system') return null;
                return (
                  <div key={i} className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`flex gap-4 items-start ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-lg ${msg.role === 'user' ? 'bg-bg-card text-neutral-600 dark:text-white' : msg.role === 'reasoning' ? 'bg-amber-500/10 text-amber-500' : 'bg-accent-primary text-white'} shadow-sm`}>
                          {msg.role === 'user' ? <User size={18} /> : msg.role === 'reasoning' ? <BrainCircuit size={16} /> : (
                            <span>{agents.find(a => a.id === selectedAgentId)?.emoji || '🤖'}</span>
                          )}
                        </div>
                        <div className={`bubble ${msg.role === 'user' ? 'user-bubble' : msg.role === 'reasoning' ? 'reasoning-bubble' : 'ai-bubble'}`}>
                          {msg.role === 'reasoning' && (
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/10 text-xs font-bold uppercase tracking-widest text-amber-400">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Thought Process
                            </div>
                          )}
                          <div className={`${msg.role === 'user' ? 'prose-invert' : 'prose dark:prose-invert'} max-w-none leading-relaxed whitespace-pre-wrap select-text`}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ node, inline, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || '')
                                  return !inline ? (
                                    <div className="my-5 rounded-xl border border-white-trans overflow-hidden shadow-lg">
                                      {match && (
                                        <div className="px-4 py-2 bg-white-trans border-b border-white-trans text-xs font-bold uppercase tracking-widest flex justify-between items-center">
                                          <span>{match[1]}</span>
                                          <span className="cursor-pointer hover:text-neutral-600 dark:text-white transition-colors" onClick={() => navigator.clipboard.writeText(String(children))}>Copy</span>
                                        </div>
                                      )}
                                      <SyntaxHighlighter
                                        {...props}
                                        children={String(children).replace(/\n$/, '')}
                                        style={vscDarkPlus}
                                        language={match ? match[1] : ''}
                                        PreTag="div"
                                        customStyle={{ margin: 0, padding: '20px', fontSize: '13px', background: '#0a0a0a' }}
                                      />
                                    </div>
                                  ) : (
                                    <code {...props} className="bg-white-trans px-1.5 py-0.5 rounded font-mono text-sm">
                                      {children}
                                    </code>
                                  )
                                }
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                      {msg.timestamp && (
                        <div className={`mt-2 text-xs font-medium flex items-center gap-1.5 px-1 ${msg.role === 'user' ? '' : 'ml-12'}`}>
                          {formatTimestamp(msg.timestamp)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {isStreaming && (
                <div className="flex justify-start animate-in fade-in duration-300">
                  <div className="flex gap-4 items-start">
                    <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-accent-primary flex items-center justify-center text-lg text-white shadow-sm">
                      <span>{agents.find(a => a.id === selectedAgentId)?.emoji || '🤖'}</span>
                    </div>
                    <div className="loading-dots">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Section */}
            <div className="p-6 lg:px-12 bg-gradient-to-t from-bg-primary via-bg-primary/95 to-transparent pt-10">
              <form onSubmit={handleSend} className="relative group max-w-4xl mx-auto">
                <textarea
                  ref={textareaRef}
                  className="w-full bg-neutral-100 dark:bg-neutral-800/50 border-2 border-transparent text-neutral-600 dark:text-white rounded-[28px] py-4 pl-6 pr-14 outline-none hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-accent-primary transition-all scrollbar-none resize-none text-base leading-relaxed"
                  placeholder={isGatewayConnected ? `Message ${agents.find(a => a.id === selectedAgentId)?.name}...` : "Gateway Offline - Check Settings"}
                  rows={1}
                  value={inputText}
                  disabled={!isGatewayConnected}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                />
                <Button
                  themed={!isStreaming && inputText.trim().length > 0 && isGatewayConnected}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 !w-10 !h-10 !p-0 !rounded-full flex items-center justify-center`}
                  disabled={isStreaming || !inputText.trim() || !isGatewayConnected}
                  onClick={handleSend}
                  icon={isStreaming ? undefined : faPaperPlane}
                >
                  {isStreaming && <Loader2 size={18} className="animate-spin" />}
                </Button>
              </form>
              <div className="mt-2 text-xs text-center flex items-center justify-center gap-1">
                Press <span className="px-1.5 py-0.5 bg-white-trans rounded mx-1 text-neutral-600 dark:text-white">Enter</span> to send, <span className="px-1.5 py-0.5 bg-white-trans rounded mx-1 text-neutral-600 dark:text-white">Shift + Enter</span> for new line
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-8 lg:p-12 overflow-y-auto">
            <header className="mb-10">
              <h1 className="text-4xl font-extrabold text-neutral-600 dark:text-white tracking-tight mb-2">Settings</h1>
              <p className="text-lg">Manage your gateway, providers, and agent personalities.</p>
            </header>

            <nav className="flex gap-8 border-b border-border-color mb-10 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
              {['agents', 'gateway', 'general', 'provider', 'tools'].map(id => (
                <button
                  key={id}
                  className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all duration-300 relative flex items-center gap-2 ${activeSettingsSection === id ? 'text-accent-primary' : ' hover:text-neutral-600 dark:text-white'}`}
                  onClick={() => setActiveSettingsSection(id as any)}
                >
                  {id === 'gateway' && (
                    <span className={`w-2 h-2 rounded-full ${isGatewayConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                  )}
                  {id}
                  {activeSettingsSection === id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
                </button>
              ))}
            </nav>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Loader2 size={40} className="animate-spin text-accent-primary" />
                <p className="font-medium">Synchronizing configuration...</p>
              </div>
            ) : (
              <div className="max-w-5xl">
                {activeSettingsSection === 'general' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <section className="bg-bg-card border border-border-color rounded-3xl p-8 space-y-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                          <Layout size={20} className="text-accent-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-neutral-600 dark:text-white">General Settings</h2>
                      </div>

                      <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                          Appearance
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {[
                            { id: 'light', name: 'Light', icon: faSun },
                            { id: 'dark', name: 'Dark', icon: faMoon },
                            { id: 'system', name: 'System', icon: faDesktop },
                          ].map((item) => (
                            <Button
                              key={item.id}
                              themed={theme === item.id}
                              onClick={() => setTheme(item.id as any)}
                              className={`!p-3 flex-1 flex items-center justify-center gap-2 group ${theme !== item.id ? '!bg-bg-primary border border-border-color' : ''}`}
                              icon={item.icon}
                            >{item.name}</Button>
                          ))}
                        </div>
                      </div>

                    </section>
                  </div>
                )}

                {activeSettingsSection === 'provider' && (
                  <form onSubmit={saveConfig} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <section className="bg-bg-card border border-border-color rounded-3xl p-8 space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                          <Globe size={20} className="text-accent-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-neutral-600 dark:text-white">Model & Provider Settings</h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                          label="LM Studio Endpoint"
                          currentText={config?.lmStudio.baseUrl || ''}
                          onChange={(e) => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, baseUrl: e.target.value } } : null)}
                          placeholder="http://localhost:1234/v1"
                          icon={faLink}
                          className="!mt-0"
                        />

                        <div className="space-y-2">
                          <Select
                            icon={faCube}
                            className="!mt-0"
                            label="Model"
                            value={config?.lmStudio.modelId || ''}
                            onChange={(e) => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, modelId: e.target.value } } : null)}
                            options={[
                              { value: '', label: 'Select a model...' },
                              ...models.map(m => ({ value: m, label: m }))
                            ]}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-bg-primary border border-border-color rounded-xl p-4 flex justify-between items-center group transition-all">
                          <div className="space-y-1">
                            <h3 className="text-sm font-bold text-neutral-600 dark:text-white group-hover:text-accent-primary transition-colors">Show Thought Process</h3>
                            <p className="text-xs">Display reasoning blocks if available</p>
                          </div>
                          <Toggle
                            checked={config?.lmStudio.showReasoning || false}
                            onChange={() => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, showReasoning: !prev.lmStudio.showReasoning } } : null)}
                          />
                        </div>

                        <div className="bg-bg-primary border border-border-color rounded-xl p-4 flex justify-between items-center group transition-all">
                          <div className="space-y-1">
                            <h3 className="text-sm font-bold text-neutral-600 dark:text-white flex items-center gap-2 group-hover:text-accent-primary transition-colors"><History size={14} /> Stateful Conversations</h3>
                            <p className="text-xs">Preserve context across multiple message turns</p>
                          </div>
                          <Toggle
                            checked={config?.lmStudio.includeHistory || false}
                            onChange={() => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, includeHistory: !prev.lmStudio.includeHistory } } : null)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Terminal size={14} /> Global System Prompt</label>
                        <textarea
                          className="w-full bg-bg-primary border border-border-color rounded-xl px-5 py-4 outline-none focus:border-accent-primary transition-all text-sm h-32 custom-scrollbar resize-none"
                          value={config?.lmStudio.systemPrompt}
                          onChange={(e) => setConfig(prev => prev ? { ...prev, lmStudio: { ...prev.lmStudio, systemPrompt: e.target.value } } : null)}
                          placeholder="Describe how the AI should behave globally..."
                        />
                      </div>
                      <Button themed={true} className="w-full h-12 text-white" onClick={() => saveConfig()} icon={faSave}>Save Provider Configurations</Button>
                    </section>
                  </form>
                )}

                {activeSettingsSection === 'agents' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    {/* Agent Nav */}
                    <div className="lg:col-span-4 bg-bg-card border border-border-color rounded-3xl p-4 space-y-1 h-min max-h-[60vh] overflow-y-auto custom-scrollbar">
                      <div className="px-4 py-2 mb-2">
                        <h3 className="text-sm font-bold uppercase">Discovered Agents</h3>
                      </div>
                      {agents.map(a => (
                        <Button
                          key={a.id}
                          themed={settingsAgentId === a.id}
                          className={`w-full flex items-center gap-3 !px-4 !py-3 ${settingsAgentId !== a.id ? '!bg-transparent ! hover:!bg-white/5' : ''}`}
                          onClick={() => setSettingsAgentId(a.id)}
                        >
                          <span className="text-xl mr-1">{a.emoji}</span>
                          <span className="font-semibold text-sm">{a.name}</span>
                        </Button>
                      ))}
                    </div>

                    {/* Agent Config */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                      {activeAgentInSettings ? (
                        <>
                          <section className="bg-bg-card border border-border-color rounded-3xl p-8 space-y-6">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                                  <BrainCircuit size={20} className="text-accent-primary" />
                                </div>
                                <h2 className="text-xl font-bold text-neutral-600 dark:text-white">Personalization for {activeAgentInSettings.name}</h2>
                              </div>
                              <button
                                onClick={() => fetchAgents()}
                                className="p-2 hover:bg-white-trans rounded-lg hover:text-neutral-600 dark:text-white transition-all group"
                                title="Refresh Agent Data"
                              >
                                <RefreshCw size={18} className="group-active:rotate-180 transition-transform duration-500" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <Input
                                label="Agent Nickname"
                                currentText={agentForm.name}
                                onChange={e => setAgentForm({ ...agentForm, name: e.target.value })}
                                icon={faUser}
                                className="md:col-span-2"
                                inputClassName="!mt-0"
                              />
                              <Input
                                label="Emoji Icon"
                                currentText={agentForm.emoji}
                                onChange={e => setAgentForm({ ...agentForm, emoji: e.target.value })}
                                icon={faSmile}
                                inputClassName="!mt-0 font-emoji text-center pl-0"
                              />
                            </div>

                            <Input
                              label="Filesystem Runtime Path"
                              currentText={activeAgentInSettings.path}
                              readOnly={true}
                              icon={faFolder}
                              inputClassName="!mt-0 !text-xs !font-mono"
                            />

                            <Button
                              themed={true}
                              className="w-full h-12 text-white"
                              onClick={saveAgentConfig}
                              icon={faSave}
                            >
                              Update Agent Meta Profile
                            </Button>
                          </section>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div
                              className="group p-5 bg-bg-card border border-border-color rounded-3xl flex justify-between items-center cursor-pointer hover:border-accent-primary hover:bg-accent-primary/5 transition-all"
                              onClick={() => setViewingFile({ title: 'IDENTITY.md', content: activeAgentInSettings.identity, isEditing: true })}
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-accent-primary group-hover:bg-accent-primary/10 transition-all">
                                  <FileText size={24} />
                                </div>
                                <div>
                                  <div className="font-bold text-neutral-600 dark:text-white uppercase text-xs tracking-tight">IDENTITY.md</div>
                                  <div className="text-xs group-hover:text-neutral-600 dark:text-white transition-colors">Core instructions</div>
                                </div>
                              </div>
                            </div>

                            <div
                              className="group p-5 bg-bg-card border border-border-color rounded-3xl flex justify-between items-center cursor-pointer hover:border-accent-primary hover:bg-accent-primary/5 transition-all"
                              onClick={() => setViewingFile({ title: 'SOUL.md', content: activeAgentInSettings.soul, isEditing: true })}
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-amber-400 group-hover:bg-amber-400/10 transition-all">
                                  <BrainCircuit size={24} />
                                </div>
                                <div>
                                  <div className="font-bold text-neutral-600 dark:text-white uppercase text-xs tracking-tight">SOUL.md</div>
                                  <div className="text-xs group-hover:text-neutral-600 dark:text-white transition-colors">Moral values</div>
                                </div>
                              </div>
                            </div>

                            <div
                              className="group p-5 bg-bg-card border border-border-color rounded-3xl flex justify-between items-center cursor-pointer hover:border-accent-primary hover:bg-accent-primary/5 transition-all"
                              onClick={() => setViewingFile({ title: 'MEMORY.md', content: (activeAgentInSettings as any).memory || '', isEditing: true })}
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white-trans flex items-center justify-center group-hover:text-emerald-400 group-hover:bg-emerald-400/10 transition-all">
                                  <History size={24} />
                                </div>
                                <div>
                                  <div className="font-bold text-neutral-600 dark:text-white uppercase text-xs tracking-tight">MEMORY.md</div>
                                  <div className="text-xs group-hover:text-neutral-600 dark:text-white transition-colors">Stored facts</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-bg-card rounded-3xl border border-dashed border-border-color">
                          <BrainCircuit size={40} className="text-border-color mb-4" />
                          <p className="font-medium italic">Select an agent from the left to view configuration</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSettingsSection === 'gateway' && (
                  <form onSubmit={saveConfig} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <section className="bg-bg-card border border-border-color rounded-3xl p-8 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                          <Cpu size={20} className="text-accent-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-neutral-600 dark:text-white">Platform Gateway</h2>
                      </div>

                      <div className="pt-4">
                        <div className="w-full space-y-6">
                          <label className="text-md font-bold uppercase tracking-wider flex items-center gap-2">
                            <FontAwesomeIcon icon={faGlobe} /> Connection & Networking
                          </label>
                          <div className="space-y-6">
                            <p className="text-md leading-relaxed">
                              Specify the address of your gateway. For local development, use <code className="text-accent-primary">http://localhost:3808</code>.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Input
                                label="Endpoint"
                                currentText={gatewayAddr}
                                onChange={e => setGatewayAddr(e.target.value)}
                                placeholder="http://localhost:3808"
                                icon={faGlobe}
                                clearText={() => setGatewayAddr('')}
                                className="!mt-0"
                              />
                              <Input
                                label="Token"
                                currentText={gatewayToken}
                                onChange={e => setGatewayToken(e.target.value)}
                                placeholder="Secret Token"
                                icon={faLock}
                                clearText={() => setGatewayToken('')}
                                className="!mt-0"
                              />
                            </div>

                            <Button
                              themed={true}
                              onClick={() => initializeApp()}
                              disabled={!gatewayAddr || !gatewayToken}
                              className="w-full h-12 text-white"
                              icon={faPlug}
                            >
                              Connect to Gateway
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-8 border-t border-border-color space-y-6">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <FontAwesomeIcon icon={faDesktop} /> Connected Computers ({connectedClients.length})
                          </label>
                          <button
                            onClick={(e) => { e.preventDefault(); fetchConnectedClients(); }}
                            className="text-xs font-bold uppercase tracking-widest text-accent-primary hover:text-accent-primary/80 flex items-center gap-1 transition-colors"
                          >
                            <RefreshCw size={10} /> Refresh List
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {connectedClients.length === 0 ? (
                            <div className="p-8 bg-bg-primary/50 border border-dashed border-border-color rounded-2xl text-center">
                              <p className="text-xs italic">No other computers currently connected to this gateway.</p>
                            </div>
                          ) : (
                            connectedClients.map((client, idx) => (
                              <div key={idx} className="bg-bg-primary border border-border-color rounded-2xl p-4 flex items-center justify-between group hover:border-accent-primary/50 transition-all">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-white-trans flex items-center justify-center group-hover:text-accent-primary group-hover:bg-accent-primary/10 transition-all">
                                    <Monitor size={20} />
                                  </div>
                                  <div className="text-left">
                                    <div className="font-bold text-neutral-600 dark:text-white text-sm">{client.hostname}</div>
                                    <div className="text-xs font-mono flex items-center gap-2">
                                      <Globe size={10} /> {client.ip}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-bold uppercase tracking-tighter text-neutral-600 dark:text-white/40 mb-1">Connected Since</div>
                                  <div className="text-xs font-medium">
                                    {new Date(client.connectedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </section>
                  </form>
                )}

                {activeSettingsSection === 'tools' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <section className="bg-bg-card border border-border-color rounded-3xl p-8 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                          <Wrench size={20} className="text-accent-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-neutral-600 dark:text-white">Available Skills & Tools</h2>
                      </div>

                      <p className="text-sm leading-relaxed max-w-2xl text-left">
                        These are the capabilities currently discovered by the Gateway. Agents can autonomously choose use these tools to interact with your environment.
                      </p>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 text-left">
                        {tools.map(tool => (
                          <div key={tool.name} className="p-6 bg-bg-primary border border-border-color rounded-2xl space-y-3 group hover:border-accent-primary/50 transition-all">
                            <div className="flex justify-between items-start">
                              <h3 className="font-bold text-neutral-600 dark:text-white group-hover:text-accent-primary transition-colors">{tool.name}</h3>
                              <div className="px-2 py-0.5 rounded-md bg-white/5 text-xs font-bold uppercase tracking-widest">Plugin</div>
                            </div>
                            <p className="text-sm leading-relaxed line-clamp-2">{tool.description}</p>
                            <div className="pt-2">
                              <div className="text-xs font-bold uppercase tracking-tighter text-neutral-600 dark:text-white/40 mb-2">Parameters</div>
                              <div className="flex flex-wrap gap-2">
                                {Object.keys(tool.parameters.properties).map(prop => (
                                  <span key={prop} className="px-2 py-1 rounded-lg bg-white/5 text-xs font-mono text-accent-primary">
                                    {prop}
                                    {tool.parameters.required?.includes(prop) && <span className="text-rose-500 ml-0.5">*</span>}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
