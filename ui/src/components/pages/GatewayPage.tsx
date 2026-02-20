import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGlobe, faLock, faPlug, faDesktop, faGlobeAmericas } from '@fortawesome/free-solid-svg-icons'
import Page from './Page'
import Card from '../Card'
import Input from '../Input'
import Button from '../Button'
import Text from '../Text'
import Code from '../Code'

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
                            <div className="space-y-1">
                                <div><Text>Specify the address of your gateway.</Text></div>

                                <div className="flex gap-1">
                                    <Text secondary={true} size="sm">For local development use</Text>
                                    <Text secondary={true} size="sm" bold={true}><Code>http://localhost:3808</Code></Text>
                                </div>


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

                                <div className="">
                                    <Text secondary={true} size="sm">
                                        Changes to endpoint or token will only take effect after clicking "Connect to Gateway"
                                    </Text>
                                </div>

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
                            <Text bold={true} className="uppercase">Connected Computers ({connectedClients.length})</Text>
                            {/* <button
                                onClick={(e) => { e.preventDefault(); fetchConnectedClients(); }}
                                className="text-xs font-bold uppercase tracking-widest text-accent-primary hover:text-accent-primary/80 flex items-center gap-1 transition-colors"
                            >
                                <RefreshCw size={10} /> Refresh List
                            </button> */}
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {connectedClients.length === 0 ? (
                                <div className="p-8 bg-bg-primary/50 border border-dashed border-border-color rounded-2xl text-center">
                                    <Text>No other computers currently connected to this gateway.</Text>
                                </div>
                            ) : (
                                connectedClients.map((client, idx) => (
                                    <div key={idx} className="bg-bg-primary border border-border-color rounded-2xl p-4 flex items-center justify-between group hover:border-accent-primary/50 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white-trans flex items-center justify-center group-hover:text-accent-primary group-hover:bg-accent-primary/10 transition-all">
                                                <Text size="lg">
                                                    <FontAwesomeIcon icon={faDesktop} />
                                                </Text>
                                            </div>
                                            <div className="text-left">
                                                <div><Text size="sm" bold={true}>{client.hostname}</Text></div>
                                                <Text size="xs" secondary={true}><FontAwesomeIcon icon={faGlobeAmericas} /> {client.id}</Text>
                                                <Text size="xs" bold={true} secondary={true}><Code>{client.ip}</Code></Text>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div><Text size="xs" bold={true} className="uppercase">Connected Since</Text></div>
                                            <Text size="xs" bold={true} secondary={true}><Code>{new Date(client.connectedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}</Code></Text>
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
