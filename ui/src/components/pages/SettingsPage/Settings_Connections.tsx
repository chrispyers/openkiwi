import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import Page from '../Page'
import Card from '../../Card'
import Text from '../../Text'
import Row from '../../Row'
import Column from '../../Column'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faCircleXmark, faRotateRight, faEye, faEyeSlash, faTag, faKey, faLink, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import LMStudioIcon from '../../../img/lmstudio.png'
import LemonadeIcon from '../../../img/lemonade.png'
import GoogleIcon from '../../../img/google.png'
import OpenAIIcon from '../../../img/openai.svg.png'
import OllamaIcon from '../../../img/ollama.png'
import OpenRouterIcon from '../../../img/openrouter.png'
import SegmentedControl from '../../SegmentedControl'
import Input from '../../Input'
import Button from '../../Button'

// ── Logos ──────────────────────────────────────────────────────────────────────

const GoogleLogo = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
)

const GitHubLogo = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
)

const LMStudioLogo = () => (
    <img src={LMStudioIcon} alt="LM Studio" width="18" height="18" />
)

const LemonadeLogo = () => (
    <img src={LemonadeIcon} alt="Lemonade" width="18" height="18" />
)

const GoogleAPILogo = () => (
    <img src={GoogleIcon} alt="Google" width="18" height="18" />
)

const OpenAILogo = () => (
    <img src={OpenAIIcon} alt="OpenAI" width="18" height="18" className="dark:invert" />
)

const OllamaLogo = () => (
    <img src={OllamaIcon} alt="Ollama" width="18" height="18" className="dark:invert" />
)

const OpenRouterLogo = () => (
    <img src={OpenRouterIcon} alt="OpenRouter" width="18" height="18" className="dark:invert" />
)

const AnthropicLogo = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017L3.674 20H0L6.57 3.52zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
    </svg>
)

const GitLabLogo = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="#FC6D26" d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" />
    </svg>
)
// ── Helpers ────────────────────────────────────────────────────────────────────

const maskPat = (pat: string) =>
    pat.length <= 8 ? '••••••••' : `${pat.slice(0, 6)}...${pat.slice(-4)}`


const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${ok
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
        }`}>
        <FontAwesomeIcon icon={ok ? faCircleCheck : faCircleXmark} className="text-xs" />
        {label}
    </span>
)

// ── Types ──────────────────────────────────────────────────────────────────────

interface GitConn {
    id: string;
    label: string;
    baseUrl: string;
    pat?: string;
    verified?: boolean;
    verifiedUsername?: string;
}

interface AnthropicConn {
    id: string;
    label: string;
    apiKey: string;
    verified?: boolean;
}

interface LMStudioConn {
    id: string;
    label: string;
    endpoint: string;
}

interface LemonadeConn {
    id: string;
    label: string;
    endpoint: string;
}

interface GoogleAPIConn {
    id: string;
    label: string;
    apiKey: string;
    verified?: boolean;
}

interface OpenAIConn {
    id: string;
    label: string;
    apiKey: string;
    verified?: boolean;
}

interface OllamaConn {
    id: string;
    label: string;
    endpoint: string;
}

interface OpenRouterConn {
    id: string;
    label: string;
    apiKey: string;
    verified?: boolean;
}

interface Config {
    connections?: { git: GitConn[]; anthropic?: AnthropicConn[]; lmstudio?: LMStudioConn[]; lemonade?: LemonadeConn[]; google?: GoogleAPIConn[]; openai?: OpenAIConn[]; ollama?: OllamaConn[]; openrouter?: OpenRouterConn[] };
    [key: string]: any;
}

interface Props {
    gatewayAddr: string;
    gatewayToken: string;
    config: Config | null;
    setConfig: (c: any) => void;
    saveConfig: (e?: any, override?: any) => Promise<void>;
}

// ── CollapsibleProviderCard ────────────────────────────────────────────────────

const CollapsibleProviderCard = ({ header, children }: { header: React.ReactNode; children: React.ReactNode }) => {
    const [open, setOpen] = useState(false)
    return (
        <Card padding={0} className={`border transition-colors ${open ? 'border-neutral-200 dark:border-neutral-700' : 'border-transparent hover:border-neutral-300 dark:hover:border-neutral-600'}`}>
            <div className="flex items-center justify-between cursor-pointer select-none p-6" onClick={() => setOpen(v => !v)}>
                <div className="flex items-center gap-2">{header}</div>
                <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`text-secondary text-xs transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
                />
            </div>
            {open && <div className="flex flex-col gap-3 px-6 pb-6 border-t border-divider pt-4">{children}</div>}
        </Card>
    )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Settings_Connections({ gatewayAddr, gatewayToken, config, setConfig, saveConfig }: Props) {
    const base = gatewayAddr.replace(/\/$/, '')

    const [tab, setTab] = useState<'providers' | 'services'>('providers')

    // ── Google ──────────────────────────────────────────────────────────────────
    const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; email?: string | null }>({ connected: false })
    const [googleLoading, setGoogleLoading] = useState(true)
    const [isConnecting, setIsConnecting] = useState(false)
    const popupRef = useRef<Window | null>(null)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const fetchGoogleStatus = async () => {
        try {
            const res = await fetch(`${base}/api/auth/google/status`, {
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            })
            if (res.ok) setGoogleStatus(await res.json())
        } catch { /* backend not configured */ } finally { setGoogleLoading(false) }
    }

    useEffect(() => { fetchGoogleStatus() }, [gatewayAddr, gatewayToken])
    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

    const handleGoogleConnect = () => {
        const url = `${base}/api/auth/google?token=${encodeURIComponent(gatewayToken)}`
        const popup = window.open(url, 'google-oauth', 'width=520,height=640,left=200,top=100')
        if (!popup) { toast.error('Popup blocked — please allow popups for this page'); return }
        popupRef.current = popup
        setIsConnecting(true)

        const onMessage = (event: MessageEvent) => {
            if (event.data?.type === 'google-oauth-success') {
                window.removeEventListener('message', onMessage)
                if (pollRef.current) clearInterval(pollRef.current)
                popup.close(); setIsConnecting(false); fetchGoogleStatus()
                toast.success('Google account connected')
            } else if (event.data?.type === 'google-oauth-error') {
                window.removeEventListener('message', onMessage)
                if (pollRef.current) clearInterval(pollRef.current)
                popup.close(); setIsConnecting(false)
                toast.error(event.data.message ?? 'Google authentication failed')
            }
        }
        window.addEventListener('message', onMessage)

        pollRef.current = setInterval(() => {
            if (popup.closed) {
                clearInterval(pollRef.current!); window.removeEventListener('message', onMessage)
                setIsConnecting(false); fetchGoogleStatus()
            }
        }, 500)
    }

    const handleGoogleDisconnect = async () => {
        try {
            const res = await fetch(`${base}/api/auth/google/disconnect`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${gatewayToken}` }
            })
            if (res.ok) { setGoogleStatus({ connected: false, email: null }); toast.success('Google account disconnected') }
            else toast.error('Failed to disconnect Google account')
        } catch { toast.error('Error disconnecting Google account') }
    }

    // ── Git connections ─────────────────────────────────────────────────────────

    const gitConns: GitConn[] = config?.connections?.git ?? []
    const githubConn = gitConns.find(c => c.id === 'github')
    const gitlabConn = gitConns.find(c => c.id === 'gitlab')

    // GitHub form state
    const [githubPat, setGithubPat] = useState('')
    const [githubShowPat, setGithubShowPat] = useState(false)
    const [githubBusy, setGithubBusy] = useState(false)
    const [githubEditing, setGithubEditing] = useState(false)

    // GitLab form state
    const [gitlabBaseUrl, setGitlabBaseUrl] = useState('https://gitlab.com')
    const [gitlabPat, setGitlabPat] = useState('')
    const [gitlabShowPat, setGitlabShowPat] = useState(false)
    const [gitlabBusy, setGitlabBusy] = useState(false)
    const [gitlabEditing, setGitlabEditing] = useState(false)

    useEffect(() => {
        if (gitlabConn?.baseUrl) setGitlabBaseUrl(gitlabConn.baseUrl)
    }, [gitlabConn?.baseUrl])

    const verifyAndSave = async (
        id: string,
        label: string,
        baseUrl: string,
        pat: string,
        setBusy: (v: boolean) => void,
        setEditing: (v: boolean) => void
    ) => {
        setBusy(true)
        try {
            const res = await fetch(`${base}/api/config/verify-git-connection`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${gatewayToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseUrl, pat })
            })
            const data = await res.json()

            if (!data.valid) {
                toast.error(data.error ?? 'Invalid personal access token')
                return
            }

            const newConn: GitConn = { id, label, baseUrl, pat, verified: true, verifiedUsername: data.username }
            const updatedGit = [...gitConns.filter(c => c.id !== id), newConn]
            const newConfig = { ...config, connections: { ...config?.connections, git: updatedGit } }
            setConfig(newConfig)
            await saveConfig(undefined, newConfig)

            toast.success(`${label} verified — connected as ${data.username}`)
            setEditing(false)
        } catch (e: any) {
            toast.error(`Verification failed: ${e.message}`)
        } finally {
            setBusy(false)
        }
    }

    const removeConnection = async (id: string, label: string) => {
        const updatedGit = gitConns.filter(c => c.id !== id)
        const newConfig = { ...config, connections: { ...config?.connections, git: updatedGit } }
        setConfig(newConfig)
        await saveConfig(undefined, newConfig)
        toast.success(`${label} disconnected`)
    }

    // ── Anthropic connections ────────────────────────────────────────────────────

    const anthropicConns: AnthropicConn[] = config?.connections?.anthropic ?? []
    const [anthropicLabel, setAnthropicLabel] = useState('')
    const [anthropicKey, setAnthropicKey] = useState('')
    const [anthropicShowKey, setAnthropicShowKey] = useState(false)
    const [anthropicBusy, setAnthropicBusy] = useState(false)
    const [anthropicAdding, setAnthropicAdding] = useState(false)

    const verifyAndSaveAnthropic = async () => {
        setAnthropicBusy(true)
        try {
            const res = await fetch(`${base}/api/config/verify-anthropic-connection`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${gatewayToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: anthropicKey })
            })
            const data = await res.json()
            if (!data.valid) {
                toast.error(data.error ?? 'Invalid API key')
                return
            }
            const newConn: AnthropicConn = {
                id: crypto.randomUUID(),
                label: anthropicLabel.trim() || 'Anthropic',
                apiKey: anthropicKey,
                verified: true,
            }
            const updatedAnthropic = [...anthropicConns, newConn]
            const newConfig = { ...config, connections: { ...config?.connections, anthropic: updatedAnthropic } }
            setConfig(newConfig)
            await saveConfig(undefined, newConfig)
            toast.success(`Connection "${newConn.label}" verified and saved`)
            setAnthropicLabel('')
            setAnthropicKey('')
            setAnthropicAdding(false)
        } catch (e: any) {
            toast.error(`Verification failed: ${e.message}`)
        } finally {
            setAnthropicBusy(false)
        }
    }

    const removeAnthropicConnection = async (id: string, label: string) => {
        const updatedAnthropic = anthropicConns.filter(c => c.id !== id)
        const newConfig = { ...config, connections: { ...config?.connections, anthropic: updatedAnthropic } }
        setConfig(newConfig)
        await saveConfig(undefined, newConfig)
        toast.success(`"${label}" removed`)
    }

    // ── LM Studio connections ────────────────────────────────────────────────────

    const lmstudioConns: LMStudioConn[] = config?.connections?.lmstudio ?? []
    const [lmstudioLabel, setLmstudioLabel] = useState('')
    const [lmstudioEndpoint, setLmstudioEndpoint] = useState('http://localhost:1234')
    const [lmstudioAdding, setLmstudioAdding] = useState(false)

    const saveLMStudioConnection = async () => {
        if (!lmstudioEndpoint.trim()) {
            toast.error('Please enter an endpoint URL')
            return
        }
        const newConn: LMStudioConn = {
            id: crypto.randomUUID(),
            label: lmstudioLabel.trim() || 'LM Studio',
            endpoint: lmstudioEndpoint.trim(),
        }
        const updated = [...lmstudioConns, newConn]
        const newConfig = { ...config, connections: { ...config?.connections, lmstudio: updated } }
        setConfig(newConfig)
        await saveConfig(undefined, newConfig)
        toast.success(`Connection "${newConn.label}" saved`)
        setLmstudioLabel('')
        setLmstudioEndpoint('http://localhost:1234')
        setLmstudioAdding(false)
    }

    const removeLMStudioConnection = async (id: string, label: string) => {
        const updated = lmstudioConns.filter(c => c.id !== id)
        const newConfig = { ...config, connections: { ...config?.connections, lmstudio: updated } }
        setConfig(newConfig)
        await saveConfig(undefined, newConfig)
        toast.success(`"${label}" removed`)
    }

    // ── Lemonade connections ─────────────────────────────────────────────────────

    const lemonadeConns: LemonadeConn[] = config?.connections?.lemonade ?? []
    const [lemonadeLabel, setLemonadeLabel] = useState('')
    const [lemonadeEndpoint, setLemonadeEndpoint] = useState('http://localhost:8000')
    const [lemonadeAdding, setLemonadeAdding] = useState(false)

    const saveLemonadeConnection = async () => {
        if (!lemonadeEndpoint.trim()) {
            toast.error('Please enter an endpoint URL')
            return
        }
        const newConn: LemonadeConn = {
            id: crypto.randomUUID(),
            label: lemonadeLabel.trim() || 'Lemonade',
            endpoint: lemonadeEndpoint.trim(),
        }
        const updated = [...lemonadeConns, newConn]
        const newConfig = { ...config, connections: { ...config?.connections, lemonade: updated } }
        setConfig(newConfig)
        await saveConfig(undefined, newConfig)
        toast.success(`Connection "${newConn.label}" saved`)
        setLemonadeLabel('')
        setLemonadeEndpoint('http://localhost:8000')
        setLemonadeAdding(false)
    }

    const removeLemonadeConnection = async (id: string, label: string) => {
        const updated = lemonadeConns.filter(c => c.id !== id)
        const newConfig = { ...config, connections: { ...config?.connections, lemonade: updated } }
        setConfig(newConfig)
        await saveConfig(undefined, newConfig)
        toast.success(`"${label}" removed`)
    }

    // ── Google API connections ────────────────────────────────────────────────────

    const googleAPIConns: GoogleAPIConn[] = config?.connections?.google ?? []
    const [googleAPILabel, setGoogleAPILabel] = useState('')
    const [googleAPIKey, setGoogleAPIKey] = useState('')
    const [googleAPIShowKey, setGoogleAPIShowKey] = useState(false)
    const [googleAPIBusy, setGoogleAPIBusy] = useState(false)
    const [googleAPIAdding, setGoogleAPIAdding] = useState(false)

    const verifyAndSaveGoogleAPI = async () => {
        setGoogleAPIBusy(true)
        try {
            const res = await fetch(`${base}/api/config/verify-google-connection`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${gatewayToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: googleAPIKey })
            })
            const data = await res.json()
            if (!data.valid) {
                toast.error(data.error ?? 'Invalid API key')
                return
            }
            const newConn: GoogleAPIConn = {
                id: crypto.randomUUID(),
                label: googleAPILabel.trim() || 'Google Gemini',
                apiKey: googleAPIKey,
                verified: true,
            }
            const updated = [...googleAPIConns, newConn]
            const newConfig = { ...config, connections: { ...config?.connections, google: updated } }
            setConfig(newConfig)
            await saveConfig(undefined, newConfig)
            toast.success(`Connection "${newConn.label}" verified and saved`)
            setGoogleAPILabel('')
            setGoogleAPIKey('')
            setGoogleAPIAdding(false)
        } catch (e: any) {
            toast.error(`Verification failed: ${e.message}`)
        } finally {
            setGoogleAPIBusy(false)
        }
    }

    const removeGoogleAPIConnection = async (id: string, label: string) => {
        const updated = googleAPIConns.filter(c => c.id !== id)
        const newConfig = { ...config, connections: { ...config?.connections, google: updated } }
        setConfig(newConfig)
        await saveConfig(undefined, newConfig)
        toast.success(`"${label}" removed`)
    }

    // ── OpenAI connections ────────────────────────────────────────────────────────

    const openAIConns: OpenAIConn[] = config?.connections?.openai ?? []
    const [openAILabel, setOpenAILabel] = useState('')
    const [openAIKey, setOpenAIKey] = useState('')
    const [openAIShowKey, setOpenAIShowKey] = useState(false)
    const [openAIBusy, setOpenAIBusy] = useState(false)
    const [openAIAdding, setOpenAIAdding] = useState(false)

    const verifyAndSaveOpenAI = async () => {
        setOpenAIBusy(true)
        try {
            const res = await fetch(`${base}/api/config/verify-openai-connection`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${gatewayToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: openAIKey })
            })
            const data = await res.json()
            if (!data.valid) {
                toast.error(data.error ?? 'Invalid API key')
                return
            }
            const newConn: OpenAIConn = {
                id: crypto.randomUUID(),
                label: openAILabel.trim() || 'OpenAI',
                apiKey: openAIKey,
                verified: true,
            }
            const updated = [...openAIConns, newConn]
            const newConfig = { ...config, connections: { ...config?.connections, openai: updated } }
            setConfig(newConfig)
            await saveConfig(undefined, newConfig)
            toast.success(`Connection "${newConn.label}" verified and saved`)
            setOpenAILabel('')
            setOpenAIKey('')
            setOpenAIAdding(false)
        } catch (e: any) {
            toast.error(`Verification failed: ${e.message}`)
        } finally {
            setOpenAIBusy(false)
        }
    }

    const removeOpenAIConnection = async (id: string, label: string) => {
        const updated = openAIConns.filter(c => c.id !== id)
        const newConfig = { ...config, connections: { ...config?.connections, openai: updated } }
        setConfig(newConfig)
        await saveConfig(undefined, newConfig)
        toast.success(`"${label}" removed`)
    }

    // ── Ollama connections ────────────────────────────────────────────────────────

    const ollamaConns: OllamaConn[] = config?.connections?.ollama ?? []
    const [ollamaLabel, setOllamaLabel] = useState('')
    const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434')
    const [ollamaAdding, setOllamaAdding] = useState(false)

    const saveOllamaConnection = async () => {
        if (!ollamaEndpoint.trim()) {
            toast.error('Please enter an endpoint URL')
            return
        }
        const newConn: OllamaConn = {
            id: crypto.randomUUID(),
            label: ollamaLabel.trim() || 'Ollama',
            endpoint: ollamaEndpoint.trim(),
        }
        const updated = [...ollamaConns, newConn]
        const newConfig = { ...config, connections: { ...config?.connections, ollama: updated } }
        setConfig(newConfig)
        await saveConfig(undefined, newConfig)
        toast.success(`Connection "${newConn.label}" saved`)
        setOllamaLabel('')
        setOllamaEndpoint('http://localhost:11434')
        setOllamaAdding(false)
    }

    const removeOllamaConnection = async (id: string, label: string) => {
        const updated = ollamaConns.filter(c => c.id !== id)
        const newConfig = { ...config, connections: { ...config?.connections, ollama: updated } }
        setConfig(newConfig)
        await saveConfig(undefined, newConfig)
        toast.success(`"${label}" removed`)
    }

    // ── OpenRouter connections ────────────────────────────────────────────────────

    const openRouterConns: OpenRouterConn[] = config?.connections?.openrouter ?? []
    const [openRouterLabel, setOpenRouterLabel] = useState('')
    const [openRouterKey, setOpenRouterKey] = useState('')
    const [openRouterShowKey, setOpenRouterShowKey] = useState(false)
    const [openRouterBusy, setOpenRouterBusy] = useState(false)
    const [openRouterAdding, setOpenRouterAdding] = useState(false)

    const verifyAndSaveOpenRouter = async () => {
        setOpenRouterBusy(true)
        try {
            const res = await fetch(`${base}/api/config/verify-openrouter-connection`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${gatewayToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: openRouterKey })
            })
            const data = await res.json()
            if (!data.valid) {
                toast.error(data.error ?? 'Invalid API key')
                return
            }
            const newConn: OpenRouterConn = {
                id: crypto.randomUUID(),
                label: openRouterLabel.trim() || 'OpenRouter',
                apiKey: openRouterKey,
                verified: true,
            }
            const updated = [...openRouterConns, newConn]
            const newConfig = { ...config, connections: { ...config?.connections, openrouter: updated } }
            setConfig(newConfig)
            await saveConfig(undefined, newConfig)
            toast.success(`Connection "${newConn.label}" verified and saved`)
            setOpenRouterLabel('')
            setOpenRouterKey('')
            setOpenRouterAdding(false)
        } catch (e: any) {
            toast.error(`Verification failed: ${e.message}`)
        } finally {
            setOpenRouterBusy(false)
        }
    }

    const removeOpenRouterConnection = async (id: string, label: string) => {
        const updated = openRouterConns.filter(c => c.id !== id)
        const newConfig = { ...config, connections: { ...config?.connections, openrouter: updated } }
        setConfig(newConfig)
        await saveConfig(undefined, newConfig)
        toast.success(`"${label}" removed`)
    }

    // ── Shared UI parts ─────────────────────────────────────────────────────────

    const PATInput = ({
        value, onChange, show, onToggleShow, placeholder, disabled
    }: {
        value: string; onChange: (v: string) => void;
        show: boolean; onToggleShow: () => void;
        placeholder?: string; disabled?: boolean;
    }) => (
        <div className="relative flex items-center">
            <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder ?? 'Paste your personal access token'}
                disabled={disabled}
                className="w-full pr-9 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-primary placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-primary disabled:opacity-50 font-mono"
            />
            <button
                type="button"
                onClick={onToggleShow}
                className="absolute right-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
                <FontAwesomeIcon icon={show ? faEyeSlash : faEye} className="text-xs" />
            </button>
        </div>
    )

    // ── Render ──────────────────────────────────────────────────────────────────

    return (
        <Page gridCols={1} padding={0}>

            <SegmentedControl
                options={[
                    { value: 'providers', label: 'Model Providers' },
                    { value: 'services', label: 'Services' },
                ]}
                value={tab}
                onChange={setTab}
            />

            {/* GitHub */}
            {tab === 'services' && <CollapsibleProviderCard header={<>
                <GitHubLogo />
                <Text bold={true}>GitHub</Text>
                {githubConn?.verified
                    ? <StatusBadge ok={true} label="Verified" />
                    : githubConn
                        ? <StatusBadge ok={false} label="Unverified" />
                        : <StatusBadge ok={false} label="Not connected" />
                }
            </>}>
                {githubConn && !githubEditing ? (
                    <>
                        <Text size="sm" secondary={true} block={true} className="mb-1">
                            {githubConn.verifiedUsername ? `Connected as @${githubConn.verifiedUsername}` : 'Token configured'}
                        </Text>
                        <Text size="sm" secondary={true} block={true} className="font-mono mb-3">
                            {githubConn.pat ? maskPat(githubConn.pat) : ''}
                        </Text>
                        <div className="flex gap-2">
                            <button onClick={() => setGithubEditing(true)} className="text-sm text-accent-primary hover:underline font-medium">
                                Change token
                            </button>
                            <span className="text-neutral-300 dark:text-neutral-600">·</span>
                            <button onClick={() => removeConnection('github', 'GitHub')} className="text-sm text-red-500 hover:text-red-600 font-medium">
                                Remove
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <Text size="sm" secondary={true} block={true} className="mb-2">
                            Generate a token at <span className="font-mono">github.com → Settings → Developer settings → Personal access tokens</span>. The <span className="font-mono">repo</span> scope is sufficient for cloning private repositories.
                        </Text>
                        <div className="flex flex-col gap-2">
                            <PATInput
                                value={githubPat}
                                onChange={setGithubPat}
                                show={githubShowPat}
                                onToggleShow={() => setGithubShowPat(v => !v)}
                                placeholder="ghp_••••••••••••••••••••••••••••••••••••••"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => verifyAndSave('github', 'GitHub', 'https://github.com', githubPat, setGithubBusy, setGithubEditing)}
                                    disabled={githubBusy || !githubPat.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                                >
                                    {githubBusy && <FontAwesomeIcon icon={faRotateRight} className="animate-spin text-xs" />}
                                    {githubBusy ? 'Verifying…' : 'Verify & Save'}
                                </button>
                                {githubEditing && (
                                    <button onClick={() => { setGithubEditing(false); setGithubPat('') }} className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 font-medium">
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </CollapsibleProviderCard>}

            {/* GitLab */}
            {tab === 'services' && <CollapsibleProviderCard header={<>
                <GitLabLogo />
                <Text bold={true}>GitLab</Text>
                {gitlabConn?.verified
                    ? <StatusBadge ok={true} label="Verified" />
                    : gitlabConn
                        ? <StatusBadge ok={false} label="Unverified" />
                        : <StatusBadge ok={false} label="Not connected" />
                }
            </>}>
                {gitlabConn && !gitlabEditing ? (
                    <>
                        <Text size="sm" secondary={true} block={true} className="mb-1">
                            {gitlabConn.verifiedUsername ? `Connected as @${gitlabConn.verifiedUsername}` : 'Token configured'}
                        </Text>
                        <Text size="sm" secondary={true} block={true} className="font-mono mb-0.5">
                            {gitlabConn.pat ? maskPat(gitlabConn.pat) : ''}
                        </Text>
                        <Text size="sm" secondary={true} block={true} className="font-mono mb-3">
                            {gitlabConn.baseUrl}
                        </Text>
                        <div className="flex gap-2">
                            <button onClick={() => setGitlabEditing(true)} className="text-sm text-accent-primary hover:underline font-medium">
                                Change token
                            </button>
                            <span className="text-neutral-300 dark:text-neutral-600">·</span>
                            <button onClick={() => removeConnection('gitlab', 'GitLab')} className="text-sm text-red-500 hover:text-red-600 font-medium">
                                Remove
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <Text size="sm" secondary={true} block={true} className="mb-2">
                            Works with gitlab.com and self-hosted instances. Generate a token at <span className="font-mono">Preferences → Personal access tokens</span> with <span className="font-mono">read_repository</span> and <span className="font-mono">read_user</span>scopes.
                        </Text>
                        <div className="flex flex-col gap-2">
                            <div>
                                <label className="block text-xs font-medium text-secondary mb-1">Base URL</label>
                                <input
                                    type="url"
                                    value={gitlabBaseUrl}
                                    onChange={e => setGitlabBaseUrl(e.target.value)}
                                    placeholder="https://gitlab.com"
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-primary placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-primary font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-secondary mb-1">Personal Access Token</label>
                                <PATInput
                                    value={gitlabPat}
                                    onChange={setGitlabPat}
                                    show={gitlabShowPat}
                                    onToggleShow={() => setGitlabShowPat(v => !v)}
                                    placeholder="glpat-••••••••••••••••••"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => verifyAndSave('gitlab', 'GitLab', gitlabBaseUrl, gitlabPat, setGitlabBusy, setGitlabEditing)}
                                    disabled={gitlabBusy || !gitlabPat.trim() || !gitlabBaseUrl.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                                >
                                    {gitlabBusy && <FontAwesomeIcon icon={faRotateRight} className="animate-spin text-xs" />}
                                    {gitlabBusy ? 'Verifying…' : 'Verify & Save'}
                                </button>
                                {gitlabEditing && (
                                    <button onClick={() => { setGitlabEditing(false); setGitlabPat('') }} className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 font-medium">
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </CollapsibleProviderCard>}

            {/* Google */}
            {tab === 'services' && <CollapsibleProviderCard header={<>
                <GoogleLogo />
                <Text bold={true}>Google</Text>
                {!googleLoading && (
                    <StatusBadge ok={googleStatus.connected} label={googleStatus.connected ? 'Connected' : 'Not connected'} />
                )}
            </>}>
                <Text size="sm" secondary={true} block={true}>
                    {googleStatus.connected && googleStatus.email
                        ? `Signed in as ${googleStatus.email}`
                        : 'Connect your Google account to enable Gmail, Calendar, and Tasks integrations.'}
                </Text>
                <div className="flex items-center">
                    {googleLoading ? (
                        <FontAwesomeIcon icon={faRotateRight} className="text-secondary animate-spin" />
                    ) : googleStatus.connected ? (
                        <button onClick={handleGoogleDisconnect} className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors">
                            Disconnect
                        </button>
                    ) : (
                        <button
                            onClick={handleGoogleConnect}
                            disabled={isConnecting}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-400 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <GoogleLogo />
                            {isConnecting ? 'Connecting…' : 'Sign in with Google'}
                        </button>
                    )}
                </div>
            </CollapsibleProviderCard>}

            {/* Anthropic */}
            {tab === 'providers' && <CollapsibleProviderCard header={<>
                <AnthropicLogo />
                <Text bold={true}>Anthropic</Text>
                {anthropicConns.length > 0
                    ? <StatusBadge ok={true} label={`${anthropicConns.length} connection${anthropicConns.length > 1 ? 's' : ''}`} />
                    : <StatusBadge ok={false} label="No connections" />
                }
            </>}>
                <Text size="sm" secondary={true} block={true}>
                    Save an Anthropic API key as a named connection. You can then select it when adding models instead of pasting the key each time.
                </Text>
                <div className="flex gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
                    <Text size="sm" block={true} className="text-amber-700 dark:text-amber-400">
                        <span className="font-semibold">Not the same as Claude Pro or Max.</span> API keys are billed separately per token through the Anthropic Console - they do not draw from your Claude.ai subscription quota. You will be charged additionally for any usage.
                    </Text>
                </div>

                {anthropicConns.length > 0 && (
                    <div className="flex flex-col gap-2 mb-3">
                        {anthropicConns.map(conn => (
                            <div key={conn.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium text-primary">{conn.label}</span>
                                    <span className="text-xs font-mono text-secondary">{maskPat(conn.apiKey)}</span>
                                </div>
                                <button
                                    onClick={() => removeAnthropicConnection(conn.id, conn.label)}
                                    className="text-sm text-red-500 hover:text-red-600 font-medium ml-4 shrink-0"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {anthropicAdding ? (
                    <div className="flex flex-col gap-2">
                        <Input
                            label="NAME"
                            icon={faTag}
                            currentText={anthropicLabel}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnthropicLabel(e.target.value)}
                            placeholder="e.g. My Anthropic Account"
                            clearText={anthropicLabel ? () => setAnthropicLabel('') : undefined}
                        />
                        <Input
                            label="API KEY"
                            icon={faKey}
                            type={anthropicShowKey ? 'text' : 'password'}
                            currentText={anthropicKey}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnthropicKey(e.target.value)}
                            placeholder="sk-ant-..."
                        >
                            <button
                                type="button"
                                onClick={() => setAnthropicShowKey(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                            >
                                <FontAwesomeIcon icon={anthropicShowKey ? faEyeSlash : faEye} className="text-xs" />
                            </button>
                        </Input>
                        <div className="flex gap-2">
                            <Button
                                themed={true}
                                size="sm"
                                onClick={verifyAndSaveAnthropic}
                                disabled={anthropicBusy || !anthropicKey.trim()}
                            >
                                {anthropicBusy && <FontAwesomeIcon icon={faRotateRight} className="animate-spin mr-2 text-xs" />}
                                {anthropicBusy ? 'Verifying…' : 'Verify & Save'}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => { setAnthropicAdding(false); setAnthropicLabel(''); setAnthropicKey('') }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button size="sm" onClick={() => setAnthropicAdding(true)}>+ Add connection</Button>
                )}
            </CollapsibleProviderCard>}

            {/* Google Gemini */}
            {tab === 'providers' && <CollapsibleProviderCard header={<>
                <GoogleAPILogo />
                <Text bold={true}>Google Gemini</Text>
                {googleAPIConns.length > 0
                    ? <StatusBadge ok={true} label={`${googleAPIConns.length} connection${googleAPIConns.length > 1 ? 's' : ''}`} />
                    : <StatusBadge ok={false} label="No connections" />
                }
            </>}>
                <Text size="sm" secondary={true} block={true}>
                    Save a Google Gemini API key as a named connection. You can then select it when adding models instead of pasting the key each time.
                </Text>

                {googleAPIConns.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {googleAPIConns.map(conn => (
                            <div key={conn.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium text-primary">{conn.label}</span>
                                    <span className="text-xs font-mono text-secondary">{maskPat(conn.apiKey)}</span>
                                </div>
                                <button
                                    onClick={() => removeGoogleAPIConnection(conn.id, conn.label)}
                                    className="text-sm text-red-500 hover:text-red-600 font-medium ml-4 shrink-0"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {googleAPIAdding ? (
                    <div className="flex flex-col gap-2">
                        <Input
                            label="NAME"
                            icon={faTag}
                            currentText={googleAPILabel}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoogleAPILabel(e.target.value)}
                            placeholder="e.g. My Google Account"
                            clearText={googleAPILabel ? () => setGoogleAPILabel('') : undefined}
                        />
                        <Input
                            label="API KEY"
                            icon={faKey}
                            type={googleAPIShowKey ? 'text' : 'password'}
                            currentText={googleAPIKey}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoogleAPIKey(e.target.value)}
                            placeholder="AIza..."
                        >
                            <button
                                type="button"
                                onClick={() => setGoogleAPIShowKey(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                            >
                                <FontAwesomeIcon icon={googleAPIShowKey ? faEyeSlash : faEye} className="text-xs" />
                            </button>
                        </Input>
                        <div className="flex gap-2">
                            <Button
                                themed={true}
                                size="sm"
                                onClick={verifyAndSaveGoogleAPI}
                                disabled={googleAPIBusy || !googleAPIKey.trim()}
                            >
                                {googleAPIBusy && <FontAwesomeIcon icon={faRotateRight} className="animate-spin mr-2 text-xs" />}
                                {googleAPIBusy ? 'Verifying…' : 'Verify & Save'}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => { setGoogleAPIAdding(false); setGoogleAPILabel(''); setGoogleAPIKey('') }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button size="sm" onClick={() => setGoogleAPIAdding(true)}>+ Add connection</Button>
                )}
            </CollapsibleProviderCard>}

            {/* Lemonade */}
            {tab === 'providers' && <CollapsibleProviderCard header={<>
                <LemonadeLogo />
                <Text bold={true}>Lemonade</Text>
                {lemonadeConns.length > 0
                    ? <StatusBadge ok={true} label={`${lemonadeConns.length} connection${lemonadeConns.length > 1 ? 's' : ''}`} />
                    : <StatusBadge ok={false} label="No connections" />
                }
            </>}>
                <Text size="sm" secondary={true} block={true}>
                    Save a Lemonade endpoint as a named connection. You can then select it when adding models instead of typing the URL each time.
                </Text>

                {lemonadeConns.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {lemonadeConns.map(conn => (
                            <div key={conn.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium text-primary">{conn.label}</span>
                                    <span className="text-xs font-mono text-secondary">{conn.endpoint}</span>
                                </div>
                                <button
                                    onClick={() => removeLemonadeConnection(conn.id, conn.label)}
                                    className="text-sm text-red-500 hover:text-red-600 font-medium ml-4 shrink-0"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {lemonadeAdding ? (
                    <div className="flex flex-col gap-2">
                        <Input
                            label="NAME"
                            icon={faTag}
                            currentText={lemonadeLabel}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLemonadeLabel(e.target.value)}
                            placeholder="e.g. Local Lemonade"
                            clearText={lemonadeLabel ? () => setLemonadeLabel('') : undefined}
                        />
                        <Input
                            label="ENDPOINT"
                            icon={faLink}
                            currentText={lemonadeEndpoint}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLemonadeEndpoint(e.target.value)}
                            placeholder="http://localhost:8000"
                            clearText={lemonadeEndpoint ? () => setLemonadeEndpoint('') : undefined}
                        />
                        <div className="flex gap-2">
                            <Button
                                themed={true}
                                size="sm"
                                onClick={saveLemonadeConnection}
                                disabled={!lemonadeEndpoint.trim()}
                            >
                                Save
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => { setLemonadeAdding(false); setLemonadeLabel(''); setLemonadeEndpoint('http://localhost:8000') }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button size="sm" onClick={() => setLemonadeAdding(true)}>+ Add connection</Button>
                )}
            </CollapsibleProviderCard>}

            {/* LM Studio */}
            {tab === 'providers' && <CollapsibleProviderCard header={<>
                <LMStudioLogo />
                <Text bold={true}>LM Studio</Text>
                {lmstudioConns.length > 0
                    ? <StatusBadge ok={true} label={`${lmstudioConns.length} connection${lmstudioConns.length > 1 ? 's' : ''}`} />
                    : <StatusBadge ok={false} label="No connections" />
                }
            </>}>
                <Text size="sm" secondary={true} block={true}>
                    Save an LM Studio endpoint as a named connection. You can then select it when adding models instead of typing the URL each time.
                </Text>

                {lmstudioConns.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {lmstudioConns.map(conn => (
                            <div key={conn.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium text-primary">{conn.label}</span>
                                    <span className="text-xs font-mono text-secondary">{conn.endpoint}</span>
                                </div>
                                <button
                                    onClick={() => removeLMStudioConnection(conn.id, conn.label)}
                                    className="text-sm text-red-500 hover:text-red-600 font-medium ml-4 shrink-0"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {lmstudioAdding ? (
                    <div className="flex flex-col gap-2">
                        <Input
                            label="NAME"
                            icon={faTag}
                            currentText={lmstudioLabel}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLmstudioLabel(e.target.value)}
                            placeholder="e.g. Local LM Studio"
                            clearText={lmstudioLabel ? () => setLmstudioLabel('') : undefined}
                        />
                        <Input
                            label="ENDPOINT"
                            icon={faLink}
                            currentText={lmstudioEndpoint}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLmstudioEndpoint(e.target.value)}
                            placeholder="http://localhost:1234"
                            clearText={lmstudioEndpoint ? () => setLmstudioEndpoint('') : undefined}
                        />
                        <div className="flex gap-2">
                            <Button
                                themed={true}
                                size="sm"
                                onClick={saveLMStudioConnection}
                                disabled={!lmstudioEndpoint.trim()}
                            >
                                Save
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => { setLmstudioAdding(false); setLmstudioLabel(''); setLmstudioEndpoint('http://localhost:1234') }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button size="sm" onClick={() => setLmstudioAdding(true)}>+ Add connection</Button>
                )}
            </CollapsibleProviderCard>}

            {/* Ollama */}
            {tab === 'providers' && <CollapsibleProviderCard header={<>
                <OllamaLogo />
                <Text bold={true}>Ollama</Text>
                {ollamaConns.length > 0
                    ? <StatusBadge ok={true} label={`${ollamaConns.length} connection${ollamaConns.length > 1 ? 's' : ''}`} />
                    : <StatusBadge ok={false} label="No connections" />
                }
            </>}>
                <Text size="sm" secondary={true} block={true}>
                    Save an Ollama endpoint as a named connection. You can then select it when adding models instead of typing the URL each time.
                </Text>

                {ollamaConns.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {ollamaConns.map(conn => (
                            <div key={conn.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium text-primary">{conn.label}</span>
                                    <span className="text-xs font-mono text-secondary">{conn.endpoint}</span>
                                </div>
                                <button
                                    onClick={() => removeOllamaConnection(conn.id, conn.label)}
                                    className="text-sm text-red-500 hover:text-red-600 font-medium ml-4 shrink-0"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {ollamaAdding ? (
                    <div className="flex flex-col gap-2">
                        <Input
                            label="NAME"
                            icon={faTag}
                            currentText={ollamaLabel}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOllamaLabel(e.target.value)}
                            placeholder="e.g. Local Ollama"
                            clearText={ollamaLabel ? () => setOllamaLabel('') : undefined}
                        />
                        <Input
                            label="ENDPOINT"
                            icon={faLink}
                            currentText={ollamaEndpoint}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOllamaEndpoint(e.target.value)}
                            placeholder="http://localhost:11434"
                            clearText={ollamaEndpoint ? () => setOllamaEndpoint('') : undefined}
                        />
                        <div className="flex gap-2">
                            <Button
                                themed={true}
                                size="sm"
                                onClick={saveOllamaConnection}
                                disabled={!ollamaEndpoint.trim()}
                            >
                                Save
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => { setOllamaAdding(false); setOllamaLabel(''); setOllamaEndpoint('http://localhost:11434') }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button size="sm" onClick={() => setOllamaAdding(true)}>+ Add connection</Button>
                )}
            </CollapsibleProviderCard>}

            {/* OpenAI */}
            {tab === 'providers' && <CollapsibleProviderCard header={<>
                <OpenAILogo />
                <Text bold={true}>OpenAI</Text>
                {openAIConns.length > 0
                    ? <StatusBadge ok={true} label={`${openAIConns.length} connection${openAIConns.length > 1 ? 's' : ''}`} />
                    : <StatusBadge ok={false} label="No connections" />
                }
            </>}>
                <Text size="sm" secondary={true} block={true}>
                    Save an OpenAI API key as a named connection. You can then select it when adding models instead of pasting the key each time.
                </Text>

                {openAIConns.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {openAIConns.map(conn => (
                            <div key={conn.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium text-primary">{conn.label}</span>
                                    <span className="text-xs font-mono text-secondary">{maskPat(conn.apiKey)}</span>
                                </div>
                                <button
                                    onClick={() => removeOpenAIConnection(conn.id, conn.label)}
                                    className="text-sm text-red-500 hover:text-red-600 font-medium ml-4 shrink-0"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {openAIAdding ? (
                    <div className="flex flex-col gap-2">
                        <Input
                            label="NAME"
                            icon={faTag}
                            currentText={openAILabel}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpenAILabel(e.target.value)}
                            placeholder="e.g. My OpenAI Account"
                            clearText={openAILabel ? () => setOpenAILabel('') : undefined}
                        />
                        <Input
                            label="API KEY"
                            icon={faKey}
                            type={openAIShowKey ? 'text' : 'password'}
                            currentText={openAIKey}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpenAIKey(e.target.value)}
                            placeholder="sk-..."
                        >
                            <button
                                type="button"
                                onClick={() => setOpenAIShowKey(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                            >
                                <FontAwesomeIcon icon={openAIShowKey ? faEyeSlash : faEye} className="text-xs" />
                            </button>
                        </Input>
                        <div className="flex gap-2">
                            <Button
                                themed={true}
                                size="sm"
                                onClick={verifyAndSaveOpenAI}
                                disabled={openAIBusy || !openAIKey.trim()}
                            >
                                {openAIBusy && <FontAwesomeIcon icon={faRotateRight} className="animate-spin mr-2 text-xs" />}
                                {openAIBusy ? 'Verifying…' : 'Verify & Save'}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => { setOpenAIAdding(false); setOpenAILabel(''); setOpenAIKey('') }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button size="sm" onClick={() => setOpenAIAdding(true)}>+ Add connection</Button>
                )}
            </CollapsibleProviderCard>}

            {/* OpenRouter */}
            {tab === 'providers' && <CollapsibleProviderCard header={<>
                <OpenRouterLogo />
                <Text bold={true}>OpenRouter</Text>
                {openRouterConns.length > 0
                    ? <StatusBadge ok={true} label={`${openRouterConns.length} connection${openRouterConns.length > 1 ? 's' : ''}`} />
                    : <StatusBadge ok={false} label="No connections" />
                }
            </>}>
                <Text size="sm" secondary={true} block={true}>
                    Save an OpenRouter API key as a named connection. You can then select it when adding models instead of pasting the key each time.
                </Text>

                {openRouterConns.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {openRouterConns.map(conn => (
                            <div key={conn.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium text-primary">{conn.label}</span>
                                    <span className="text-xs font-mono text-secondary">{maskPat(conn.apiKey)}</span>
                                </div>
                                <button
                                    onClick={() => removeOpenRouterConnection(conn.id, conn.label)}
                                    className="text-sm text-red-500 hover:text-red-600 font-medium ml-4 shrink-0"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {openRouterAdding ? (
                    <div className="flex flex-col gap-2">
                        <Input
                            label="NAME"
                            icon={faTag}
                            currentText={openRouterLabel}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpenRouterLabel(e.target.value)}
                            placeholder="e.g. My OpenRouter Account"
                            clearText={openRouterLabel ? () => setOpenRouterLabel('') : undefined}
                        />
                        <Input
                            label="API KEY"
                            icon={faKey}
                            type={openRouterShowKey ? 'text' : 'password'}
                            currentText={openRouterKey}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpenRouterKey(e.target.value)}
                            placeholder="sk-or-v1-..."
                        >
                            <button
                                type="button"
                                onClick={() => setOpenRouterShowKey(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                            >
                                <FontAwesomeIcon icon={openRouterShowKey ? faEyeSlash : faEye} className="text-xs" />
                            </button>
                        </Input>
                        <div className="flex gap-2">
                            <Button
                                themed={true}
                                size="sm"
                                onClick={verifyAndSaveOpenRouter}
                                disabled={openRouterBusy || !openRouterKey.trim()}
                            >
                                {openRouterBusy && <FontAwesomeIcon icon={faRotateRight} className="animate-spin mr-2 text-xs" />}
                                {openRouterBusy ? 'Verifying…' : 'Verify & Save'}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => { setOpenRouterAdding(false); setOpenRouterLabel(''); setOpenRouterKey('') }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button size="sm" onClick={() => setOpenRouterAdding(true)}>+ Add connection</Button>
                )}
            </CollapsibleProviderCard>}

        </Page>
    )
}
