import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDesktop, faFlask } from '@fortawesome/free-solid-svg-icons'
import { toast } from 'sonner'
import { useTheme } from '../../../contexts/ThemeContext'
import Page from '../Page'
import Card from '../../Card'
import SectionHeader from '../../SectionHeader'
import Text from '../../Text'
import Toggle from '../../Toggle'
import Row from '../../Row'
import Column from '../../Column'

const ACCENT_THEMES = [
    { id: 'default', label: 'Default' },
    { id: 'blue',    label: 'Blue'    },
    { id: 'purple',  label: 'Purple'  },
    { id: 'green',   label: 'Green'   },
    { id: 'red',     label: 'Red'     },
    { id: 'orange',  label: 'Orange'  },
];

function ThemeSwatch({ theme, isSelected, onClick }) {
    return (
        <button
            onClick={onClick}
            title={theme.label}
            className="flex flex-col items-center gap-2 group"
        >
            <div
                className={`
                    w-10 h-10 rounded-full transition-all duration-150
                    ${isSelected
                        ? 'ring-2 ring-offset-2 ring-accent-primary ring-offset-[var(--bg-card)] scale-110'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }
                `}
                style={{
                    background: `linear-gradient(to right, var(--${theme.id}-swatch-light) 50%, var(--${theme.id}-swatch-dark) 50%)`,
                }}
            />
            <Text size="xs" secondary={!isSelected} className={isSelected ? 'text-accent-primary font-medium' : ''}>
                {theme.label}
            </Text>
        </button>
    );
}

export default function Settings_General({
    isProjectManagementEnabled,
    setIsProjectManagementEnabled,
    isAgentActivityEnabled,
    setIsAgentActivityEnabled,
    isProjectsEnabled,
    setIsProjectsEnabled,
    theme,
    setTheme
}) {
    const { accentTheme, setAccentTheme } = useTheme();

    return (
        <Page gridCols={2} padding={0}>
            <SectionHeader
                columns={2}
                icon={faDesktop}
                title="Appearance"
            />
            <Card>
                <Column gap="gap-4">
                    <Column>
                        <Text bold={true}>Color Theme</Text>
                        <Text size="sm" secondary={true}>Left half is the light mode accent, right half is dark mode.</Text>
                    </Column>
                    <div className="flex gap-5 flex-wrap">
                        {ACCENT_THEMES.map(t => (
                            <ThemeSwatch
                                key={t.id}
                                theme={t}
                                isSelected={accentTheme === t.id}
                                onClick={() => {
                                    setAccentTheme(t.id);
                                    toast.success(`Switched to ${t.label} theme`);
                                }}
                            />
                        ))}
                    </div>
                </Column>
            </Card>

            <SectionHeader
                columns={2}
                icon={faFlask}
                title="Experimental"
            />
            <Card>
                <Row>
                    <Column grow={true}>
                        <Text bold={true}>Project Management</Text>
                        <Text size="sm" secondary={true}>Enable the experimental project builder</Text>
                    </Column>
                    <Toggle
                        checked={isProjectsEnabled}
                        onChange={() => {
                            const newValue = !isProjectsEnabled;
                            setIsProjectsEnabled(newValue);
                            localStorage.setItem('experimental_project_management', newValue.toString());
                            toast.success(`${newValue ? 'Enabled' : 'Disabled'} Project Management`);
                        }}
                    />
                </Row>
            </Card>

            <Card>
                <Row>
                    <Column grow={true}>
                        <Text bold={true}>Workflow Builder</Text>
                        <Text size="sm" secondary={true}>Enable the experimental workflow builder</Text>
                    </Column>
                    <Toggle
                        checked={isProjectManagementEnabled}
                        onChange={() => {
                            const newValue = !isProjectManagementEnabled;
                            setIsProjectManagementEnabled(newValue);
                            localStorage.setItem('experimental_projects', newValue.toString());
                            toast.success(`${newValue ? 'Enabled' : 'Disabled'} Project Management`);
                        }}
                    />
                </Row>
            </Card>

            <Card>
                <Row>
                    <Column grow={true}>
                        <Text bold={true}>Agent Activity</Text>
                        <Text size="sm" secondary={true}>Enable the "Activity" button in the side bar.</Text>
                    </Column>
                    <Toggle
                        checked={isAgentActivityEnabled}
                        onChange={() => {
                            const newValue = !isAgentActivityEnabled;
                            setIsAgentActivityEnabled(newValue);
                            localStorage.setItem('experimental_activity', newValue.toString());
                            toast.success(`${newValue ? 'Enabled' : 'Disabled'} Agent Activity`);
                        }}
                    />
                </Row>
            </Card>
        </Page>
    );
}
