import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import Page from '../Page'
import Card from '../../Card'
import Text from '../../Text'
import Row from '../../Row'
import Column from '../../Column'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faCircleXmark, faRotateRight, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'

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

interface Config {
    connections?: { git: GitConn[] };
    [key: string]: any;
}

interface Props {
    gatewayAddr: string;
    gatewayToken: string;
    config: Config | null;
    setConfig: (c: any) => void;
    saveConfig: (e?: any, override?: any) => Promise<void>;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Settings_Connections({ gatewayAddr, gatewayToken, config, setConfig, saveConfig }: Props) {
    const base = gatewayAddr.replace(/\/$/, '')

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

            {/* Google */}
            <Card>
                <Row>
                    <Column grow={true}>
                        <div className="flex items-center gap-2 mb-1">
                            <GoogleLogo />
                            <Text bold={true}>Google</Text>
                            {!googleLoading && (
                                <StatusBadge ok={googleStatus.connected} label={googleStatus.connected ? 'Connected' : 'Not connected'} />
                            )}
                        </div>
                        <Text size="sm" secondary={true}>
                            {googleStatus.connected && googleStatus.email
                                ? `Signed in as ${googleStatus.email}`
                                : 'Connect your Google account to enable Gmail, Calendar, and Tasks integrations.'}
                        </Text>
                    </Column>
                    <div className="flex-shrink-0 flex items-center">
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
                </Row>
            </Card>

            {/* GitHub */}
            <Card>
                <div className="flex items-center gap-2 mb-3">
                    <GitHubLogo />
                    <Text bold={true}>GitHub</Text>
                    {githubConn?.verified
                        ? <StatusBadge ok={true} label="Verified" />
                        : githubConn
                            ? <StatusBadge ok={false} label="Unverified" />
                            : <StatusBadge ok={false} label="Not connected" />
                    }
                </div>

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
            </Card>

            {/* GitLab */}
            <Card>
                <div className="flex items-center gap-2 mb-3">
                    <GitLabLogo />
                    <Text bold={true}>GitLab</Text>
                    {gitlabConn?.verified
                        ? <StatusBadge ok={true} label="Verified" />
                        : gitlabConn
                            ? <StatusBadge ok={false} label="Unverified" />
                            : <StatusBadge ok={false} label="Not connected" />
                    }
                </div>

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
            </Card>

        </Page>
    )
}
