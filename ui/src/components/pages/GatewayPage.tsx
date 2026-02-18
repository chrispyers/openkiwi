import { Cpu, Globe, Lock, Monitor, RefreshCw } from 'lucide-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGlobe, faLock, faPlug, faDesktop } from '@fortawesome/free-solid-svg-icons'
import Page from './Page'
import Card from '../Card'
import IconBox from '../IconBox'
import Input from '../Input'
import Button from '../Button'

interface GatewayPageProps {
    gatewayAddr: string;
    setGatewayAddr: (addr: string) => void;
    gatewayToken: string;
    setGatewayToken: (token: string) => void;
    initializeApp: (isSilent?: boolean) => Promise<void>;
    connectedClients: any[];
    fetchConnectedClients: () => Promise<void>;
}

export default function GatewayPage({
    gatewayAddr,
    setGatewayAddr,
    gatewayToken,
    setGatewayToken,
    initializeApp,
    connectedClients,
    fetchConnectedClients
}: GatewayPageProps) {
    return (
        <Page
            title="Gateway"
            subtitle="Manage your gateway connections and connected clients."
        >
            <div className="max-w-5xl animate-in fade-in slide-in-from-right-4 duration-500">
                <Card className="space-y-6">
                    <div className="">
                        <div className="w-full">
                            <div className="space-y-6">
                                <p className="text-md leading-relaxed">
                                    Specify the address of your gateway. For local development, use <code className="text-accent-primary">http://localhost:3808</code>.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Endpoint"
                                        currentText={gatewayAddr}
                                        onChange={e => setGatewayAddr(e.target.value)}
                                        placeholder="http://localhost:3808"
                                        icon={faGlobe}
                                        clearText={() => setGatewayAddr('')}
                                        className="!mt-0"
                                    />
                                    <Input
                                        label="Token"
                                        currentText={gatewayToken}
                                        onChange={e => setGatewayToken(e.target.value)}
                                        placeholder="Secret Token"
                                        icon={faLock}
                                        clearText={() => setGatewayToken('')}
                                        className="!mt-0"
                                    />
                                </div>


                                <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">
                                    Changes to endpoint or token will only take effect after clicking "Connect to Gateway"
                                </p>

                                <Button
                                    themed={true}
                                    onClick={() => initializeApp()}
                                    disabled={!gatewayAddr || !gatewayToken}
                                    className="w-full h-12 text-white"
                                    icon={faPlug}
                                >
                                    Connect to Gateway
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-border-color space-y-6">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                <FontAwesomeIcon icon={faDesktop} /> Connected Computers ({connectedClients.length})
                            </label>
                            <button
                                onClick={(e) => { e.preventDefault(); fetchConnectedClients(); }}
                                className="text-xs font-bold uppercase tracking-widest text-accent-primary hover:text-accent-primary/80 flex items-center gap-1 transition-colors"
                            >
                                <RefreshCw size={10} /> Refresh List
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {connectedClients.length === 0 ? (
                                <div className="p-8 bg-bg-primary/50 border border-dashed border-border-color rounded-2xl text-center">
                                    <p className="text-xs italic">No other computers currently connected to this gateway.</p>
                                </div>
                            ) : (
                                connectedClients.map((client, idx) => (
                                    <div key={idx} className="bg-bg-primary border border-border-color rounded-2xl p-4 flex items-center justify-between group hover:border-accent-primary/50 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white-trans flex items-center justify-center group-hover:text-accent-primary group-hover:bg-accent-primary/10 transition-all">
                                                <Monitor size={20} />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-bold text-sm">{client.hostname}</div>
                                                <div className="text-xs font-mono flex items-center gap-2">
                                                    <Globe size={10} /> {client.ip}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold uppercase tracking-tighter text-neutral-600 dark:text-white/40 mb-1">Connected Since</div>
                                            <div className="text-xs font-medium">
                                                {new Date(client.connectedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </Page>
    )
}
