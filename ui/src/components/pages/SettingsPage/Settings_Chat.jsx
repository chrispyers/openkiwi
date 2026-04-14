import Row from '../../Row'
import Column from '../../Column'
import Page from '../Page'
import Card from '../../Card'
import Text from '../../Text'
import TextWithIcon from '../../TextWithIcon'
import Toggle from '../../Toggle'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBrain, faHistory, faFileText, faGaugeHigh } from '@fortawesome/free-solid-svg-icons'
import { toast } from 'sonner'

export default function Settings_Chat({ config, setConfig, saveConfig }) {
    return (
        <Page gridCols={2} padding={0}>
            <Card>
                <Row>
                    <Column grow={true}>
                        <TextWithIcon icon={faBrain} bold={true}>
                            Show Thought Process
                        </TextWithIcon>
                        <Text size="sm" secondary={true}>Display reasoning blocks if available</Text>
                    </Column>
                    <Column align="end">
                        <Toggle
                            checked={config?.chat.showReasoning || false}
                            onChange={() => {
                                if (!config) return;
                                const newConfig = { ...config, chat: { ...config.chat, showReasoning: !config.chat.showReasoning } };
                                setConfig(newConfig);
                                saveConfig(undefined, newConfig).then(() => {
                                    toast.success(`${newConfig.chat.showReasoning ? 'Enabled' : 'Disabled'} thought process display`);
                                });
                            }}
                        />
                    </Column>
                </Row>
            </Card>

            <Card>
                <Row>
                    <Column grow={true}>
                        <TextWithIcon icon={faHistory} bold={true}>
                            Stateful Conversations
                        </TextWithIcon>
                        <Text size="sm" secondary={true}>When ON, the full conversation history is sent with each message, so the agent remembers prior turns. When OFF, only your latest message is sent — each reply is independent with no memory of previous exchanges.</Text>
                    </Column>
                    <Column align="end">
                        <Toggle
                            checked={config?.chat.includeHistory || false}
                            onChange={() => {
                                if (!config) return;
                                const newConfig = { ...config, chat: { ...config.chat, includeHistory: !config.chat.includeHistory } };
                                setConfig(newConfig);
                                saveConfig(undefined, newConfig).then(() => {
                                    toast.success(`${newConfig.chat.includeHistory ? 'Enabled' : 'Disabled'} stateful conversations`);
                                });
                            }}
                        />
                    </Column>
                </Row>
            </Card>

            <Card>
                <Row>
                    <Column grow={true}>
                        <TextWithIcon icon={faFileText} bold={true}>
                            Generate Chat Summaries
                        </TextWithIcon>
                        <Text size="sm" secondary={true}>Summarize long conversations for better context retention</Text>
                    </Column>
                    <Column align="end">
                        <Toggle
                            checked={config?.chat.generateSummaries || false}
                            onChange={() => {
                                if (!config) return;
                                const newConfig = { ...config, chat: { ...config.chat, generateSummaries: !config.chat.generateSummaries } };
                                setConfig(newConfig);
                                saveConfig(undefined, newConfig).then(() => {
                                    toast.success(`${newConfig.chat.generateSummaries ? 'Enabled' : 'Disabled'} chat summaries`);
                                });
                            }}
                        />
                    </Column>
                </Row>
            </Card>

            <Card>
                <Row>
                    <Column grow={true}>
                        <TextWithIcon icon={faGaugeHigh} bold={true}>
                            Show Token Statistics
                        </TextWithIcon>
                        <Text size="sm" secondary={true}>Show stats on each agent response: TPS (tokens per second for the last LLM call), tokens sent (context size including system prompt and history), and tokens received (total output tokens generated across all LLM calls in that turn, including tool use).</Text>
                    </Column>
                    <Column align="end">
                        <Toggle
                            checked={config?.chat.showTokenMetrics || false}
                            onChange={() => {
                                if (!config) return;
                                const newConfig = { ...config, chat: { ...config.chat, showTokenMetrics: !config.chat.showTokenMetrics } };
                                setConfig(newConfig);
                                saveConfig(undefined, newConfig).then(() => {
                                    toast.success(`${newConfig.chat.showTokenMetrics ? 'Enabled' : 'Disabled'} token statistics`);
                                });
                            }}
                        />
                    </Column>
                </Row>
            </Card>
        </Page>
    );
}
