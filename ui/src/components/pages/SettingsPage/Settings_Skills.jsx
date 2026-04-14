import { useState, useEffect, useRef, useCallback } from 'react'
import { faPlus, faCloudArrowUp, faDownload, faBolt, faTriangleExclamation, faFileCircleCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import JSZip from 'jszip'
import Text from '../../Text'
import Column from '../../Column'
import Button from '../../Button'
import Modal from '../../Modal'
import MarkdownRenderer from '../../MarkdownRenderer'
import Page from '../Page'
import { toast } from 'sonner'

function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) return null
    const block = match[1]
    const result = {}
    // Parse simple key: value lines and nested metadata block
    const lines = block.split('\n')
    let inMetadata = false
    const metadataObj = {}
    for (const line of lines) {
        if (line.trim() === 'metadata:') { inMetadata = true; continue }
        if (inMetadata) {
            const nested = line.match(/^\s{2}(\w+):\s*["']?(.+?)["']?\s*$/)
            if (nested) { metadataObj[nested[1]] = nested[2]; continue }
            else { inMetadata = false }
        }
        const kv = line.match(/^([\w-]+):\s*(.+)$/)
        if (kv) result[kv[1]] = kv[2].replace(/^["']|["']$/g, '')
    }
    if (Object.keys(metadataObj).length > 0) result.metadata = metadataObj
    return Object.keys(result).length > 0 ? result : null
}

function MetadataRow({ label, value }) {
    if (!value) return null
    return (
        <div className="flex gap-3 text-sm">
            <span className="text-neutral-500 dark:text-neutral-400 w-36 shrink-0">{label}</span>
            <span className="font-medium break-all">{value}</span>
        </div>
    )
}

function InstallModal({ isOpen, onClose, gatewayAddr, gatewayToken, onInstalled }) {
    const [dragOver, setDragOver] = useState(false)
    const [file, setFile] = useState(null)
    const [metadata, setMetadata] = useState(null)
    const [parseError, setParseError] = useState(null)
    const [installing, setInstalling] = useState(false)
    const inputRef = useRef(null)

    const reset = useCallback(() => {
        setFile(null)
        setMetadata(null)
        setParseError(null)
        setDragOver(false)
        setInstalling(false)
    }, [])

    const handleClose = useCallback(() => {
        reset()
        onClose()
    }, [reset, onClose])

    const processFile = useCallback(async (f) => {
        if (!f.name.endsWith('.zip')) {
            setParseError('Please upload a .zip file.')
            setFile(null)
            setMetadata(null)
            return
        }
        setFile(f)
        setParseError(null)
        setMetadata(null)
        try {
            const zip = await JSZip.loadAsync(f)
            // Find SKILL.md at root or inside a single top-level folder
            let skillMd = zip.file('SKILL.md')
            if (!skillMd) {
                const match = Object.keys(zip.files).find(p => /^[^/]+\/SKILL\.md$/.test(p))
                if (match) skillMd = zip.file(match)
            }
            if (!skillMd) {
                setParseError('No SKILL.md found in this archive.')
                return
            }
            const content = await skillMd.async('string')
            const parsed = parseFrontmatter(content)
            if (!parsed || !parsed.name) {
                setParseError('SKILL.md is missing valid frontmatter.')
                return
            }
            setMetadata(parsed)
        } catch (err) {
            setParseError('Could not read archive: ' + err.message)
        }
    }, [])

    const onDrop = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)
        const f = e.dataTransfer.files[0]
        if (f) processFile(f)
    }, [processFile])

    const onInputChange = useCallback((e) => {
        const f = e.target.files[0]
        if (f) processFile(f)
    }, [processFile])

    const handleInstall = useCallback(async () => {
        if (!file || !metadata) return
        setInstalling(true)
        try {
            const form = new FormData()
            form.append('skill', file)
            const res = await fetch(`${gatewayAddr}/api/skills/install`, {
                method: 'POST',
                headers: gatewayToken ? { Authorization: `Bearer ${gatewayToken}` } : {},
                body: form,
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Install failed.')
            toast.success(`Skill "${data.skill.name}" installed.`)
            onInstalled()
            handleClose()
        } catch (err) {
            toast.error(err.message)
            setInstalling(false)
        }
    }, [file, metadata, gatewayAddr, gatewayToken, onInstalled, handleClose])

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Install Skill">
            <div className="p-6 flex flex-col gap-6">
                {/* Drop zone */}
                <div
                    className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed transition-colors cursor-pointer min-h-48
                        ${dragOver ? 'border-accent-primary bg-accent-primary/5' : 'border-divider hover:border-neutral-400 dark:hover:border-neutral-500'}
                        ${file && !parseError ? 'border-green-500/50 bg-green-500/5' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => inputRef.current?.click()}
                >
                    <input ref={inputRef} type="file" accept=".zip" className="hidden" onChange={onInputChange} />
                    <FontAwesomeIcon
                        icon={faCloudArrowUp}
                        className={`text-4xl transition-colors ${dragOver ? 'text-accent-primary' : 'text-neutral-400'}`}
                    />
                    {file ? (
                        <div className="text-center">
                            <Text bold={true} size="sm">{file.name}</Text>
                            <Text secondary={true} size="sm" block={true} className="mt-0.5">
                                Click to choose a different file
                            </Text>
                        </div>
                    ) : (
                        <div className="text-center px-8">
                            <Text bold={true} size="sm">Drop a skill archive here</Text>
                            <Text secondary={true} size="sm" block={true} className="mt-1">
                                or click to browse — accepts <code className="font-mono">.zip</code> files
                            </Text>
                        </div>
                    )}
                </div>

                {/* Parse error */}
                {parseError && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                        <Text size="sm" className="text-red-500">{parseError}</Text>
                    </div>
                )}

                {/* Metadata preview */}
                {metadata && (
                    <div className="rounded-2xl border border-divider bg-card p-5 flex flex-col gap-3">
                        <Text bold={true} size="sm" className="uppercase tracking-wide text-neutral-500">Skill Details</Text>
                        <div className="flex flex-col gap-2">
                            <MetadataRow label="Name" value={metadata.name} />
                            <MetadataRow label="Description" value={metadata.description} />
                            {metadata.metadata?.author && <MetadataRow label="Author" value={metadata.metadata.author} />}
                            {metadata.metadata?.version && <MetadataRow label="Version" value={metadata.metadata.version} />}
                            <MetadataRow label="License" value={metadata.license} />
                            <MetadataRow label="Compatibility" value={metadata.compatibility} />
                            <MetadataRow label="Allowed Tools" value={metadata['allowed-tools']} />
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                    <Button onClick={handleClose} size="md">Cancel</Button>
                    <Button
                        themed={true}
                        size="md"
                        disabled={!metadata || !!parseError || installing}
                        onClick={handleInstall}
                    >
                        {installing ? 'Installing…' : 'Install'}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

export default function Settings_Skills({ gatewayAddr, gatewayToken }) {
    const [skills, setSkills] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [viewingSkill, setViewingSkill] = useState(null) // { name, content }

    const fetchSkills = useCallback(() => {
        setLoading(true)
        fetch(`${gatewayAddr}/api/skills`, {
            headers: gatewayToken ? { Authorization: `Bearer ${gatewayToken}` } : {}
        })
            .then(r => r.json())
            .then(data => { setSkills(data.skills || []); setLoading(false) })
            .catch(err => { setError(err.message); setLoading(false) })
    }, [gatewayAddr, gatewayToken])

    useEffect(() => { fetchSkills() }, [fetchSkills])

    const openSkill = useCallback(async (skill) => {
        try {
            const res = await fetch(`${gatewayAddr}/api/skills/${encodeURIComponent(skill.name)}`, {
                headers: gatewayToken ? { Authorization: `Bearer ${gatewayToken}` } : {}
            })
            if (!res.ok) throw new Error(`Server returned ${res.status}`)
            const data = await res.json()
            setViewingSkill({ name: skill.name, content: data.content })
        } catch (err) {
            toast.error('Failed to load skill: ' + err.message)
        }
    }, [gatewayAddr, gatewayToken])

    const installButton = (
        <Button themed={true} icon={faPlus} onClick={() => setModalOpen(true)}>
            Install Skill
        </Button>
    )

    return (
        <Page
            title="Skills"
            subtitle="Skills extend what agents can do. Each skill provides a set of instructions and optional scripts that agents activate on demand."
            headerAction={installButton}
        >
            <Column>

                {/* How-to cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                    <div className="rounded-xl border border-divider bg-card p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-accent-primary">
                            <FontAwesomeIcon icon={faDownload} className="text-sm" />
                            <Text bold={true} size="sm">1. Find &amp; Download</Text>
                        </div>
                        <Text secondary={true} size="sm">
                            Browse skills at{' '}
                            <a href="https://skillsmp.com/search" target="_blank" rel="noreferrer" className="text-accent-primary hover:underline">
                                skillsmp.com/search
                            </a>
                            . Each skill is a <code className="font-mono">.zip</code> archive containing a <code className="font-mono">SKILL.md</code> file and any supporting scripts.
                        </Text>
                    </div>

                    <div className="rounded-xl border border-divider bg-card p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-accent-primary">
                            <FontAwesomeIcon icon={faFileCircleCheck} className="text-sm" />
                            <Text bold={true} size="sm">2. Install</Text>
                        </div>
                        <Text secondary={true} size="sm">
                            Click <strong>Install Skill</strong> above and drop the <code className="font-mono">.zip</code> into the dialog. The skill becomes available to all agents immediately - no restart required.
                        </Text>
                    </div>

                    <div className="rounded-xl border border-divider bg-card p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-accent-primary">
                            <FontAwesomeIcon icon={faBolt} className="text-sm" />
                            <Text bold={true} size="sm">3. Use</Text>
                        </div>
                        <Text secondary={true} size="sm">
                            Skills are activated automatically when your agent decides they are relevant. You can also ask your agent directly, e.g. <em>"use the X skill to…"</em>
                        </Text>
                    </div>
                </div>

                {/* Model requirement callout */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex gap-3 items-start mb-2">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500 mt-0.5 shrink-0" />
                    <Text size="sm" secondary={true}>
                        <strong className="text-primary">Model requirement:</strong> The model that your agent uses must be <strong>trained for tool use</strong> in order to activate skills.
                    </Text>
                </div>

                {loading && <Text secondary={true} size="sm">Loading skills...</Text>}
                {error && <Text size="sm" className="text-red-500">Failed to load skills: {error}</Text>}

                {!loading && !error && skills.length === 0 && (
                    <div className="mt-4 p-8 border border-dashed border-divider rounded-xl text-center">
                        <Text secondary={true} size="sm">No skills installed.</Text>
                        <Text secondary={true} size="sm" block={true} className="mt-1">
                            Click <strong>Install Skill</strong> to add one, or place a skill folder directly into the <code className="font-mono">skills/</code> directory.
                        </Text>
                    </div>
                )}

                {!loading && !error && skills.length > 0 && (
                    <div className="mt-4 flex flex-col gap-3">
                        {skills.map(skill => (
                            <button
                                key={skill.name}
                                onClick={() => openSkill(skill)}
                                className="p-4 rounded-xl border border-divider bg-card text-left hover:border-accent-primary/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors w-full"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <Text bold={true} size="sm">{skill.name}</Text>
                                        <div className="mt-1 text-sm text-secondary line-clamp-2">
                                            {skill.description}
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary font-mono">
                                        installed
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </Column>

            <InstallModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                gatewayAddr={gatewayAddr}
                gatewayToken={gatewayToken}
                onInstalled={fetchSkills}
            />

            <Modal
                isOpen={!!viewingSkill}
                onClose={() => setViewingSkill(null)}
                title={viewingSkill?.name}
            >
                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    <MarkdownRenderer content={viewingSkill?.content || ''} />
                </div>
            </Modal>
        </Page>
    )
}
