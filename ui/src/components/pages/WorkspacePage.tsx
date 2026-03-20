import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFolder, faFolderOpen, faFile, faFileCode, faFileAlt,
    faImage, faChevronRight, faChevronDown, faSpinner, faRotateRight
} from '@fortawesome/free-solid-svg-icons';
import Text from '../Text';
import MarkdownRenderer from '../MarkdownRenderer';

interface WorkspaceEntry {
    name: string;
    type: 'file' | 'directory';
    path: string;
}

interface TreeNode extends WorkspaceEntry {
    children?: TreeNode[];
    isLoaded?: boolean;
    isExpanded?: boolean;
}

interface WorkspacePageProps {
    gatewayAddr: string;
    gatewayToken: string;
}

// ── File type helpers ──────────────────────────────────────────────────────────

const CODE_EXTENSIONS = new Set([
    'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
    'css', 'scss', 'less', 'html', 'xml', 'yaml', 'yml', 'toml', 'sh', 'bash',
    'zsh', 'fish', 'sql', 'graphql', 'json', 'env', 'dockerfile', 'makefile',
    'swift', 'kt', 'dart', 'lua', 'r', 'scala', 'ex', 'exs', 'clj', 'hs', 'elm',
]);

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']);

function getExtension(name: string): string {
    return name.split('.').pop()?.toLowerCase() ?? '';
}

function getFileIcon(name: string) {
    const ext = getExtension(name);
    if (IMAGE_EXTENSIONS.has(ext)) return faImage;
    if (CODE_EXTENSIONS.has(ext)) return faFileCode;
    if (ext === 'md' || ext === 'txt') return faFileAlt;
    return faFile;
}

function getLanguage(name: string): string {
    const ext = getExtension(name);
    const map: Record<string, string> = {
        js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
        py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
        c: 'c', cpp: 'cpp', h: 'c', css: 'css', scss: 'scss', less: 'less',
        html: 'html', xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'toml',
        sh: 'bash', bash: 'bash', zsh: 'bash', sql: 'sql', json: 'json',
        graphql: 'graphql', swift: 'swift', kt: 'kotlin', dart: 'dart',
        lua: 'lua', r: 'r', scala: 'scala',
    };
    return map[ext] ?? ext;
}

function wrapInCodeFence(name: string, content: string): string {
    const lang = getLanguage(name);
    return `\`\`\`${lang}\n${content}\n\`\`\``;
}

// ── Tree Node Component ────────────────────────────────────────────────────────

function TreeItem({
    node,
    depth,
    selectedPath,
    onSelect,
    onToggle,
}: {
    node: TreeNode;
    depth: number;
    selectedPath: string | null;
    onSelect: (node: TreeNode) => void;
    onToggle: (node: TreeNode) => void;
}) {
    const isSelected = selectedPath === node.path;
    const isDir = node.type === 'directory';

    return (
        <div>
            <div
                className={`flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer select-none transition-colors text-sm
                    ${isSelected
                        ? 'bg-accent-primary/15 text-primary font-medium'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-secondary hover:text-primary'
                    }`}
                style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
                onClick={() => isDir ? onToggle(node) : onSelect(node)}
            >
                {isDir && (
                    <FontAwesomeIcon
                        icon={node.isExpanded ? faChevronDown : faChevronRight}
                        className="w-2.5 h-2.5 flex-shrink-0 opacity-50"
                    />
                )}
                {!isDir && <span className="w-2.5 flex-shrink-0" />}
                <FontAwesomeIcon
                    icon={isDir ? (node.isExpanded ? faFolderOpen : faFolder) : getFileIcon(node.name)}
                    className={`w-3.5 h-3.5 flex-shrink-0 ${isDir ? 'text-yellow-500' : 'text-blue-400'}`}
                />
                <span className="truncate">{node.name}</span>
            </div>

            {isDir && node.isExpanded && node.children && (
                <div>
                    {node.children.map(child => (
                        <TreeItem
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            selectedPath={selectedPath}
                            onSelect={onSelect}
                            onToggle={onToggle}
                        />
                    ))}
                    {node.children.length === 0 && (
                        <div
                            className="text-xs text-secondary italic py-1"
                            style={{ paddingLeft: `${0.5 + (depth + 1) * 1.25}rem` }}
                        >
                            Empty
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function WorkspacePage({ gatewayAddr, gatewayToken }: WorkspacePageProps) {
    const [tree, setTree] = useState<TreeNode[]>([]);
    const [rootError, setRootError] = useState<string | null>(null);
    const [loadingRoot, setLoadingRoot] = useState(true);
    const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [loadingFile, setLoadingFile] = useState(false);

    const api = (path: string) => `${gatewayAddr.replace(/\/$/, '')}/api/files${path}`;
    const headers = { 'Authorization': `Bearer ${gatewayToken}` };

    const fetchEntries = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
        const res = await fetch(api(`/ls?path=${encodeURIComponent(dirPath)}`), { headers });
        if (!res.ok) throw new Error('Failed to load directory');
        const data = await res.json();
        return (data.entries as WorkspaceEntry[]).map(e => ({
            ...e,
            isExpanded: false,
            isLoaded: false,
            children: e.type === 'directory' ? undefined : undefined,
        }));
    }, [gatewayAddr, gatewayToken]);

    const loadRoot = useCallback(() => {
        setLoadingRoot(true);
        setRootError(null);
        fetchEntries('').then(entries => {
            setTree(entries);
        }).catch(() => {
            setRootError('Failed to load files. Make sure the server is running.');
        }).finally(() => setLoadingRoot(false));
    }, [fetchEntries]);

    // Load root on mount
    useEffect(() => { loadRoot(); }, [loadRoot]);

    const updateNode = (nodes: TreeNode[], targetPath: string, updater: (n: TreeNode) => TreeNode): TreeNode[] => {
        return nodes.map(n => {
            if (n.path === targetPath) return updater(n);
            if (n.children) return { ...n, children: updateNode(n.children, targetPath, updater) };
            return n;
        });
    };

    const handleToggle = async (node: TreeNode) => {
        if (node.isExpanded) {
            setTree(prev => updateNode(prev, node.path, n => ({ ...n, isExpanded: false })));
            return;
        }

        if (!node.isLoaded) {
            // Show expanding with spinner
            setTree(prev => updateNode(prev, node.path, n => ({ ...n, isExpanded: true, children: [] })));
            try {
                const children = await fetchEntries(node.path);
                setTree(prev => updateNode(prev, node.path, n => ({ ...n, isExpanded: true, isLoaded: true, children })));
            } catch {
                setTree(prev => updateNode(prev, node.path, n => ({ ...n, isExpanded: false })));
            }
        } else {
            setTree(prev => updateNode(prev, node.path, n => ({ ...n, isExpanded: true })));
        }
    };

    const handleSelectFile = async (node: TreeNode) => {
        setSelectedFile(node);
        setFileContent(null);
        setFileError(null);
        setLoadingFile(true);

        const ext = getExtension(node.name);
        if (IMAGE_EXTENSIONS.has(ext)) {
            setFileContent('__IMAGE__');
            setLoadingFile(false);
            return;
        }

        try {
            const res = await fetch(api(`/file?path=${encodeURIComponent(node.path)}`), { headers });
            if (!res.ok) {
                const err = await res.json();
                setFileError(err.error ?? 'Failed to load file');
            } else {
                const data = await res.json();
                setFileContent(data.content);
            }
        } catch {
            setFileError('Failed to load file');
        } finally {
            setLoadingFile(false);
        }
    };

    const renderFileContent = () => {
        if (loadingFile) {
            return (
                <div className="flex items-center justify-center h-full text-secondary gap-2">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                    <span>Loading…</span>
                </div>
            );
        }
        if (fileError) {
            return (
                <div className="flex items-center justify-center h-full text-red-500 text-sm">{fileError}</div>
            );
        }
        if (!selectedFile || fileContent === null) {
            return (
                <div className="flex items-center justify-center h-full text-secondary text-sm">
                    Select a file to view its contents
                </div>
            );
        }

        const ext = getExtension(selectedFile.name);

        if (fileContent === '__IMAGE__') {
            const imageUrl = `${gatewayAddr.replace(/\/$/, '')}/api/files/workspace-files/${selectedFile.path}?token=${gatewayToken}`;
            return (
                <div className="flex items-center justify-center h-full p-8">
                    <img src={imageUrl} alt={selectedFile.name} className="max-w-full max-h-full object-contain rounded-xl" />
                </div>
            );
        }

        if (ext === 'md') {
            return (
                <div className="p-8 max-w-4xl mx-auto w-full">
                    <MarkdownRenderer content={fileContent} />
                </div>
            );
        }

        if (CODE_EXTENSIONS.has(ext) || ext === 'txt' || ext === '') {
            const markdown = CODE_EXTENSIONS.has(ext)
                ? wrapInCodeFence(selectedFile.name, fileContent)
                : fileContent;
            return (
                <div className="p-6 w-full">
                    {CODE_EXTENSIONS.has(ext)
                        ? <MarkdownRenderer content={markdown} />
                        : <pre className="text-sm text-primary whitespace-pre-wrap font-mono leading-relaxed">{fileContent}</pre>
                    }
                </div>
            );
        }

        // Fallback: plain text
        return (
            <div className="p-6">
                <pre className="text-sm text-primary whitespace-pre-wrap font-mono leading-relaxed">{fileContent}</pre>
            </div>
        );
    };

    return (
        <div className="flex h-full overflow-hidden">
            {/* Tree sidebar */}
            <div className="w-72 flex-shrink-0 border-r border-divider flex flex-col bg-sidebar overflow-hidden">
                <div className="px-4 py-3 border-b border-divider flex-shrink-0 flex items-center justify-between">
                    <Text bold={true} size="sm" className="uppercase tracking-wider text-secondary">Files</Text>
                    <button
                        onClick={loadRoot}
                        disabled={loadingRoot}
                        title="Refresh"
                        className="text-secondary hover:text-primary transition-colors disabled:opacity-40"
                    >
                        <FontAwesomeIcon icon={faRotateRight} className={`text-sm ${loadingRoot ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto py-2 px-1">
                    {loadingRoot ? (
                        <div className="flex items-center justify-center p-8 text-secondary gap-2">
                            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                        </div>
                    ) : rootError ? (
                        <div className="text-xs text-red-500 px-4 py-3">{rootError}</div>
                    ) : tree.length === 0 ? (
                        <div className="text-xs text-secondary italic px-4 py-3">Workspace is empty</div>
                    ) : (
                        tree.map(node => (
                            <TreeItem
                                key={node.path}
                                node={node}
                                depth={0}
                                selectedPath={selectedFile?.path ?? null}
                                onSelect={handleSelectFile}
                                onToggle={handleToggle}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* File viewer */}
            <div className="flex-1 flex flex-col overflow-hidden bg-surface">
                {selectedFile && (
                    <div className="px-6 py-3 border-b border-divider flex items-center gap-2 flex-shrink-0 bg-surface/80 backdrop-blur-md">
                        <FontAwesomeIcon
                            icon={getFileIcon(selectedFile.name)}
                            className="text-blue-400 w-4 h-4 flex-shrink-0"
                        />
                        <Text size="sm" secondary={true} className="font-mono">{selectedFile.path}</Text>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto">
                    {renderFileContent()}
                </div>
            </div>
        </div>
    );
}
