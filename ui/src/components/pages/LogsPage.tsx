import { faFileLines } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { TABLE, TR, TD } from '../Table'
import PageHeader from './PageHeader'

interface LogEntry {
    timestamp: string
    data: string
}

interface LogsPageProps {
    logs: LogEntry[]
}

export default function LogsPage({ logs }: LogsPageProps) {
    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden p-6 lg:p-12">
            <PageHeader
                icon={faFileLines}
                title="System Logs"
                subtitle="Real-time inspection of WebSocket communication and system events."
            />

            <div className="flex-1 overflow-auto border border-border-color rounded-2xl bg-bg-card shadow-sm custom-scrollbar">
                <TABLE header={['Timestamp', 'Data']}>
                    {logs.length === 0 ? (
                        <TR>
                            <TD colSpan={2} className="text-center py-12 text-neutral-400 italic">No logs recorded yet. Start a conversation to see data.</TD>
                        </TR>
                    ) : (
                        logs.map((log, i) => (
                            <TR key={i}>
                                <TD className="whitespace-nowrap font-mono text-xs text-neutral-500 w-48 align-top">{log.timestamp}</TD>
                                <TD className="font-mono text-xs break-all text-neutral-600 dark:text-neutral-300 align-top leading-relaxed">{log.data}</TD>
                            </TR>
                        ))
                    )}
                </TABLE>
            </div>
        </div>
    )
}
