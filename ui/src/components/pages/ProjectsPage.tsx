import React, { useState, useEffect } from 'react';
import { faPlus, faFolder, faSave, faEdit, faEye, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { toast } from 'sonner';

import Page from './Page';
import Text from '../Text';
import Button from '../Button';
import Card from '../Card';
import Modal from '../Modal';
import Input from '../Input';
import TextArea from '../TextArea';
import MarkdownRenderer from '../MarkdownRenderer';

interface ProjectsPageProps {
    gatewayAddr: string;
    gatewayToken: string;
}

interface Project {
    name: string;
}

export default function ProjectsPage({ gatewayAddr, gatewayToken }: ProjectsPageProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
    const [projectFiles, setProjectFiles] = useState<string[]>([]);
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (selectedProjectName) {
            fetchProjectFiles(selectedProjectName);
        } else {
            setProjectFiles([]);
            setSelectedFileName(null);
            setFileContent('');
            setIsEditing(false);
        }
    }, [selectedProjectName]);

    useEffect(() => {
        if (selectedProjectName && selectedFileName) {
            fetchFileContent(selectedProjectName, selectedFileName);
        } else {
            setFileContent('');
            setIsEditing(false);
        }
    }, [selectedFileName]);

    const fetchProjects = async () => {
        try {
            const res = await fetch(`${gatewayAddr}/api/projects`, {
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            });
            if (!res.ok) throw new Error('Failed to fetch projects');
            const data = await res.json();
            setProjects(data.map((name: string) => ({ name })));
        } catch (err) {
            console.error(err);
            toast.error('Failed to load projects');
        }
    };

    const fetchProjectFiles = async (name: string) => {
        try {
            const res = await fetch(`${gatewayAddr}/api/projects/${name}`, {
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            });
            if (!res.ok) throw new Error('Failed to fetch project files');
            const data = await res.json();
            setProjectFiles(data.files || []);
            setSelectedFileName(null);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load project files');
        }
    };

    const fetchFileContent = async (projectName: string, fileName: string) => {
        try {
            const res = await fetch(`${gatewayAddr}/api/projects/${projectName}/files/${fileName}`, {
                headers: { 'Authorization': `Bearer ${gatewayToken}` }
            });
            if (!res.ok) throw new Error('Failed to fetch file content');
            const data = await res.json();
            setFileContent(data.content);
            setIsEditing(false);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load file content');
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) {
            setError('Please enter a project name');
            return;
        }

        try {
            setCreating(true);
            setError(null);
            const res = await fetch(`${gatewayAddr}/api/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${gatewayToken}`
                },
                body: JSON.stringify({ name: newProjectName.trim() })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create project');
            }

            toast.success('Project created successfully');
            await fetchProjects();
            setSelectedProjectName(newProjectName.trim());
            setIsModalOpen(false);
            setNewProjectName('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create project');
        } finally {
            setCreating(false);
        }
    };

    const handleSaveFile = async () => {
        if (!selectedProjectName || !selectedFileName) return;

        try {
            const res = await fetch(`${gatewayAddr}/api/projects/${selectedProjectName}/files/${selectedFileName}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${gatewayToken}`
                },
                body: JSON.stringify({ content: fileContent })
            });

            if (!res.ok) throw new Error('Failed to save file');

            toast.success('File saved successfully');
            setIsEditing(false);
        } catch (err) {
            console.error(err);
            toast.error('Failed to save file');
        }
    };

    return (
        <Page
            title="Projects"
            subtitle="Manage and organize your agent-led projects and workspace initiatives."
            headerAction={
                <Button themed={true} onClick={() => setIsModalOpen(true)} icon={faPlus}>
                    New Project
                </Button>
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl h-[calc(100vh-12rem)] min-h-[500px]">
                {/* Left Column - Projects List */}
                <div className="lg:col-span-4 space-y-4">
                    <Card padding="p-4" className="space-y-1 h-full overflow-y-auto custom-scrollbar">
                        {projects.length === 0 ? (
                            <div className="px-4 py-8 text-center flex flex-col items-center gap-3">
                                <FontAwesomeIcon icon={faFolder} className="text-4xl text-neutral-300 dark:text-neutral-700" />
                                <Text secondary={true}>No projects yet</Text>
                            </div>
                        ) : (
                            projects.map((p) => (
                                <Button
                                    size="md"
                                    key={p.name}
                                    themed={selectedProjectName === p.name}
                                    className={`w-full !justify-start gap-3 !px-4 !py-3 ${selectedProjectName !== p.name ? 'hover:!bg-neutral-200 dark:hover:!bg-neutral-700' : ''}`}
                                    onClick={() => setSelectedProjectName(p.name)}
                                >
                                    <FontAwesomeIcon icon={faFolder} className={selectedProjectName === p.name ? "opacity-100" : "opacity-50"} />
                                    <div className="flex-1 text-left overflow-hidden min-w-0">
                                        <div className="truncate font-medium">{p.name}</div>
                                    </div>
                                </Button>
                            ))
                        )}
                    </Card>
                </div>

                {/* Right Column - Project Editor */}
                <div className="lg:col-span-8 h-full flex flex-col gap-4">
                    {selectedProjectName ? (
                        <>
                            {/* File List Row */}
                            <Card className="p-4 flex flex-wrap gap-2 shrink-0 border-b border-neutral-200 dark:border-neutral-800">
                                {projectFiles.length === 0 ? (
                                    <Text secondary={true} className="italic">No files found.</Text>
                                ) : (
                                    projectFiles.map(file => (
                                        <Button
                                            key={file}
                                            size="sm"
                                            themed={selectedFileName === file}
                                            onClick={() => setSelectedFileName(file)}
                                            icon={faFileAlt}
                                        >
                                            {file}
                                        </Button>
                                    ))
                                )}
                            </Card>

                            {/* Editor Row */}
                            <Card className="flex flex-col flex-1 !p-0 overflow-hidden">
                                {selectedFileName ? (
                                    <>
                                        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-bg-sidebar">
                                            <div className="flex items-center gap-3">
                                                <Text bold={true} size="lg">{selectedFileName}</Text>
                                            </div>
                                            <div className="flex gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <Button size="sm" onClick={() => setIsEditing(false)} icon={faEye}>
                                                            View
                                                        </Button>
                                                        <Button size="sm" themed={true} onClick={handleSaveFile} icon={faSave}>
                                                            Save
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button size="sm" onClick={() => setIsEditing(true)} icon={faEdit}>
                                                        Edit
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto w-full relative">
                                            {isEditing ? (
                                                <textarea
                                                    className="absolute inset-0 w-full h-full p-6 bg-transparent resize-none focus:outline-none font-mono text-sm custom-scrollbar text-neutral-800 dark:text-neutral-200"
                                                    value={fileContent}
                                                    onChange={e => setFileContent(e.target.value)}
                                                    placeholder="Write your markdown here..."
                                                    spellCheck={false}
                                                />
                                            ) : (
                                                <div className="p-6 h-full overflow-y-auto custom-scrollbar">
                                                    {fileContent ? (
                                                        <MarkdownRenderer content={fileContent} />
                                                    ) : (
                                                        <Text secondary={true} className="italic text-center mt-10 block">
                                                            This file is empty. Click edit to start writing.
                                                        </Text>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center bg-bg-card rounded-3xl h-full p-6">
                                        <Text secondary={true}>Select a file from the list above to view or edit</Text>
                                    </div>
                                )}
                            </Card>
                        </>
                    ) : (
                        <Card className="flex flex-col h-full items-center justify-center bg-bg-card rounded-3xl !border-0 p-6">
                            <FontAwesomeIcon icon={faFolder} className="text-5xl text-neutral-200 dark:text-neutral-800 mb-4" />
                            <Text secondary={true}>Select a project to view files</Text>
                        </Card>
                    )}
                </div>
            </div>

            {/* Create Project Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setNewProjectName('');
                    setError(null);
                }}
                title="Create New Project"
                className="!max-w-md"
            >
                <div className="p-6 space-y-6">
                    <Text size="sm">
                        Enter a short name for your new project. Alphanumeric characters, spaces, dashes, and underscores are allowed.
                    </Text>

                    <Input
                        label="Project Name"
                        currentText={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value.replace(/[^a-zA-Z0-9_\- ]/g, ''))}
                        clearText={() => setNewProjectName('')}
                        placeholder="e.g., Launch Plan"
                        icon={faFolder}
                        inputClassName="!mt-0"
                    />

                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
                            <p className="text-sm text-rose-500">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button
                            themed={false}
                            className="flex-1"
                            onClick={() => {
                                setIsModalOpen(false);
                                setNewProjectName('');
                                setError(null);
                            }}
                            disabled={creating}
                        >
                            Cancel
                        </Button>
                        <Button
                            themed={true}
                            className="flex-1"
                            onClick={handleCreateProject}
                            disabled={creating || !newProjectName.trim()}
                            icon={creating ? undefined : faPlus}
                        >
                            {creating ? 'Creating...' : 'Create Project'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </Page>
    );
}
