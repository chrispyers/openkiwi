import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { useTheme } from './contexts/ThemeContext'
import Button from './components/Button'
import Header from './components/Header'
import Modal from './components/Modal'
import MarkdownRenderer from './components/MarkdownRenderer'
import AgentsPage from './components/pages/AgentsPage/AgentsPage'
import ModelsPage from './components/pages/ModelsPage'
import LogsPage from './components/pages/LogsPage'
import GatewayPage from './components/pages/GatewayPage'
import SettingsPage from './components/pages/SettingsPage/SettingsPage'
import ChatPage from './components/pages/ChatPage'
import ActivityPage from './components/pages/ActivityPage'
import WorkflowsPage from './components/pages/WorkflowsPage'
import ProjectsPage from './components/pages/ProjectsPage'
import WorkspacePage from './components/pages/WorkspacePage'
import SkillsPage from './components/pages/SettingsPage/Settings_Skills'
import Sidebar from './components/Sidebar'
import {
  faPlus,
  faSave,
  faEdit,
  faSearch
} from '@fortawesome/free-solid-svg-icons'
import SessionButton from './components/SessionButton'
import SessionGroup from './components/SessionGroup'
import Input from './components/Input'
import { Message, Agent, Session, Model, Config, AgentState } from './types';

interface LogEntry {
  id: number;
  timestamp: number;
  type: 'request' | 'response' | 'error' | 'tool' | 'system';
  agentId?: string;
  sessionId?: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

interface ToolDefinition {
  name: string;
  displayName: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  filename?: string;
  isRegistered?: boolean;
  hasReadme?: boolean;
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


  const [activeSettingsSection, setActiveSettingsSection] = useState<'agents' | 'tools' | 'messaging' | 'version' | 'config' | 'chat' | 'general' | 'gateway' | 'connections'>(
    () => (localStorage.getItem('settings_section') as any) ?? 'general'
  );
  const setActiveSettingsSectionPersisted = (section: 'agents' | 'tools' | 'messaging' | 'version' | 'config' | 'chat' | 'general' | 'gateway' | 'connections') => {
    localStorage.setItem('settings_section', section);
    setActiveSettingsSection(section);
  };
  const [whatsappStatus, setWhatsappStatus] = useState<{ connected: boolean, qrCode: string | null, isInitializing?: boolean }>({ connected: false, qrCode: null, isInitializing: false });
  const [telegramStatus, setTelegramStatus] = useState<{ connected: boolean, isInitializing?: boolean, botUsername?: string | null }>({ connected: false, isInitializing: false, botUsername: null });
  const [isNavExpanded, setIsNavExpanded] = useState(() => {
    return localStorage.getItem('isNavExpanded') !== 'false';
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { theme, resolvedTheme, setTheme } = useTheme();
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
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [contextWarning, setContextWarning] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionSearch, setSessionSearch] = useState('');
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [connectedClients, setConnectedClients] = useState<any[]>([]);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({});

  // Settings: Agent Specific State
  const [settingsAgentId, setSettingsAgentId] = useState<string>('');
  const [agentsPageAgentId, setAgentsPageAgentId] = useState<string>('');
  const [agentForm, setAgentForm] = useState<{ name: string; avatar?: string; provider?: string; group?: string; heartbeat?: { enabled: boolean; schedule: string; allowManualTrigger?: boolean; } }>({ name: '', provider: '', heartbeat: { enabled: false, schedule: '0 * * * *', allowManualTrigger: false } });
  const [viewingFile, setViewingFile] = useState<{ title: string, content: string, isEditing: boolean, agentId: string } | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<any>(null);
  const [isGatewayConnected, setIsGatewayConnected] = useState(false);
  const [isProjectManagementEnabled, setIsProjectManagementEnabled] = useState(() => {
    return localStorage.getItem('experimental_projects') === 'true';
  });
  const [isAgentActivityEnabled, setIsAgentActivityEnabled] = useState(() => {
    return localStorage.getItem('experimental_activity') === 'true';
  });
  const [isProjectsEnabled, setIsProjectsEnabled] = useState(() => {
    return localStorage.getItem('experimental_project_management') === 'true';
  });

  useEffect(() => {
    if (location.pathname === '/') {
      navigate('/chat', { replace: true });
    }

    if (location.pathname === '/files' && !isGatewayConnected && !loading) {
      toast.error("Authentication Required", { description: "Please connect to the gateway to access files." });
      navigate('/gateway', { replace: true });
    }
  }, [location.pathname, navigate, isGatewayConnected, loading]);

  const fetchLogs = async () => {
    try {
      const response = await fetch(getApiUrl('/api/system/logs'), {
        headers: { 'Authorization': `Bearer ${gatewayToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const handleClearLogs = async () => {
    try {
      const response = await fetch(getApiUrl('/api/system/logs/clear'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${gatewayToken}` }
      });
      if (!response.ok) throw new Error('Failed to clear logs');
      toast.success('Logs cleared');
      fetchLogs();
    } catch (error) {
      console.error('Failed to clear logs:', error);
      toast.error('Failed to clear logs');
    }
  };

  useEffect(() => {
    if (activeView === 'logs') {
      fetchLogs();
      const interval = setInterval(fetchLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [activeView, gatewayToken]);

  const ws = useRef<WebSocket | null>(null);
  const presenceWs = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const workflowStepsRef = useRef<any[]>([]);


  // Don't auto-save gateway settings on every keystroke - only save when user clicks "Connect"
  // This prevents breaking the UI when typing a new gateway address

  // Helper for Gateway URLs
  const getApiUrl = (path: string, addr?: string) => `${(addr || gatewayAddr).replace(/\/$/, '')}${path}`;
  const getWsUrl = () => {
    try {
      const url = new URL(gatewayAddr);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const platform = (navigator as any).platform || 'Unknown OS';
      const deviceId = localStorage.getItem('presence_id') || `Device-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      if (!localStorage.getItem('presence_id')) localStorage.setItem('presence_id', deviceId);

      const hostname = encodeURIComponent(`${deviceId} [${platform}]`);
      const token = localStorage.getItem('gateway_token') || '';
      return `${protocol}//${url.host}/ws?hostname=${hostname}&token=${token}`;
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
          // Send authentication message immediately
          socket!.send(JSON.stringify({ type: 'auth', token: gatewayToken }));
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'auth_success') {
              console.log('[Presence] Authenticated successfully');
              setIsGatewayConnected(true);
              // Refresh client list immediately on connection
              if (activeView === 'gateway') fetchConnectedClients();
            } else if (msg.type === 'initial_agent_states') {
              setAgentStates(msg.states || {});
            } else if (msg.type === 'agent_status_update') {
              setAgentStates(prev => ({
                ...prev,
                [msg.agentId]: msg.state
              }));
            } else if (msg.type === 'workflow_step_progress') {
              workflowStepsRef.current = [...workflowStepsRef.current, msg];
              setActiveTool(prev => prev ? { ...prev, workflowProgress: msg } : prev);
            } else if (msg.type === 'session_updated') {
              fetchSessions();
            } else if (msg.type === 'system_error') {
              toast.error(msg.title || 'System Error', {
                description: msg.message,
                duration: 10000,
              });
              if (msg.sessionId === activeSessionId) {
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: msg.message,
                  timestamp: Math.floor(Date.now() / 1000),
                  isError: true,
                  isEphemeral: true
                }]);
              }
            }
          } catch (e) { }
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
    // Fetch public config immediately to get system version/etc
    fetchPublicConfig();

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
    let cancel: (() => void) | undefined;

    if (activeView === 'settings') {
      // Fetch data for settings page, but don't let errors break the UI
      Promise.all([
        fetchAgents().catch(e => console.error('Failed to fetch agents:', e)),
        fetchConfig().catch(e => console.error('Failed to fetch config:', e)),
        fetchTools().catch(e => console.error('Failed to fetch tools:', e))
      ]);
    } else if (activeView === 'gateway') {
      fetchConnectedClients().catch(e => console.error('Failed to fetch clients:', e));
      const interval = setInterval(() => {
        fetchConnectedClients().catch(e => console.error('Failed to fetch clients:', e));
      }, 5000);
      cancel = () => clearInterval(interval);
    } else if (activeView === 'chat' && isGatewayConnected) {
      fetchAgents().catch(e => console.error('Failed to fetch agents:', e));
    }

    return cancel;
  }, [activeView, isGatewayConnected]);

  // Handle messaging section specific updates
  useEffect(() => {
    let interval: any;
    if (activeView === 'settings' && activeSettingsSection === 'messaging') {
      fetchWhatsAppStatus();
      fetchTelegramStatus();
      interval = setInterval(() => {
        fetchWhatsAppStatus();
        fetchTelegramStatus();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeView, activeSettingsSection]);

  // Removed automatic fetchModels on config load to make discovery opt-in

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

  // Reset session when leaving chat view
  useEffect(() => {
    if (activeView !== 'chat') {
      setActiveSessionId(null);
      setSelectedAgentId('');
      setMessages([]);
      setInputText('');
    }
  }, [activeView]);



  // ... (rest of code) ...

  const initializeApp = async (isSilent = false, addrOverride?: string, tokenOverride?: string) => {
    const finalAddr = addrOverride || gatewayAddr;
    const finalToken = tokenOverride || gatewayToken;

    setLoading(true);
    try {
      // Test connection first before saving to localStorage
      const testResponse = await fetch(getApiUrl('/api/config', finalAddr), {
        headers: { 'Authorization': `Bearer ${finalToken}` },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!testResponse.ok) {
        throw new Error('Authentication failed or gateway unreachable');
      }

      // Connection successful - save to global state and localStorage
      setGatewayAddr(finalAddr);
      setGatewayToken(finalToken);
      localStorage.setItem('gateway_addr', finalAddr);
      localStorage.setItem('gateway_token', finalToken);

      // Now fetch all data using the confirmed credentials
      await Promise.all([
        fetchConfig(finalAddr, finalToken),
        fetchAgents(finalAddr, finalToken),
        fetchSessions(finalAddr, finalToken),
        fetchTools(finalAddr, finalToken),
        fetchConnectedClients(finalAddr, finalToken)
      ]);

      if (!isSilent) {
        toast.success('Connected to Gateway', { description: 'Successfully authenticated and synced.' });
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      console.error('Gateway connection failed:', errorMsg);

      if (!isSilent) {
        toast.error('Connection Failed', {
          description: `Could not connect to gateway at ${finalAddr}. ${errorMsg}`
        });
      }

      // Revert in-memory values if we were trying a manual connect and it failed
      if (addrOverride || tokenOverride) {
        // No action needed as we didn't update the state yet
      }
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      isAtBottom.current = distanceToBottom < 40; // 40px threshold
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

  async function fetchPublicConfig(addr?: string) {
    try {
      const response = await fetch(getApiUrl('/api/config/public', addr));
      if (response.ok) {
        const data = await response.json();
        // Only set if we don't have a full config or if we want to update public parts
        setConfig(prev => {
          if (!prev) return data;
          return {
            ...prev,
            system: data.system,
            gateway: {
              ...prev.gateway,
              port: data.gateway.port,
              endpoint: data.gateway.endpoint
            }
          };
        });
      }
    } catch (error) {
      console.error('Failed to fetch public config:', error);
    }
  }

  async function fetchConnectedClients(addr?: string, token?: string) {
    try {
      const response = await fetch(getApiUrl('/api/config/clients', addr), {
        headers: { 'Authorization': `Bearer ${token || gatewayToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch clients');
      const data = await response.json();
      setConnectedClients(data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  }

  async function fetchConfig(addr?: string, token?: string) {
    try {
      const response = await fetch(getApiUrl('/api/config', addr), {
        headers: { 'Authorization': `Bearer ${token || gatewayToken}` }
      });
      if (!response.ok) throw new Error('Auth Failed');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to fetch config:', error);
      throw error;
    }
  }

  async function fetchTools(addr?: string, token?: string) {
    try {
      const response = await fetch(getApiUrl('/api/tools', addr), {
        headers: { 'Authorization': `Bearer ${token || gatewayToken}` }
      });
      if (!response.ok) throw new Error('Auth Failed');
      const data = await response.json() as { definitions: any[], availableFiles: string[] };

      // Pull current enabled tools from config to match with filenames
      // definitions are already loaded/registered tools
      // availableFiles are all files in tools/

      const configResponse = await fetch(getApiUrl('/api/config', addr), {
        headers: { 'Authorization': `Bearer ${token || gatewayToken}` }
      });
      const currentConfig = await configResponse.json() as Config;
      const enabledTools = currentConfig.enabledTools || {};

      const combinedTools: ToolDefinition[] = [
        ...data.definitions.map(d => ({ ...d, displayName: d.displayName || d.name, isRegistered: true }))
      ];

      // Add files that aren't registered yet
      (data.availableFiles as any[]).forEach(toolFile => {
        const file = typeof toolFile === 'string' ? toolFile : toolFile.filename;
        const hasReadme = typeof toolFile === 'string' ? false : toolFile.hasReadme;

        const existingTool = combinedTools.find(t => t.filename === file);
        if (!existingTool) {
          combinedTools.push({
            name: file,
            displayName: file,
            description: "This tool is currently disabled. Enable it to load its capabilities.",
            parameters: { type: 'object', properties: {} },
            filename: file,
            isRegistered: false,
            hasReadme
          });
        } else {
          existingTool.hasReadme = hasReadme;
        }
      });

      setTools(combinedTools);
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      throw error;
    }
  }

  async function fetchWhatsAppStatus() {
    try {
      const response = await fetch(getApiUrl('/api/whatsapp/status'), {
        headers: { 'Authorization': `Bearer ${gatewayToken}` }
      });
      if (!response.ok) throw new Error('Auth Failed');
      const data = await response.json();
      setWhatsappStatus(data);
    } catch (error) {
      console.error('Failed to fetch WhatsApp status:', error);
    }
  }

  const onLogoutWhatsApp = async () => {
    try {
      const response = await fetch(getApiUrl('/api/whatsapp/logout'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gatewayToken}`
        }
      });
      if (!response.ok) throw new Error('Logout Failed');
      await fetchWhatsAppStatus();
      toast.success('Disconnected from WhatsApp');
    } catch (error) {
      console.error('Failed to logout from WhatsApp:', error);
      toast.error('Failed to logout');
    }
  };

  const onConnectWhatsApp = async () => {
    try {
      const response = await fetch(getApiUrl('/api/whatsapp/connect'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gatewayToken}`
        }
      });
      if (!response.ok) throw new Error('Connection Failed');
      await fetchWhatsAppStatus();
      toast.success('WhatsApp initialization started');
    } catch (error) {
      console.error('Failed to connect to WhatsApp:', error);
      toast.error('Failed to start WhatsApp connection');
    }
  };

  async function fetchTelegramStatus() {
    try {
      const response = await fetch(getApiUrl('/api/telegram/status'), {
        headers: { 'Authorization': `Bearer ${gatewayToken}` }
      });
      if (!response.ok) throw new Error('Auth Failed');
      const data = await response.json();
      setTelegramStatus(data);
    } catch (error) {
      console.error('Failed to fetch Telegram status:', error);
    }
  }

  const onConnectTelegram = async () => {
    try {
      const response = await fetch(getApiUrl('/api/telegram/connect'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gatewayToken}`
        }
      });
      if (!response.ok) throw new Error('Connection Failed');
      await fetchTelegramStatus();
      toast.success('Telegram bot initialization started');
    } catch (error) {
      console.error('Failed to connect Telegram bot:', error);
      toast.error('Failed to start Telegram bot');
    }
  };

  const onDisconnectTelegram = async () => {
    try {
      const response = await fetch(getApiUrl('/api/telegram/disconnect'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gatewayToken}`
        }
      });
      if (!response.ok) throw new Error('Disconnect Failed');
      await fetchTelegramStatus();
      toast.success('Telegram bot disconnected');
    } catch (error) {
      console.error('Failed to disconnect Telegram bot:', error);
      toast.error('Failed to disconnect');
    }
  };

  async function fetchAgents(addr?: string, token?: string) {
    try {
      const response = await fetch(getApiUrl('/api/agents', addr), {
        headers: { 'Authorization': `Bearer ${token || gatewayToken}` }
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

  useEffect(() => {
    if (!selectedAgentId || !config) {
      setContextWarning(null);
      return;
    }
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) { setContextWarning(null); return; }

    const providerConfig = config.providers.find(
      p => p.model === agent.provider || p.description === agent.provider
    );
    if (!providerConfig) { setContextWarning(null); return; }

    const endpoint = providerConfig.endpoint.replace(/\/$/, '');

    (async () => {
      try {
        const res = await fetch(`${endpoint}/api/v0/models`);
        if (!res.ok) { setContextWarning(null); return; }
        const json = await res.json();
        const entry = (json?.data as any[])?.find(
          (m: any) => m.id === providerConfig.model || m.id?.includes(providerConfig.model)
        );
        const loaded: number | undefined = entry?.loaded_context_length;
        if (loaded && loaded < 16_000) {
          setContextWarning(
            `This model is loaded with only ${loaded.toLocaleString()} tokens of context. Multi-step tasks may fail silently. In LM Studio, reload the model with a larger context window (32k+ recommended).`
          );
        } else {
          setContextWarning(null);
        }
      } catch {
        setContextWarning(null);
      }
    })();
  }, [selectedAgentId, config]);

  async function fetchSessions(addr?: string, token?: string) {
    try {
      const response = await fetch(getApiUrl('/api/sessions', addr), {
        headers: { 'Authorization': `Bearer ${token || gatewayToken}` }
      });
      if (!response.ok) throw new Error('Auth Failed');
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      throw error;
    }
  }

  async function fetchModels(isSilent = false, configOverride?: { endpoint: string, apiKey?: string }, skipSetState = false, addr?: string, token?: string) {
    try {
      const response = await fetch(getApiUrl('/api/system/models', addr), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || gatewayToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configOverride || {})
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      const rawModels = data.data as any[];

      // Normalize to ensure ID exists (OpenAI uses .id, LM Studio uses .key)
      const fullModels: Model[] = rawModels.map(m => ({
        ...m,
        id: m.id || m.key
      }));

      const modelIds = fullModels.map(m => m.id);

      if (!skipSetState) {
        setModels(modelIds);
      }

      if (!isSilent) {
        toast.success(`Found ${modelIds.length} model${modelIds.length !== 1 ? 's' : ''}`, {
          // description: modelIds.length > 0 ? `Available models: ${modelIds.slice(0, 3).join(', ')}${modelIds.length > 3 ? '...' : ''}` : 'No models available'
          description: ""
        });
      }

      return fullModels;
    } catch (error) {
      console.error('Failed to fetch models:', error);
      if (!isSilent) {
        toast.error('Failed to scan for models', {
          description: error instanceof Error ? error.message : 'Could not connect to LLM provider. Please check the endpoint URL.'
        });
      }
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
      if (response.ok) {
        if (e) {
          if (activeView === 'gateway') {
            toast.success('Gateway persistent state updated', {
              description: 'Port changes will take effect next time the service is launched.'
            });
          } else {
            toast.success('Configuration saved successfully!');
          }
        }
      } else {
        const errText = await response.text().catch(() => 'Unknown error');
        console.error('Failed to save config:', errText);
        toast.error('Failed to save configuration', { description: errText });
      }

      // Refresh local config state and agents from server to ensure we're in sync
      fetchConfig();
      fetchAgents();
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration — check your connection');
      fetchConfig();
    }
  };

  const saveAgentConfig = async (formOverride?: any, successMessage?: string, successDescription?: string) => {
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
        body: JSON.stringify(formOverride || agentForm),
      });
      if (response.ok) {
        toast.success(successMessage || 'Agent configuration updated!', {
          description: successDescription || 'The AI will now recognize its new identity.'
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
    setSelectedAgentId('');
    setMessages([]);
    setInputText('');
    isAtBottom.current = true;
  };

  const processSessionMessages = (msgs: Message[]) => {
    const processed: Message[] = [];

    msgs.forEach(msg => {
      // Check for thought/reasoning tags in assistant messages
      if (msg.role === 'assistant' && msg.content && (/<(think|thought|reasoning)>|<\|channel\|>/.test(msg.content) || msg.content.includes('</think>'))) {
        const thinkMatch = msg.content.match(/<(think|thought|reasoning)>([\s\S]*?)<\/\1>/i);
        // Qwen 3.5 style: reasoning emitted without opening tag, closed with </think>
        const implicitThinkMatch = !thinkMatch && /^([\s\S]*?)<\/think>([\s\S]*)$/.exec(msg.content);
        const channelMatch = !thinkMatch && !implicitThinkMatch && msg.content.match(/<\|channel\|>([\s\S]*?)(?:<\|im_end\|>|$)/i);
        if (implicitThinkMatch) {
          const cleanContent = implicitThinkMatch[2].replace(/^\n+/, '').trim();
          if (cleanContent) {
            // There is a real response after </think> — keep it as a separate bubble
            // and stash the pre-tag text as a (potentially hidden) reasoning bubble.
            processed.push({
              role: 'reasoning',
              content: implicitThinkMatch[1].trim(),
              timestamp: msg.timestamp
            });
            processed.push({ ...msg, content: cleanContent });
          } else {
            // Nothing after </think> — the thinking text IS the model's response for
            // this turn (it was visible as a chat bubble during streaming too). Show it
            // as regular assistant content so it doesn't vanish when "show reasoning" is off.
            processed.push({ ...msg, content: implicitThinkMatch[1].trim() });
          }
        } else if (thinkMatch) {
          // Add the reasoning message
          processed.push({
            role: 'reasoning',
            content: thinkMatch[2],
            timestamp: msg.timestamp
          });

          // Add the clean assistant message
          const cleanContent = msg.content.replace(thinkMatch[0], '').trim();
          // Always push the assistant message if it has content OR tool calls
          if (cleanContent || (msg.tool_calls && msg.tool_calls.length > 0)) {
            processed.push({
              ...msg,
              content: cleanContent
            });
          }
        } else if (channelMatch) {
          // Normalize model-specific <|channel|> routing tokens into a reasoning block.
          // Discard the routing metadata (before <|message|>); only keep the message content.
          const parts = channelMatch[1].split('<|message|>');
          const reasoningContent = (parts.length > 1 ? parts.slice(1).join('\n') : parts[0]).trim();
          processed.push({
            role: 'reasoning',
            content: reasoningContent,
            timestamp: msg.timestamp
          });
          const cleanContent = msg.content.replace(channelMatch[0], '').trim();
          if (cleanContent || (msg.tool_calls && msg.tool_calls.length > 0)) {
            processed.push({ ...msg, content: cleanContent });
          }
        } else {
          processed.push({ ...msg });
        }
      } else {
        // Do not push empty assistant messages without tool calls
        if (msg.role === 'assistant' && !msg.content && (!msg.tool_calls || msg.tool_calls.length === 0)) {
          // skip
        } else {
          processed.push({ ...msg });
        }
      }
    });

    // Merge logic: If we have an assistant message with tools followed by an assistant message with text,
    // merge the tools into the text message to match the streaming experience and avoid empty bubbles.
    const merged: Message[] = [];
    for (let i = 0; i < processed.length; i++) {
      const current = processed[i];

      if (current.role === 'assistant' && !current.content && current.tool_calls && current.tool_calls.length > 0) {
        let nextAssistantIndex = -1;
        for (let j = i + 1; j < processed.length; j++) {
          if (processed[j].role === 'assistant') {
            nextAssistantIndex = j;
            break;
          }
          if (processed[j].role !== 'tool' && processed[j].role !== 'system') break;
        }

        if (nextAssistantIndex !== -1) {
          const nextMsg = processed[nextAssistantIndex];
          nextMsg.tool_calls = [...(current.tool_calls || []), ...(nextMsg.tool_calls || [])];
          continue;
        }
      }
      merged.push(current);
    }

    return merged;
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
        messages: newMessages
          .filter(m => !m.isEphemeral)
          .map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            tool_calls: m.tool_calls,
            tool_call_id: m.tool_call_id,
            name: m.name
          })),
        shouldSummarize: config?.chat.generateSummaries || false
      };
      setLogs(prev => prev); // Removed local logging

      socket.send(JSON.stringify(payload));
    };

    socket.onerror = (err) => {
      console.error('Chat WebSocket Error:', err);
      setIsStreaming(false);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error connecting to the gateway. Please check your connection.', timestamp: Math.floor(Date.now() / 1000) }]);
    };

    let currentAiMessage = '';
    let currentReasoning = '';
    let isInsideReasoning = false;
    let inChannelHeader = false;
    // Tools that completed but haven't been paired with a text segment yet.
    // Mirrors the processSessionMessages merge: tool-only turns get prepended
    // to the next turn that has text, so the interleaving matches post-session.
    let pendingTools: any[] = [];
    // Fully committed message segments (each is one agent loop turn).
    let completedSegments: Message[] = [];
    let currentActiveTool: any = null;

    // Build the messages array to show during streaming.
    // Committed segments come first (already interleaved), then the current
    // in-progress segment (pendingTools + growing text).
    const buildStreamingMsgs = (): Message[] => {
      const msgs: Message[] = [...newMessages];
      if (currentReasoning) {
        msgs.push({ role: 'reasoning', content: currentReasoning, timestamp: aiResponseTimestamp });
      }
      for (const seg of completedSegments) {
        msgs.push(seg);
      }
      if (pendingTools.length > 0 || currentAiMessage) {
        msgs.push({ role: 'assistant', content: currentAiMessage, timestamp: aiResponseTimestamp, tool_calls: [...pendingTools] } as Message);
      }
      return msgs;
    };

    socket.onmessage = (event) => {
      // setLogs(prev => [{ timestamp: new Date().toISOString(), data: `[RECEIVED] ${event.data}` }, ...prev].slice(0, 100)); // Keep last 100 logs

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
            // Discard routing metadata before <|message|>; only keep content after it
            if (chunk.includes('<|message|>')) {
              inChannelHeader = false;
              const afterMessage = chunk.split('<|message|>').slice(1).join('').replace(/<\|im_end\|>/g, '');
              currentReasoning += afterMessage;
            }
            // else: still in header, discard this chunk entirely
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

          // Qwen 3.5 / some models emit reasoning without an opening <think> tag,
          // closing with </think> only. Retroactively split when we detect this.
          if (!currentReasoning && currentAiMessage.includes('</think>')) {
            const closeIdx = currentAiMessage.indexOf('</think>');
            currentReasoning = currentAiMessage.slice(0, closeIdx);
            currentAiMessage = currentAiMessage.slice(closeIdx + '</think>'.length).replace(/^\n+/, '');
          }
        }

        setMessages(buildStreamingMsgs());
      } else if (data.type === 'tool_call') {
        workflowStepsRef.current = [];
        currentActiveTool = { ...data.toolCall, startedAt: Date.now() };
        setActiveTool(currentActiveTool);
        setMessages(buildStreamingMsgs());
      } else if (data.type === 'tool_end') {
        if (currentActiveTool) {
          const steps = workflowStepsRef.current.length > 0 ? [...workflowStepsRef.current] : undefined;
          const completedTool = { ...currentActiveTool, durationMs: data.durationMs, workflowSteps: steps };
          currentActiveTool = null;
          setActiveTool(null);

          if (currentAiMessage) {
            // This turn had text before the tool call — commit it as a finished segment.
            completedSegments.push({
              role: 'assistant',
              content: currentAiMessage,
              tool_calls: [...pendingTools, completedTool],
              timestamp: aiResponseTimestamp,
            } as Message);
            pendingTools = [];
            currentAiMessage = '';
          } else {
            // No text for this turn yet — hold the tool as pending so it gets
            // prepended to the next segment that has text (matching the
            // processSessionMessages merge behaviour).
            pendingTools.push(completedTool);
          }

          setMessages(buildStreamingMsgs());
        }
      } else if (data.type === 'usage') {
        const stats = {
          tps: data.usage.tps,
          tokens: data.usage.completion_tokens || data.usage.output_tokens || data.usage.total_output_tokens,
          inputTokens: data.usage.prompt_tokens || data.usage.input_tokens || data.usage.input_tokens,
          outputTokens: data.usage.completion_tokens || data.usage.output_tokens || data.usage.total_output_tokens,
          totalTokens: data.usage.total_tokens
        };
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
          setMessages(processSessionMessages(data.messages));
        }
        fetchSessions();
      } else if (data.type === 'error') {
        setIsStreaming(false);
        setMessages(prev => [...prev, { role: 'assistant', content: data.message, timestamp: aiResponseTimestamp, isError: true }]);
        socket.close();
      }
    };
  };

  const handleStop = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (isStreaming && ws.current) {
      ws.current.send(JSON.stringify({ type: 'stop' }));
    }
  };

  const activeAgentInSettings = agents.find(a => a.id === settingsAgentId);
  const hasActiveAgents = agents.some(agent => (agentStates[agent.id]?.status || 'idle') !== 'idle');

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <Toaster
        position="top-right"
        theme={resolvedTheme === 'light' ? 'dark' : 'light'}
        richColors
        toastOptions={{
          style: {
            background: resolvedTheme === 'light' ? '#262626' : '#f5f5f5',
            border: `1px solid ${resolvedTheme === 'light' ? '#404040' : '#e5e5e5'}`,
            color: resolvedTheme === 'light' ? '#fafafa' : '#171717',
            fontFamily: 'Outfit, sans-serif'
          }
        }}
      />
      {/* Modal Overlay */}


      <Header
        isGatewayConnected={isGatewayConnected}
        onMenuClick={() => {
          const newState = !isNavExpanded;
          setIsNavExpanded(newState);
          localStorage.setItem('isNavExpanded', String(newState));
        }}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Primary Sidebar */}
        <Sidebar
          isNavExpanded={isNavExpanded}
          activeView={activeView}
          createNewSession={createNewSession}
          isGatewayConnected={isGatewayConnected}
          hasAgents={agents.length > 0}
          hasModels={(config?.providers?.length ?? 0) > 0}
          hasActiveAgents={hasActiveAgents}
          hasUpdates={config?.system?.latestVersion && config?.system?.version ? config.system.latestVersion > config.system.version : false}
          onSettingsClick={() => {}}
          isProjectManagementEnabled={isProjectManagementEnabled}
          isProjectsEnabled={isProjectsEnabled}
          isAgentActivityEnabled={isAgentActivityEnabled}
        />

        {/* Secondary Sidebar (Chat Sessions) */}
        {activeView === 'chat' && (
          <nav className="w-72 bg-sidebar border-r border-divider flex flex-col z-50 transition-all duration-300">
            <div className="p-5 pb-3 flex flex-col gap-3">
              <Button
                className="w-full"
                themed={true}
                icon={faPlus}
                onClick={createNewSession}
                disabled={!isGatewayConnected}
              >
                New Chat
              </Button>
              <Input
                placeholder="Search"
                currentText={sessionSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSessionSearch(e.target.value)}
                icon={faSearch}
                clearText={() => setSessionSearch('')}
              />
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-1 py-2">
              {(() => {
                const query = sessionSearch.toLowerCase().trim();
                const matchesQuery = (s: Session) =>
                  !query ||
                  (s.title || '').toLowerCase().includes(query) ||
                  (s.summary || '').toLowerCase().includes(query);
                return (
                  <>
                    {agents.map(agent => (
                      <SessionGroup
                        key={agent.id}
                        agent={agent}
                        sessions={sessions.filter(s => s.agentId === agent.id && matchesQuery(s))}
                        activeSessionId={activeSessionId}
                        onLoadSession={loadSession}
                        onDeleteSession={deleteSession}
                        formatTimestamp={formatTimestamp}
                        forceExpanded={!!query}
                      />
                    ))}
                    {/* Orphaned sessions */}
                    {sessions.filter(s => !agents.find(a => a.id === s.agentId) && matchesQuery(s)).map(s => (
                      <SessionButton
                        key={s.id}
                        session={s}
                        isActive={activeSessionId === s.id}
                        agent={undefined}
                        onLoadSession={loadSession}
                        onDeleteSession={deleteSession}
                        formatTimestamp={formatTimestamp}
                      />
                    ))}
                  </>
                );
              })()}
            </div>
          </nav>
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {activeView === 'chat' ? (
            <ChatPage
              agents={agents}
              selectedAgentId={selectedAgentId}
              setSelectedAgentId={setSelectedAgentId}
              messages={messages}
              config={config}
              isStreaming={isStreaming}
              activeTool={activeTool}
              inputText={inputText}
              setInputText={setInputText}
              handleSend={handleSend}
              handleStop={handleStop}
              isGatewayConnected={isGatewayConnected}
              messagesEndRef={messagesEndRef}
              textareaRef={textareaRef}
              chatContainerRef={chatContainerRef}
              handleScroll={handleScroll}
              formatTimestamp={formatTimestamp}
              contextWarning={contextWarning}
            />
          ) : activeView === 'logs' ? (
            <LogsPage logs={logs} onClear={handleClearLogs} />
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
              agents={agents}
              allowManualHeartbeat={config?.heartbeat?.allowManualTrigger || false}
              agentStates={agentStates}
            />
          ) : activeView === 'workflows' ? (
            <WorkflowsPage
              gatewayAddr={gatewayAddr}
              gatewayToken={gatewayToken}
            />
          ) : activeView === 'models' ? (
            <ModelsPage
              config={config}
              setConfig={setConfig}
              models={models}
              saveConfig={saveConfig}
              fetchModels={fetchModels}
              agents={agents}
            />
          ) : activeView === 'gateway' ? (
            <GatewayPage
              gatewayAddr={gatewayAddr}
              gatewayToken={gatewayToken}
              isGatewayConnected={isGatewayConnected}
              initializeApp={initializeApp}
              connectedClients={connectedClients}
              fetchConnectedClients={fetchConnectedClients}
              config={config}
              saveConfig={saveConfig}
            />
          ) : activeView === 'activity' ? (
            <ActivityPage agents={agents} agentStates={agentStates} />
          ) : activeView === 'projects' ? (
            <ProjectsPage gatewayAddr={gatewayAddr} gatewayToken={gatewayToken} />
          ) : activeView === 'files' ? (
            <WorkspacePage gatewayAddr={gatewayAddr} gatewayToken={gatewayToken} />
          ) : activeView === 'skills' ? (
            <SkillsPage gatewayAddr={gatewayAddr} gatewayToken={gatewayToken} />
          ) : (
            <SettingsPage
              activeSettingsSection={activeSettingsSection}
              setActiveSettingsSection={setActiveSettingsSectionPersisted}
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
              tools={tools}
              whatsappStatus={whatsappStatus}
              onLogoutWhatsApp={onLogoutWhatsApp}
              onConnectWhatsApp={onConnectWhatsApp}
              telegramStatus={telegramStatus}
              onConnectTelegram={onConnectTelegram}
              onDisconnectTelegram={onDisconnectTelegram}
              gatewayAddr={gatewayAddr}
              gatewayToken={gatewayToken}
              isProjectManagementEnabled={isProjectManagementEnabled}
              setIsProjectManagementEnabled={setIsProjectManagementEnabled}
              isAgentActivityEnabled={isAgentActivityEnabled}
              setIsAgentActivityEnabled={setIsAgentActivityEnabled}
              isProjectsEnabled={isProjectsEnabled}
              setIsProjectsEnabled={setIsProjectsEnabled}
            />
          )}
        </main>
      </div>
      {/* Modals rendered at the end to ensure proper z-index and backdrop-blur across all elements */}
      <Modal
        isOpen={!!viewingFile}
        onClose={() => setViewingFile(null)}
        title={viewingFile && (
          <span>{viewingFile.title}</span>
        )}
        headerActions={viewingFile && (
          !viewingFile.isEditing ? (
            <Button onClick={() => setViewingFile({ ...viewingFile, isEditing: true })} icon={faEdit}></Button>
          ) : (
            <Button onClick={saveAgentFile} icon={faSave}></Button>
          )
        )}
      >
        <div className="flex-1 overflow-y-auto p-8 h-full">
          {viewingFile && (viewingFile.isEditing ? (
            <textarea
              className="w-full h-[60vh] p-6 bg-surface border border-divider rounded-2xl outline-none focus:border-accent-primary transition-colors resize-none font-mono text-sm leading-relaxed text-neutral-600 dark:text-white"
              value={viewingFile.content}
              onChange={e => setViewingFile({ ...viewingFile, content: e.target.value })}
            />
          ) : (
            <MarkdownRenderer content={viewingFile.content} />
          ))}
        </div>
      </Modal>

      {/* Update Modals have been moved to the VERSION section */}
    </div>
  )
}

export default App
