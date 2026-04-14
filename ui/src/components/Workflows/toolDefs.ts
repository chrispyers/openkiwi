import {
    faEnvelope, faListCheck, faCalendar, faCode, faCodeBranch,
    faShieldHalved, faMagnifyingGlass, faCloud, faTerminal, faFolder,
    faEye, faRobot, faDatabase, faWrench, faFileLines, faBook
} from '@fortawesome/free-solid-svg-icons'

export interface ToolDef {
    id: string;
    name: string;
    category: string;
    icon: any;
    color: string;
    description: string;
}

export const TOOLS: ToolDef[] = [
    { id: 'google_gmail', name: 'Gmail', category: 'Google', icon: faEnvelope, color: '#EA4335', description: 'Read, search, and send emails' },
    { id: 'google_tasks', name: 'Tasks', category: 'Google', icon: faListCheck, color: '#4285F4', description: 'Manage Google Tasks lists' },
    { id: 'google_calendar', name: 'Calendar', category: 'Google', icon: faCalendar, color: '#34A853', description: 'Manage calendar events' },
    { id: 'github', name: 'GitHub', category: 'Dev', icon: faCode, color: '#6e40c9', description: 'Interact with GitHub repos' },
    { id: 'git', name: 'Git', category: 'Dev', icon: faCodeBranch, color: '#F05033', description: 'Run git commands in the workspace' },
    { id: 'security_scanner', name: 'Security Scanner', category: 'Security', icon: faShieldHalved, color: '#E53E3E', description: 'Run Semgrep, Gitleaks, Bandit, or Trivy' },
    { id: 'confluence', name: 'Confluence', category: 'Data', icon: faBook, color: '#0052CC', description: 'Download all pages from a Confluence space as Markdown files' },
    { id: 'report_writer', name: 'Report Writer', category: 'Data', icon: faFileLines, color: '#2B6CB0', description: 'Aggregate files into an AI-generated summary report' },
    { id: 'web_search', name: 'Web Search', category: 'Web', icon: faMagnifyingGlass, color: '#F5A623', description: 'Search the web' },
    { id: 'web_fetch', name: 'Web Fetch', category: 'Web', icon: faCloud, color: '#7B68EE', description: 'Fetch content from a URL' },
    { id: 'curl', name: 'Curl', category: 'Web', icon: faCloud, color: '#38A169', description: 'Call JSON APIs and public endpoints directly' },
    { id: 'bash', name: 'Bash', category: 'System', icon: faTerminal, color: '#2D2D2D', description: 'Execute shell commands' },
    { id: 'file_manager', name: 'File Operations', category: 'System', icon: faFolder, color: '#E8A020', description: 'Delete, clear, move, copy, and create directories' },
    { id: 'describe_image', name: 'Vision', category: 'AI', icon: faEye, color: '#9B59B6', description: 'Analyze images with AI' },
    { id: 'agent', name: 'Agent', category: 'AI', icon: faRobot, color: '#1ABC9C', description: 'Delegate to an AI agent' },
    { id: 'qdrant', name: 'Qdrant', category: 'Data', icon: faDatabase, color: '#DC3545', description: 'Vector database operations' },
    { id: 'weather', name: 'Weather', category: 'Data', icon: faCloud, color: '#3498DB', description: 'Fetch weather data' },
]

export const TOOL_CATEGORIES = ['Security', 'Dev', 'Google', 'Web', 'AI', 'System', 'Data']

export function getToolDef(id: string): ToolDef {
    return TOOLS.find(t => t.id === id) ?? {
        id,
        name: id,
        category: 'Other',
        icon: faWrench,
        color: '#888888',
        description: ''
    }
}

/** Extract tool_id from a workflow state's instructions JSON */
export function toolIdFromInstructions(instructions: string | null | undefined): string {
    try {
        const parsed = JSON.parse(instructions ?? '')
        if (parsed.tool_id) return parsed.tool_id
    } catch { /* plain text */ }
    return 'web_fetch'
}
