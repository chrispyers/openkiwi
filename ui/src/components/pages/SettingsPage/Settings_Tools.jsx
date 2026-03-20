import { useState } from 'react'
import { faWrench } from '@fortawesome/free-solid-svg-icons'
import Page from '../Page'
import SectionHeader from '../../SectionHeader'
import Text from '../../Text'
import SkillsAndToolsCard from '../../SkillsAndToolsCard'
import Column from '../../Column'
import Button from '../../Button'

export default function Settings_Tools({
    tools,
    config,
    setConfig,
    saveConfig,
    gatewayAddr,
    gatewayToken,
    loadingReadme,
    setLoadingReadme,
    setViewingReadme
}) {
    const [activeTab, setActiveTab] = useState('optional');

    const CORE_TOOL_NAMES = new Set([
        'agent', 'ask_user', 'bash', 'edit', 'file_manager', 'finish_task', 'glob', 'grep', 'ls',
        'multi_edit', 'read', 'todo_read', 'todo_write',
        'web_fetch', 'web_search', 'write',
    ]);

    const MEMORY_TOOL_NAMES = new Set([
        'memory_search', 'memory_get', 'save_to_memory',
    ]);

    // Internal-only tools: used as libraries by other tools, not exposed directly to agents
    const isInternalTool = t => t.name === 'chromium' || (t.filename && t.filename.includes('chromium'));

    const coreTools = tools.filter(t => !isInternalTool(t) && !MEMORY_TOOL_NAMES.has(t.name) && (!t.filename || CORE_TOOL_NAMES.has(t.name)));
    const memoryTools = tools.filter(t => MEMORY_TOOL_NAMES.has(t.name));
    const optionalTools = tools.filter(t => !isInternalTool(t) && !!t.filename && !CORE_TOOL_NAMES.has(t.name) && !MEMORY_TOOL_NAMES.has(t.name));
    const visibleTools = activeTab === 'core' ? coreTools : activeTab === 'memory' ? memoryTools : optionalTools;

    return (
        <Page padding={0}>
            <Column>
                <SectionHeader
                    icon={faWrench}
                    title="Tools"
                />
                <Text secondary={true} size="sm" block={true}>
                    These are the capabilities currently discovered by the Gateway. Agents can autonomously choose to use these tools to interact with your environment.
                </Text>
                <div className="flex gap-2 mt-2">
                    <Button
                        themed={activeTab === 'core'}
                        onClick={() => setActiveTab('core')}
                    >
                        Core ({coreTools.length})
                    </Button>
                    <Button
                        themed={activeTab === 'memory'}
                        onClick={() => setActiveTab('memory')}
                    >
                        Memory ({memoryTools.length})
                    </Button>
                    <Button
                        themed={activeTab === 'optional'}
                        onClick={() => setActiveTab('optional')}
                    >
                        Plugins ({optionalTools.length})
                    </Button>
                </div>
            </Column>

            <div className="grid grid-cols-2 gap-4 px-0 pb-6">
                {visibleTools.map(tool => (
                    <SkillsAndToolsCard
                        key={tool.name}
                        tool={tool}
                        config={config}
                        setConfig={setConfig}
                        saveConfig={saveConfig}
                        gatewayAddr={gatewayAddr}
                        gatewayToken={gatewayToken}
                        loadingReadme={loadingReadme}
                        setLoadingReadme={setLoadingReadme}
                        setViewingReadme={setViewingReadme}
                        isCore={activeTab === 'core' || activeTab === 'memory'}
                    />
                ))}
            </div>
        </Page>
    );
}
