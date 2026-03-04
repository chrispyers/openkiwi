import { toast } from 'sonner'
import { faBrain, faFileCode, faMicrochip, faSave, faDatabase } from '@fortawesome/free-solid-svg-icons'
import Text from '../../Text'
import Card from '../../Card'
import SectionHeader from '../../SectionHeader'
import Toggle from '../../Toggle'
import Select from '../../Select'
import Button from '../../Button'
import TextArea from '../../TextArea'
import Page from '../Page'
import Row from '../../Row'
import Column from '../../Column'
import HR from '../../HR'
import TextWithIcon from '../../TextWithIcon'

export default function Settings_Agents({ config, setConfig, saveConfig }) {
    return (
        <Page padding={0}>
            <SectionHeader title="Memory" icon={faBrain} />
            <Card>
                <Row>
                    <Column grow={true}>
                        <TextWithIcon icon={faDatabase} bold={true}>
                            Enable Vector Embeddings
                        </TextWithIcon>
                        <Text size="sm" secondary={true}>
                            Enhance memory recall using semantic vector search. When disabled, keyword search is used.
                        </Text>
                    </Column>
                    <Column align="end">
                        <Toggle
                            checked={config?.memory?.useEmbeddings || false}
                            onChange={() => {
                                if (!config) return;
                                const newConfig = {
                                    ...config,
                                    memory: {
                                        ...(config.memory || { embeddingsModel: "" }),
                                        useEmbeddings: !config.memory?.useEmbeddings
                                    }
                                };
                                setConfig(newConfig);
                                saveConfig(undefined, newConfig).then(() => {
                                    toast.success(`${newConfig.memory?.useEmbeddings ? 'Enabled' : 'Disabled'} vector embeddings`);
                                });
                            }}
                        />
                    </Column>
                </Row>

                {config?.memory?.useEmbeddings &&
                    <>
                        <HR />
                        <Select
                            label="Embedding Provider"
                            icon={faMicrochip}
                            width="w-full"
                            options={(config?.providers || []).map(p => ({
                                value: p.description || p.model,
                                label: p.description || p.model
                            }))}
                            value={config?.memory?.embeddingsModel || ""}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (!config) return;
                                const newConfig = {
                                    ...config,
                                    memory: {
                                        ...(config.memory || { useEmbeddings: true }),
                                        embeddingsModel: val
                                    }
                                };
                                setConfig(newConfig);
                                saveConfig(undefined, newConfig).then(() => {
                                    toast.success(`Embedding provider set to ${val}`);
                                });
                            }}
                        />
                        <Text size="sm" secondary={true}>
                            Select the provider to use for generating embeddings. Must support OpenAI-compatible <code>/embeddings</code> endpoint.
                        </Text>
                    </>
                }

            </Card>

            <SectionHeader title="Instructions" icon={faFileCode} />
            <Card>
                <TextArea
                    label="Global System Prompt"
                    currentText={config?.global?.systemPrompt || ''}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, global: { ...(prev.global || {}), systemPrompt: e.target.value } } : null)}
                    placeholder=""
                    rows={12}
                />
                <Button themed={true} className="w-full" onClick={() => saveConfig()} icon={faSave}>Save System Prompt</Button>
            </Card>
        </Page>
    );
}
