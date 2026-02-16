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
import GatewayPage from './components/pages/GatewayPage'
import SettingsPage from './components/pages/SettingsPage'
import ChatPage from './components/pages/ChatPage'
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

  chat: {
    showReasoning: boolean;
    includeHistory: boolean;
    generateSummaries: boolean;
  };
  gateway: {
    port: number;
    endpoint: string;
  };
  global?: {
    systemPrompt: string;
  };
  providers: {
    description: string;
    endpoint: string;
    model: string;
  }[];
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  path: string;
  identity: string;
  soul: string;
  systemPrompt: string;
  provider?: string;
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
  summary?: string;
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

  const [activeSettingsSection, setActiveSettingsSection] = useState<'agents' | 'gateway' | 'general' | 'tools' | 'chat' | 'config'>('general');
  const [isNavExpanded, setIsNavExpanded] = useState(true);
  const [logs, setLogs] = useState<{ timestamp: string, data: string }[]>([]);
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
  const [agentsPageAgentId, setAgentsPageAgentId] = useState<string>('');
  const [agentForm, setAgentForm] = useState<{ name: string; emoji: string; provider?: string }>({ name: '', emoji: '', provider: '' });
  const [viewingFile, setViewingFile] = useState<{ title: string, content: string, isEditing: boolean, agentId: string } | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGatewayConnected, setIsGatewayConnected] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const presenceWs = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  // Don't auto-save gateway settings on every keystroke - only save when user clicks "Connect"
  // This prevents breaking the UI when typing a new gateway address

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
    // Only try to connect if we have saved credentials
    const savedAddr = localStorage.getItem('gateway_addr');
    const savedToken = localStorage.getItem('gateway_token');

    if (savedAddr && savedToken) {
      // Initial load (silent)
      initializeApp(true);
    } else {
      // No saved credentials - just clear loading state
      setLoading(false);
    }

    // Safety timeout: if loading doesn't clear within 10 seconds, force it to false
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 10000);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (activeView === 'settings') {
      // Fetch data for settings page, but don't let errors break the UI
      Promise.all([
        fetchAgents().catch(e => console.error('Failed to fetch agents:', e)),
        fetchConfig().catch(e => console.error('Failed to fetch config:', e)),
        fetchTools().catch(e => console.error('Failed to fetch tools:', e))
      ]);

      if (activeSettingsSection === 'gateway') {
        fetchConnectedClients().catch(e => console.error('Failed to fetch clients:', e));
        const interval = setInterval(() => {
          fetchConnectedClients().catch(e => console.error('Failed to fetch clients:', e));
        }, 5000);
        return () => clearInterval(interval);
      }
    }
  }, [activeView, activeSettingsSection, settingsAgentId]);

  useEffect(() => {
    if (config?.providers?.length) {
      fetchModels();
    }
  }, [config?.providers]);

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
      // Test connection first before saving to localStorage
      const testResponse = await fetch(getApiUrl('/api/config'), {
        headers: { 'Authorization': `Bearer ${gatewayToken}` },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!testResponse.ok) {
        throw new Error('Authentication failed or gateway unreachable');
      }

      // Connection successful - save to localStorage
      localStorage.setItem('gateway_addr', gatewayAddr);
      localStorage.setItem('gateway_token', gatewayToken);

      // Now fetch all data
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
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      console.error('Gateway connection failed:', errorMsg);

      if (!isSilent) {
        toast.error('Connection Failed', {
          description: `Could not connect to gateway at ${gatewayAddr}. ${errorMsg}`
        });
      }

      // Don't save failed connection to localStorage
      // Revert to saved values if they exist
      const savedAddr = localStorage.getItem('gateway_addr');
      const savedToken = localStorage.getItem('gateway_token');
      if (savedAddr && savedToken && !isSilent) {
        setGatewayAddr(savedAddr);
        setGatewayToken(savedToken);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      isAtBottom.current = distanceToBottom < 10; // 10px threshold
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
      // Set selectedAgentId to first agent if current selection doesn't exist
      if (data.length > 0 && !data.find((a: Agent) => a.id === selectedAgentId)) {
        setSelectedAgentId(data[0].id);
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

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      const modelList = data.data.map((m: any) => m.id);
      setModels(modelList);

      toast.success(`Success! Found ${modelList.length} model${modelList.length !== 1 ? 's' : ''}`, {
        description: modelList.length > 0 ? `Available models: ${modelList.slice(0, 3).join(', ')}${modelList.length > 3 ? '...' : ''}` : 'No models available'
      });

      return true;
    } catch (error) {
      console.error('Failed to fetch models:', error);
      toast.error('Failed to scan for models', {
        description: error instanceof Error ? error.message : 'Could not connect to LLM provider. Please check the endpoint URL.'
      });
      return false;
    }
  }

  const saveConfig = async (e?: React.FormEvent, configOverride?: Config) => {
    if (e) e.preventDefault();
    const configToSave = configOverride || config;
    if (!configToSave) return;
    try {
      const response = await fetch(getApiUrl('/api/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gatewayToken}`
        },
        body: JSON.stringify(configToSave),
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

      // Refresh local config state from server to ensure we're in sync
      fetchConfig();
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const saveAgentConfig = async () => {
    try {
      // Use agentsPageAgentId if on agents page, otherwise use settingsAgentId
      const agentId = activeView === 'agents' ? agentsPageAgentId : settingsAgentId;

      if (!agentId) {
        console.error('No agent selected');
        return;
      }

      const response = await fetch(getApiUrl(`/api/agents/${agentId}/config`), {
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
      const response = await fetch(getApiUrl(`/api/agents/${viewingFile.agentId}/files/${viewingFile.title}`), {
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

  const processSessionMessages = (msgs: Message[]) => {
    const processed: Message[] = [];
    msgs.forEach(msg => {
      // Check for thought/reasoning tags in assistant messages
      if (msg.role === 'assistant' && /<(think|thought|reasoning)>/.test(msg.content)) {
        const thinkMatch = msg.content.match(/<(think|thought|reasoning)>([\s\S]*?)<\/\1>/i);
        if (thinkMatch) {
          // Add the reasoning message
          processed.push({
            role: 'reasoning',
            content: thinkMatch[2],
            timestamp: msg.timestamp
          });

          // Add the clean assistant message
          const cleanContent = msg.content.replace(thinkMatch[0], '').trim();
          if (cleanContent) {
            processed.push({
              role: 'assistant',
              content: cleanContent,
              timestamp: msg.timestamp
            });
          }
        } else {
          // In case of malformed tags, keep original
          processed.push(msg);
        }
      } else {
        processed.push(msg);
      }
    });
    return processed;
  };

  const loadSession = (session: Session) => {
    setActiveSessionId(session.id);
    setSelectedAgentId(session.agentId);
    setMessages(processSessionMessages(session.messages));
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
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        shouldSummarize: config?.chat.generateSummaries || false
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
                  <span className="flex-1 text-sm font-medium truncate" title={s.summary || s.title}>
                    {s.summary || s.title}
                  </span>
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
            <ChatPage
              agents={agents}
              selectedAgentId={selectedAgentId}
              setSelectedAgentId={setSelectedAgentId}
              messages={messages}
              config={config}
              isStreaming={isStreaming}
              inputText={inputText}
              setInputText={setInputText}
              handleSend={handleSend}
              isGatewayConnected={isGatewayConnected}
              messagesEndRef={messagesEndRef}
              textareaRef={textareaRef}
              chatContainerRef={chatContainerRef}
              handleScroll={handleScroll}
              formatTimestamp={formatTimestamp}
            />
          ) : activeView === 'logs' ? (
            <LogsPage logs={logs} />
          ) : activeView === 'agents' ? (
            <AgentsPage
              gatewayAddr={gatewayAddr}
              gatewayToken={gatewayToken}
              setViewingFile={setViewingFile}
              agentForm={agentForm}
              setAgentForm={setAgentForm}
              saveAgentConfig={saveAgentConfig}
              fetchAgents={fetchAgents}
              selectedAgentId={agentsPageAgentId}
              setSelectedAgentId={setAgentsPageAgentId}
              providers={config?.providers || []}
            />
          ) : activeView === 'providers' ? (
            <ProvidersPage
              config={config}
              setConfig={setConfig}
              models={models}
              saveConfig={saveConfig}
              fetchModels={fetchModels}
            />
          ) : activeView === 'gateway' ? (
            <GatewayPage />
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
              fetchModels={fetchModels}
              tools={tools}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
