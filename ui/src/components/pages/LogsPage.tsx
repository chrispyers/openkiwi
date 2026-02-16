import { TABLE, TR, TD } from '../Table'
import Page from './Page'

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

import Button from '../Button'
import { Trash2 } from 'lucide-react'

export default function LogsPage({ logs, onClear }: LogsPageProps) {
    return (
        <Page
            title="System Logs"
            subtitle="Real-time inspection of WebSocket communication and system events."
            headerAction={
                <Button
                    onClick={onClear}
                    className="bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 flex items-center gap-2"
                >
                    <Trash2 size={16} />
                    Clear Logs
                </Button>
            }
        >
            <div className="border border-border-color rounded-2xl bg-bg-card shadow-sm overflow-hidden">
                <TABLE header={['Timestamp', 'Level', 'Type', 'Message', 'Data']}>
                    {logs.length === 0 ? (
                        <TR>
                            <TD colSpan={5} className="text-center py-12 text-neutral-400 italic">No logs recorded yet. Start a conversation to see data.</TD>
                        </TR>
                    ) : (
                        logs.map((log) => (
                            <TR key={log.id || Math.random()}>
                                <TD className="whitespace-nowrap font-mono text-xs text-neutral-500 w-32 align-top">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </TD>
                                <TD className="w-20 align-top">
                                    <LevelBadge level={log.level} />
                                </TD>
                                <TD className="whitespace-nowrap font-mono text-xs text-neutral-600 dark:text-neutral-400 w-24 align-top uppercase">
                                    {log.type}
                                </TD>
                                <TD className="text-sm text-neutral-700 dark:text-neutral-200 w-64 align-top">
                                    {log.message}
                                </TD>
                                <TD className="font-mono text-xs text-neutral-600 dark:text-neutral-300 align-top">
                                    <div className="max-h-32 overflow-y-auto custom-scrollbar">
                                        {typeof log.data === 'object' ? (
                                            <pre className="whitespace-pre-wrap word-break-all">
                                                {JSON.stringify(log.data, null, 2)}
                                            </pre>
                                        ) : (
                                            <span className="break-all">{String(log.data)}</span>
                                        )}
                                    </div>
                                </TD>
                            </TR>
                        ))
                    )}
                </TABLE>
            </div>
        </Page>
    )
}
