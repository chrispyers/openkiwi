import { describe, it, expect, vi } from 'vitest';


describe('Agent Grouping - UI Logic', () => {
    describe('grouping utility', () => {
        // Test the grouping logic used in AgentsPage and ChatPage
        function groupAgents(agents: { id: string; group?: string }[]) {
            const groups: Record<string, typeof agents> = {};
            const ungrouped: typeof agents = [];
            for (const agent of agents) {
                if (agent.group) {
                    if (!groups[agent.group]) groups[agent.group] = [];
                    groups[agent.group].push(agent);
                } else {
                    ungrouped.push(agent);
                }
            }
            return { groups, ungrouped };
        }

        it('should group agents by their group field', () => {
            const agents = [
                { id: 'a', group: 'Research' },
                { id: 'b', group: 'Research' },
                { id: 'c', group: 'Campaign' },
                { id: 'd' },
            ];
            const result = groupAgents(agents);

            expect(Object.keys(result.groups)).toHaveLength(2);
            expect(result.groups['Research']).toHaveLength(2);
            expect(result.groups['Campaign']).toHaveLength(1);
            expect(result.ungrouped).toHaveLength(1);
            expect(result.ungrouped[0].id).toBe('d');
        });

        it('should put all agents in ungrouped when none have groups', () => {
            const agents = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
            const result = groupAgents(agents);

            expect(Object.keys(result.groups)).toHaveLength(0);
            expect(result.ungrouped).toHaveLength(3);
        });

        it('should put all agents in groups when all have groups', () => {
            const agents = [
                { id: 'a', group: 'X' },
                { id: 'b', group: 'Y' },
            ];
            const result = groupAgents(agents);

            expect(result.ungrouped).toHaveLength(0);
            expect(Object.keys(result.groups)).toHaveLength(2);
        });

        it('should handle empty agent list', () => {
            const result = groupAgents([]);
            expect(Object.keys(result.groups)).toHaveLength(0);
            expect(result.ungrouped).toHaveLength(0);
        });

        it('should treat empty string group as ungrouped', () => {
            const agents = [{ id: 'a', group: '' }, { id: 'b', group: 'Real' }];
            const result = groupAgents(agents);

            expect(result.ungrouped).toHaveLength(1);
            expect(result.groups['Real']).toHaveLength(1);
        });
    });

    describe('existing groups extraction', () => {
        function extractExistingGroups(agents: { group?: string }[]) {
            const groups = new Set<string>();
            for (const agent of agents) {
                if (agent.group) groups.add(agent.group);
            }
            return Array.from(groups).sort();
        }

        it('should extract unique group names sorted alphabetically', () => {
            const agents = [
                { group: 'Research' },
                { group: 'Campaign' },
                { group: 'Research' },
                {},
                { group: 'Admin' },
            ];
            expect(extractExistingGroups(agents)).toEqual(['Admin', 'Campaign', 'Research']);
        });

        it('should return empty array when no agents have groups', () => {
            expect(extractExistingGroups([{}, {}, {}])).toEqual([]);
        });

        it('should not include empty string groups', () => {
            expect(extractExistingGroups([{ group: '' }, { group: 'Real' }])).toEqual(['Real']);
        });
    });

    describe('group autocomplete filtering', () => {
        function filterGroups(existingGroups: string[], current: string) {
            const lower = current.toLowerCase();
            if (!lower) return existingGroups;
            return existingGroups.filter(g => g.toLowerCase().includes(lower) && g !== current);
        }

        it('should return all groups when input is empty', () => {
            const groups = ['Admin', 'Campaign', 'Research'];
            expect(filterGroups(groups, '')).toEqual(groups);
        });

        it('should filter groups by partial match (case-insensitive)', () => {
            const groups = ['Admin', 'Campaign', 'Research'];
            expect(filterGroups(groups, 'cam')).toEqual(['Campaign']);
        });

        it('should exclude exact match from suggestions', () => {
            const groups = ['Admin', 'Campaign', 'Research'];
            expect(filterGroups(groups, 'Campaign')).toEqual([]);
        });

        it('should return empty when no matches', () => {
            const groups = ['Admin', 'Campaign', 'Research'];
            expect(filterGroups(groups, 'zzz')).toEqual([]);
        });

        it('should match substring anywhere in group name', () => {
            const groups = ['My Campaign', 'Research Team'];
            expect(filterGroups(groups, 'search')).toEqual(['Research Team']);
        });
    });

    describe('ChatPage agent select grouping', () => {
        function buildAgentSelectData(agents: { id: string; name: string; group?: string }[]) {
            const groups: Record<string, { value: string; label: string }[]> = {};
            const ungrouped: { value: string; label: string }[] = [];
            for (const a of agents) {
                if (a.group) {
                    if (!groups[a.group]) groups[a.group] = [];
                    groups[a.group].push({ value: a.id, label: a.name });
                } else {
                    ungrouped.push({ value: a.id, label: a.name });
                }
            }
            const hasGroups = Object.keys(groups).length > 0;
            if (!hasGroups) {
                return {
                    options: [{ value: '', label: 'Choose an Agent' }, ...ungrouped],
                    optionGroups: undefined,
                };
            }
            const optionGroups = Object.entries(groups)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([label, options]) => ({ label, options }));
            if (ungrouped.length > 0) {
                optionGroups.push({ label: 'Other', options: ungrouped });
            }
            return {
                options: [{ value: '', label: 'Choose an Agent' }],
                optionGroups,
            };
        }

        it('should return flat options when no agents have groups', () => {
            const agents = [
                { id: 'a', name: 'Alpha' },
                { id: 'b', name: 'Beta' },
            ];
            const result = buildAgentSelectData(agents);

            expect(result.optionGroups).toBeUndefined();
            expect(result.options).toHaveLength(3); // placeholder + 2 agents
        });

        it('should create optgroups when agents have groups', () => {
            const agents = [
                { id: 'a', name: 'Alpha', group: 'Research' },
                { id: 'b', name: 'Beta', group: 'Campaign' },
            ];
            const result = buildAgentSelectData(agents);

            expect(result.optionGroups).toBeDefined();
            expect(result.optionGroups).toHaveLength(2);
            expect(result.optionGroups![0].label).toBe('Campaign');
            expect(result.optionGroups![1].label).toBe('Research');
            expect(result.options).toHaveLength(1); // just the placeholder
        });

        it('should put ungrouped agents in "Other" optgroup', () => {
            const agents = [
                { id: 'a', name: 'Alpha', group: 'Research' },
                { id: 'b', name: 'Beta' },
            ];
            const result = buildAgentSelectData(agents);

            expect(result.optionGroups).toHaveLength(2);
            expect(result.optionGroups![0].label).toBe('Research');
            expect(result.optionGroups![1].label).toBe('Other');
            expect(result.optionGroups![1].options).toHaveLength(1);
        });

        it('should sort optgroups alphabetically', () => {
            const agents = [
                { id: 'a', name: 'A', group: 'Zebra' },
                { id: 'b', name: 'B', group: 'Alpha' },
                { id: 'c', name: 'C', group: 'Middle' },
            ];
            const result = buildAgentSelectData(agents);

            const labels = result.optionGroups!.map(g => g.label);
            expect(labels).toEqual(['Alpha', 'Middle', 'Zebra']);
        });
    });

});
