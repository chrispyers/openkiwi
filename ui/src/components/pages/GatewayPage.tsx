import { useState, useEffect } from 'react'
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
    gatewayToken: string;
    isGatewayConnected: boolean;
    initializeApp: (isSilent?: boolean, addrOverride?: string, tokenOverride?: string) => Promise<void>;
    connectedClients: any[];
    fetchConnectedClients: () => Promise<void>;
    config: any;
    saveConfig: (e?: React.FormEvent, configOverride?: any) => Promise<void>;
}

export default function GatewayPage({
    gatewayAddr,
    gatewayToken,
    isGatewayConnected,
    initializeApp,
    connectedClients,
    fetchConnectedClients,
    config,
    saveConfig
}: GatewayPageProps) {
    const [localAddr, setLocalAddr] = useState(gatewayAddr);
    const [localToken, setLocalToken] = useState(gatewayToken);
    const [allowedOrigins, setAllowedOrigins] = useState<string>('');

    // Sync with global state when it changes (e.g. on successful connection)
    useEffect(() => {
        setLocalAddr(gatewayAddr);
    }, [gatewayAddr]);

    useEffect(() => {
        setLocalToken(gatewayToken);
    }, [gatewayToken]);

    useEffect(() => {
        if (config?.gateway?.allowedOrigins) {
            setAllowedOrigins(config.gateway.allowedOrigins.join(', '));
        }
    }, [config]);

    const handleSaveOrigins = async () => {
        if (!config) return;
        const originsArray = allowedOrigins.split(',').map(o => o.trim()).filter(o => o.length > 0);
        const updatedConfig = {
            ...config,
            gateway: {
                ...config.gateway,
                allowedOrigins: originsArray
            }
        };
        await saveConfig(undefined, updatedConfig);
    };

    return (
        <Page
            title="Gateway"
            subtitle="Manage your gateway connections and connected clients."
        >
            <div className="max-w-5xl animate-in fade-in slide-in-from-right-4 duration-500">
                <Card className="space-y-6">
                    <div>
                        <div className="w-full">
                            <div className="space-y-5">
                                <div className="flex gap-1">
                                    <Text>Specify the address of your gateway. For local development use</Text>
                                    <Text bold={true}><Code>http://localhost:3808</Code></Text>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Endpoint"
                                        currentText={localAddr}
                                        onChange={e => setLocalAddr(e.target.value)}
                                        placeholder="http://localhost:3808"
                                        icon={faGlobe}
                                        clearText={() => setLocalAddr('')}
                                        className="!mt-0"
                                    />
                                    <Input
                                        label="Token"
                                        currentText={localToken}
                                        onChange={e => setLocalToken(e.target.value)}
                                        placeholder="Secret Token"
                                        icon={faLock}
                                        clearText={() => setLocalToken('')}
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
                                    onClick={() => initializeApp(false, localAddr, localToken)}
                                    disabled={!localAddr || !localToken}
                                    className="w-full h-12 text-white"
                                    icon={faPlug}
                                >
                                    Connect to Gateway
                                </Button>
                            </div>
                        </div>
                    </div>

                    {isGatewayConnected && config && (
                        <div className="pt-8 border-t border-border-color space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div>
                                <Text bold={true} className="uppercase">Security: CORS Whitelist</Text>
                                <div className="mt-2 text-sm">
                                    <Text secondary={true}>Specify which origins are allowed to make requests to this gateway. This prevents malicious websites from accessing your gateway.</Text>
                                </div>
                                <div className="mt-4 flex gap-4">
                                    <div className="flex-1">
                                        <Input
                                            icon={faGlobeAmericas}
                                            label="Allowed Origins (comma separated)"
                                            currentText={allowedOrigins}
                                            onChange={e => setAllowedOrigins(e.target.value)}
                                            placeholder="http://localhost:3000, http://127.0.0.1:3000"
                                        />
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <Button
                                            onClick={handleSaveOrigins}
                                            className="h-10 px-6"
                                        >
                                            Save Origins
                                        </Button>
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-1">
                                    <Text secondary={true} size="sm">Recommended for local use:</Text>
                                    <Text secondary={true} size="xs" bold={true}><Code>http://localhost:3000, http://127.0.0.1:3000</Code></Text>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-border-color">
                                <div className="flex items-center justify-between">
                                    <Text bold={true} className="uppercase">Connected Computers ({connectedClients.length})</Text>
                                </div>

                                <div className="grid grid-cols-1 gap-3 mt-4">
                                    {connectedClients.length === 0 ? (
                                        <div className="p-8 bg-white dark:bg-bg-primary rounded-2xl text-center">
                                            <Text>No other computers currently connected to this gateway.</Text>
                                        </div>
                                    ) : (
                                        connectedClients.map((client, idx) => (
                                            <div key={idx} className="bg-white dark:bg-bg-primary rounded-2xl p-4 flex items-center justify-between group hover:border-accent-primary/50 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:text-accent-primary group-hover:bg-accent-primary/10 transition-all">
                                                        <Text size="lg">
                                                            <FontAwesomeIcon icon={faDesktop} />
                                                        </Text>
                                                    </div>
                                                    <div className="text-left">
                                                        <div><Text size="sm" bold={true}>{client.hostname}</Text></div>
                                                        <Text size="xs" secondary={true}><FontAwesomeIcon icon={faGlobeAmericas} /> {client.id || ''}</Text>
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
                        </div>
                    )}
                </Card>
            </div>
        </Page>
    )
}
