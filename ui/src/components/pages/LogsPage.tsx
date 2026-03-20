import { useState } from 'react'
import { createPortal } from 'react-dom'
import { TR, TD } from '../Table'
import Page from './Page'
import Text from '../Text'
import Column from '../Column'

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

interface LogsPageProps {
    logs: LogEntry[]
    onClear: () => void
}

const LevelBadge = ({ level }: { level: LogEntry['level'] }) => {
    const colors = {
        info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        warn: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
        error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        debug: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${colors[level]}`}>
            {level}
        </span>
    )
}

const LogDetailModal = ({ log, onClose }: { log: LogEntry; onClose: () => void }) => {
    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-3">
                        <LevelBadge level={log.level} />
                        <Text size="xs" className="font-mono uppercase text-neutral-500">{log.type}</Text>
                        <Text size="xs" className="font-mono text-neutral-400">
                            {new Date(log.timestamp).toLocaleString()}
                        </Text>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-lg leading-none"
                    >
                        ✕
                    </button>
                </div>
                <div className="px-6 py-4 overflow-y-auto space-y-4">
                    <div>
                        <Text size="xs" bold className="uppercase tracking-wider text-neutral-500 mb-1">Message</Text>
                        <Column><Text size="sm">{log.message}</Text></Column>
                    </div>
                    {log.agentId && (
                        <div>
                            <Text size="xs" bold className="uppercase tracking-wider text-neutral-500 mb-1">Agent ID</Text>
                            <Column><Text size="xs" className="font-mono">{log.agentId}</Text></Column>
                        </div>
                    )}
                    {log.sessionId && (
                        <div>
                            <Text size="xs" bold className="uppercase tracking-wider text-neutral-500 mb-1">Session ID</Text>
                            <Column><Text size="xs" className="font-mono">{log.sessionId}</Text></Column>
                        </div>
                    )}
                    {log.data !== undefined && log.data !== null && (
                        <div>
                            <Text size="xs" bold className="uppercase tracking-wider text-neutral-500 mb-1">Data</Text>
                            <pre className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 overflow-auto whitespace-pre-wrap break-all">
                                {typeof log.data === 'object'
                                    ? JSON.stringify(log.data, null, 2)
                                    : String(log.data)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}

import Button from '../Button'
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import Card from '../Card';
import { TH } from '../Table';

export default function LogsPage({ logs, onClear }: LogsPageProps) {
    const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)

    return (
        <Page
            scroll={false}
            title="System Logs"
            subtitle="Real-time inspection of WebSocket communication and system events."
            headerAction={
                <Button
                    variant="danger"
                    icon={faTrash}
                    onClick={onClear}>Clear Logs</Button>
            }>
            <Card padding="p-0" gap={0} className="flex-1 min-h-0 [overflow:clip]">
                {/* Header table — outside the scroll container so the scrollbar starts below it */}
                <table className="table-fixed w-full shrink-0" style={{ borderBottom: '1px solid var(--table-border-color)', backgroundColor: 'var(--table-header-bg)' }}>
                    <colgroup>
                        <col className="w-28" />
                        <col className="w-16" />
                        <col className="w-20" />
                        <col />
                        <col />
                    </colgroup>
                    <thead>
                        <tr>
                            <TH>Timestamp</TH>
                            <TH>Level</TH>
                            <TH>Type</TH>
                            <TH>Message</TH>
                            <TH>Data</TH>
                        </tr>
                    </thead>
                </table>
                {/* Body — only this part scrolls */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                    <table className="table-fixed w-full" style={{ backgroundColor: 'var(--table-body-bg)' }}>
                        <colgroup>
                            <col className="w-28" />
                            <col className="w-16" />
                            <col className="w-20" />
                            <col />
                            <col />
                        </colgroup>
                        <tbody>
                            {logs.length === 0 ? (
                                <TR>
                                    <TD colSpan={5} className="text-center py-12">
                                        <Text>No logs recorded yet. Start a conversation to see data.</Text>
                                    </TD>
                                </TR>
                            ) : (
                                logs.map((log) => (
                                    <TR key={log.id || Math.random()} onClick={() => setSelectedLog(log)}>
                                        <TD className="whitespace-nowrap align-top">
                                            <Text size="xs" className="font-mono">
                                                {new Date(log.timestamp).toLocaleTimeString()}
                                            </Text>
                                        </TD>
                                        <TD className="align-top">
                                            <LevelBadge level={log.level} />
                                        </TD>
                                        <TD className="whitespace-nowrap align-top uppercase">
                                            <Text size="xs" className="font-mono">{log.type}</Text>
                                        </TD>
                                        <TD className="align-top">
                                            <Text size="xs">{log.message}</Text>
                                        </TD>
                                        <TD className="align-top max-w-0">
                                            {log.data !== undefined && log.data !== null && (
                                                <Text size="xs">
                                                    <span className="block truncate font-mono text-neutral-500 dark:text-neutral-400">
                                                        {typeof log.data === 'object'
                                                            ? JSON.stringify(log.data)
                                                            : String(log.data)}
                                                    </span>
                                                </Text>
                                            )}
                                        </TD>
                                    </TR>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
            {selectedLog && (
                <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
            )}
        </Page>
    )
}
