import { useState, useEffect, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlug, faPlus, faTrash, faTerminal, faRotate, faCircle, faPen, faSave, faXmark } from '@fortawesome/free-solid-svg-icons'
import { toast } from 'sonner'
import Page from './Page'
import Card from '../Card'
import Input from '../Input'
import Button from '../Button'
import Text from '../Text'
import Row from '../Row'
import Column from '../Column'
import SectionHeader from '../SectionHeader'
import { TABLE, TR, TD } from '../Table'

interface MCPServerStatus {
    name: string;
    command: string;
    args: string[];
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    error?: string;
    tools: string[];
}

interface MCPServersPageProps {
    config: any;
    saveConfig: (e?: React.FormEvent, configOverride?: any) => Promise<void>;
    gatewayAddr: string;
    gatewayToken: string;
}

export default function MCPServersPage({ config, saveConfig, gatewayAddr, gatewayToken }: MCPServersPageProps) {
    const [newName, setNewName] = useState('')
    const [newCommand, setNewCommand] = useState('')
    const [newArgs, setNewArgs] = useState('')
    const [editingName, setEditingName] = useState<string | null>(null) // tracks which server is being edited
    const [serverStatuses, setServerStatuses] = useState<MCPServerStatus[]>([])
    const [isReconnecting, setIsReconnecting] = useState(false)

    const mcpServers: Record<string, { command: string; args: string[] }> = config?.mcpServers || {}
    const serverEntries = Object.entries(mcpServers)

    const getApiUrl = (path: string) => `${gatewayAddr.replace(/\/$/, '')}${path}`

    const fetchStatus = useCallback(async () => {
        try {
            const response = await fetch(getApiUrl('/api/mcp/status'), {
                headers: { 'Authorization': `Bearer ${gatewayToken}` },
            })
            if (response.ok) {
                setServerStatuses(await response.json())
            }
        } catch {
            // Silently fail — gateway may not be connected
        }
    }, [gatewayAddr, gatewayToken])

    useEffect(() => {
        fetchStatus()
    }, [fetchStatus])

    const handleReconnect = async () => {
        setIsReconnecting(true)
        try {
            const response = await fetch(getApiUrl('/api/mcp/reconnect'), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${gatewayToken}` },
            })
            if (response.ok) {
                const data = await response.json()
                setServerStatuses(data.servers || [])
                toast.success('MCP servers reconnected')
            } else {
                toast.error('Failed to reconnect MCP servers')
            }
        } catch {
            toast.error('Failed to reach gateway')
        } finally {
            setIsReconnecting(false)
        }
    }

    const handleSave = async () => {
        if (!newName.trim() || !newCommand.trim()) {
            toast.error('Name and Command are required')
            return
        }

        const name = newName.trim()

        // If adding (not editing) and name already exists, block it
        if (!editingName && mcpServers[name]) {
            toast.error('An MCP server with that name already exists')
            return
        }

        // If editing and the name changed, check the new name isn't taken
        if (editingName && editingName !== name && mcpServers[name]) {
            toast.error('An MCP server with that name already exists')
            return
        }

        const args = newArgs.trim()
            ? newArgs.trim().split(/\s+/)
            : []

        // Build new mcpServers: remove old key if renaming, then set new entry
        const updated = { ...mcpServers }
        if (editingName && editingName !== name) {
            delete updated[editingName]
        }
        updated[name] = { command: newCommand.trim(), args }

        const updatedConfig = { ...config, mcpServers: updated }

        await saveConfig(undefined, updatedConfig)
        clearForm()
        toast.success(editingName ? 'MCP server updated' : 'MCP server added', {
            description: `${name} — click "Reconnect All" to activate`
        })
    }

    const handleEdit = (name: string, server: { command: string; args: string[] }) => {
        setEditingName(name)
        setNewName(name)
        setNewCommand(server.command)
        setNewArgs(server.args.join(' '))
    }

    const clearForm = () => {
        setEditingName(null)
        setNewName('')
        setNewCommand('')
        setNewArgs('')
    }

    const handleDelete = async (name: string) => {
        const { [name]: _, ...rest } = mcpServers
        const updatedConfig = {
            ...config,
            mcpServers: rest
        }
        await saveConfig(undefined, updatedConfig)
        toast.success('MCP server removed', { description: name })
    }

    const getStatusForServer = (name: string): MCPServerStatus | undefined => {
        return serverStatuses.find(s => s.name === name)
    }

    const statusColor = (status?: string) => {
        switch (status) {
            case 'connected': return 'text-emerald-500'
            case 'connecting': return 'text-yellow-500 animate-pulse'
            case 'error': return 'text-red-500'
            default: return 'text-neutral-400'
        }
    }

    const statusLabel = (status?: string) => {
        switch (status) {
            case 'connected': return 'Connected'
            case 'connecting': return 'Connecting...'
            case 'error': return 'Error'
            default: return 'Not started'
        }
    }

    return (
        <Page
            title="MCP Servers"
            subtitle="Manage Model Context Protocol server connections. MCP servers run locally and expose tools to your agents."
        >
            <Card gap={3}>
                <Row align="center" justify="between">
                    <SectionHeader icon={editingName ? faPen : faPlus} title={editingName ? `Editing: ${editingName}` : 'Add MCP Server'} />
                    {editingName && (
                        <Button onClick={clearForm} icon={faXmark} size="sm">
                            Cancel
                        </Button>
                    )}
                </Row>
                <Text secondary={true} size="sm">
                    {editingName
                        ? 'Edit the fields below and click "Save Changes" to update this server.'
                        : 'Register an MCP server by providing a name, the command to launch it, and any arguments (space-separated).'}
                </Text>
                <Row align="end" gap="gap-4">
                    <Column grow={true}>
                        <Input
                            label="Name"
                            currentText={newName}
                            onChange={(e: any) => setNewName(e.target.value)}
                            placeholder="e.g. github"
                            icon={faPlug}
                        />
                    </Column>
                    <Column grow={true}>
                        <Input
                            label="Command"
                            currentText={newCommand}
                            onChange={(e: any) => setNewCommand(e.target.value)}
                            placeholder="e.g. npx, docker, node"
                            icon={faTerminal}
                        />
                    </Column>
                </Row>
                <Input
                    label="Arguments"
                    currentText={newArgs}
                    onChange={(e: any) => setNewArgs(e.target.value)}
                    placeholder="e.g. run --rm -i mcp-test"
                />
                <Button className="w-full" themed={true} onClick={handleSave} disabled={!newName.trim() || !newCommand.trim()} icon={editingName ? faSave : faPlus}>
                    {editingName ? 'Save Changes' : 'Add MCP Server'}
                </Button>
            </Card>

            <Card gap={3}>
                <Row align="center" justify="between">
                    <SectionHeader icon={faPlug} title="Registered Servers" />
                    {serverEntries.length > 0 && (
                        <Button
                            onClick={handleReconnect}
                            disabled={isReconnecting}
                            icon={faRotate}
                            size="sm"
                        >
                            {isReconnecting ? 'Reconnecting...' : 'Reconnect All'}
                        </Button>
                    )}
                </Row>
                {serverEntries.length === 0 ? (
                    <Text secondary={true}>No MCP servers registered yet. Add one above to get started.</Text>
                ) : (
                    <TABLE header={[
                        { name: "Name", alignment: "left" },
                        { name: "Command", alignment: "left" },
                        { name: "Arguments", alignment: "left" },
                        { name: "Status", alignment: "center" },
                        { name: "Tools", alignment: "center" },
                        { name: "", alignment: "center", className: "w-16" }
                    ]}>
                        {serverEntries.map(([name, server]) => {
                            const status = getStatusForServer(name)
                            return (
                                <TR key={name} highlight={true} onClick={() => handleEdit(name, server)}>
                                    <TD>
                                        <Text className="font-mono font-semibold" size="sm">{name}</Text>
                                    </TD>
                                    <TD>
                                        <Text className="font-mono" size="sm">{server.command}</Text>
                                    </TD>
                                    <TD>
                                        <Text className="font-mono" size="sm">
                                            {server.args.length > 0 ? server.args.join(' ') : <span className="text-secondary italic">none</span>}
                                        </Text>
                                    </TD>
                                    <TD className="text-center">
                                        <span className="inline-flex items-center gap-2">
                                            <FontAwesomeIcon icon={faCircle} className={`text-[8px] ${statusColor(status?.status)}`} />
                                            <Text size="sm">{statusLabel(status?.status)}</Text>
                                        </span>
                                        {status?.error && (
                                            <Text size="xs" className="text-red-400 block mt-1">{status.error}</Text>
                                        )}
                                    </TD>
                                    <TD className="text-center">
                                        <Text size="sm" secondary={!status?.tools?.length}>
                                            {status?.tools?.length ? status.tools.join(', ') : '—'}
                                        </Text>
                                    </TD>
                                    <TD className="text-center">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(name); }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400 p-1"
                                            title={`Remove ${name}`}
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </TD>
                                </TR>
                            )
                        })}
                    </TABLE>
                )}
            </Card>
        </Page>
    )
}
