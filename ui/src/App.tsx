import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
import { Toaster, toast } from 'sonner'
import { useTheme } from './contexts/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Button from './components/Button'
import Input from './components/Input'
import Select from './components/Select'
import Toggle from './components/Toggle'
import Text from './components/Text'
import Header from './components/Header'
import Card from './components/Card'
import IconBox from './components/IconBox'
import Badge from './components/Badge'
import Modal from './components/Modal'
import MarkdownRenderer from './components/MarkdownRenderer'
import AgentsPage from './components/pages/AgentsPage'
import ProvidersPage from './components/pages/ProvidersPage'
import LogsPage from './components/pages/LogsPage'
import SettingsPage from './components/pages/SettingsPage'
import { TABLE, TH, TR, TD } from './components/Table'
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
  faRobot,
  faFileLines
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
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active view from URL path
  const getActiveView = () => {
    const path = location.pathname.split('/')[1];
    if (!path) return 'chat';
    return path;
  };

  const activeView = getActiveView();

  useEffect(() => {
    if (location.pathname === '/') {
      navigate('/chat', { replace: true });
    }
  }, [location.pathname, navigate]);

  const [activeSettingsSection, setActiveSettingsSection] = useState<'agents' | 'gateway' | 'general' | 'provider' | 'tools' | 'chat'>('general');
  const [isNavExpanded, setIsNavExpanded] = useState(true);
  const [logs, setLogs] = useState<{ timestamp: string, data: string }[]>([]);
  const { theme, setTheme } = useTheme();
  const [gatewayAddr, setGatewayAddr] = useState(() => {
    return localStorage.getItem('gateway_addr') || 'http://localhost:3808';
  });
  const [generateSummaries, setGenerateSummaries] = useState(false);
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

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);

  useEffect(() => {
    // Only auto-scroll if we are already at the bottom or if it's a user message
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') {
      isAtBottom.current = true;
      scrollToBottom();
    } else if (isAtBottom.current) {
      scrollToBottom();
    }
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

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      isAtBottom.current = distanceToBottom < 100; // 100px threshold
    }
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
    isAtBottom.current = true;
  };

  const loadSession = (session: Session) => {
    setActiveSessionId(session.id);
    setSelectedAgentId(session.agentId);
    setMessages(session.messages);
    isAtBottom.current = true;
    navigate('/chat');
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
      const payload = {
        sessionId: sessionToUse,
        agentId: selectedAgentId,
        messages: newMessages.map(m => ({ role: m.role, content: m.content }))
      };
      setLogs(prev => [{ timestamp: new Date().toISOString(), data: `[SENT] ${JSON.stringify(payload)}` }, ...prev].slice(0, 100)); // Keep last 100 logs
      socket.send(JSON.stringify(payload));
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
      setLogs(prev => [{ timestamp: new Date().toISOString(), data: `[RECEIVED] ${event.data}` }, ...prev].slice(0, 100)); // Keep last 100 logs
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
    <div className="flex flex-col h-screen w-full bg-bg-primary text-neutral-600 dark:text-white overflow-hidden">
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
      {/* Modal Overlay */}
      <Modal
        isOpen={!!viewingFile}
        onClose={() => setViewingFile(null)}
        title={viewingFile && (
          <>
            <FileText size={20} className="text-accent-primary" />
            <span>{viewingFile.title}</span>
          </>
        )}
        headerActions={viewingFile && (
          !viewingFile.isEditing ? (
            <button className="h-10 px-5 rounded-lg bg-transparent border border-white/10 hover:bg-white/5 hover:text-white flex items-center justify-center transition-all duration-200" onClick={() => setViewingFile({ ...viewingFile, isEditing: true })}>
              <Edit2 size={18} />
            </button>
          ) : (
            <button className="h-10 px-5 rounded-lg bg-accent-primary text-white border border-accent-primary shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center justify-center transition-all duration-200" onClick={saveAgentFile}>
              <Save size={18} />
            </button>
          )
        )}
      >
        <div className="flex-1 overflow-y-auto p-8 h-full">
          {viewingFile && (viewingFile.isEditing ? (
            <textarea
              className="w-full h-[60vh] p-6 bg-bg-primary border border-border-color rounded-2xl outline-none focus:border-accent-primary transition-colors resize-none font-mono text-sm leading-relaxed text-neutral-600 dark:text-white"
              value={viewingFile.content}
              onChange={e => setViewingFile({ ...viewingFile, content: e.target.value })}
            />
          ) : (
            <MarkdownRenderer content={viewingFile.content} />
          ))}
        </div>
      </Modal>

      <Header isGatewayConnected={isGatewayConnected} onRefresh={() => initializeApp()} onMenuClick={() => setIsNavExpanded(!isNavExpanded)} />
      <div className="flex flex-1 overflow-hidden">
        {/* Primary Sidebar */}
        <nav className={`${isNavExpanded ? 'w-48' : 'w-16'} bg-bg-sidebar border-r border-border-color flex flex-col items-center py-6 gap-2 z-51 transition-all duration-300`}>
          {[
            { id: 'chat', icon: faComments, label: 'Chat' },
            { id: 'agents', icon: faRobot, label: 'Agents' },
            { id: 'gateway', icon: faServer, label: 'Gateway' },
            { id: 'providers', icon: faCube, label: 'Providers' },
            { id: 'logs', icon: faFileLines, label: 'Logs' },
            { id: 'settings', icon: faGear, label: 'Settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => navigate('/' + item.id)}
              className={`w-[calc(100%-1rem)] mx-2 px-3 py-3 rounded-xl transition-all duration-200 group relative flex items-center gap-4 ${activeView === item.id
                ? 'bg-accent-primary text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                : 'text-neutral-500 hover:bg-white-trans hover:text-neutral-600 dark:text-white'
                }`}
              title={isNavExpanded ? undefined : item.label}
            >
              <div className={`flex-shrink-0 w-6 flex justify-center`}>
                <FontAwesomeIcon icon={item.icon} className="text-lg" />
              </div>

              {isNavExpanded && (
                <span className="text-sm font-semibold whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
                  {item.label}
                </span>
              )}

              {!isNavExpanded && (
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-neutral-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-[100] shadow-xl border border-white/10 translate-x-1 group-hover:translate-x-0">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Secondary Sidebar (Chat Sessions) */}
        {activeView === 'chat' && (
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
          </nav>
        )}

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
              <div
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto custom-scrollbar px-6 lg:px-12 py-8 space-y-6"
              >
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
                            <div className="w-full">
                              <MarkdownRenderer
                                content={msg.content}
                                className={msg.role === 'user' ? 'prose-invert prose-chat' : 'prose dark:prose-invert prose-chat'}
                              />
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
                    className="w-full bg-neutral-100 dark:bg-neutral-800/50 border-2 border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-white rounded-full py-3.5 pl-6 pr-14 outline-none hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-accent-primary transition-all scrollbar-none resize-none text-base leading-relaxed"
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
                    className={`absolute right-3 top-1/2 -translate-y-1/2 !w-10 !h-10 !rounded-full flex items-center justify-center`}
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
          ) : activeView === 'logs' ? (
            <LogsPage logs={logs} />
          ) : activeView === 'agents' ? (
            <AgentsPage />
          ) : activeView === 'providers' ? (
            <ProvidersPage />
          ) : ['gateway'].includes(activeView) ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-bg-card border border-border-color rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                <FontAwesomeIcon
                  icon={faServer}
                  className="text-3xl text-accent-primary opacity-20"
                />
              </div>
              <h2 className="text-3xl font-bold text-neutral-600 dark:text-white mb-2 tracking-tight transition-all duration-300">
                {activeView.charAt(0).toUpperCase() + activeView.slice(1)}
              </h2>
              <p className="max-w-md text-neutral-500 leading-relaxed">
                This section is coming soon. We're working hard to bring you the best local AI management experience for your {activeView}.
              </p>
            </div>
          ) : (
            <SettingsPage
              activeSettingsSection={activeSettingsSection}
              setActiveSettingsSection={setActiveSettingsSection}
              isGatewayConnected={isGatewayConnected}
              loading={loading}
              theme={theme}
              setTheme={setTheme}
              config={config}
              setConfig={setConfig}
              models={models}
              saveConfig={saveConfig}
              agents={agents}
              settingsAgentId={settingsAgentId}
              setSettingsAgentId={setSettingsAgentId}
              activeAgentInSettings={activeAgentInSettings}
              fetchAgents={fetchAgents}
              agentForm={agentForm}
              setAgentForm={setAgentForm}
              saveAgentConfig={saveAgentConfig}
              setViewingFile={setViewingFile}
              gatewayAddr={gatewayAddr}
              setGatewayAddr={setGatewayAddr}
              gatewayToken={gatewayToken}
              setGatewayToken={setGatewayToken}
              initializeApp={initializeApp}
              connectedClients={connectedClients}
              fetchConnectedClients={fetchConnectedClients}
              tools={tools}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
