import { useState, useRef } from 'react';
import Modal from '../../Modal';
import Button from '../../Button';
import AvatarEditor from 'react-avatar-editor';
import Row from '../../Row';
import Column from '../../Column';
import Text from '../../Text';

export default function AvatarModal({ isOpen, onClose, onSave }) {
    const [image, setImage] = useState(null);
    const [scale, setScale] = useState(1.2);
    const editorRef = useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
        if (file && (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png'))) {
            setImage(file);
        } else {
            alert("Please provide a .png image");
        }
    };

    const handleSave = () => {
        if (editorRef.current) {
            const canvas = editorRef.current.getImageScaledToCanvas();
            const dataUrl = canvas.toDataURL('image/png');
            onSave(dataUrl);
            onClose();
        }
    };

    const resetAndClose = () => {
        setImage(null);
        setScale(1.2);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={resetAndClose} title="Set Agent Avatar" className="!max-w-md">
            <div className="p-6 space-y-6 flex flex-col items-center w-full">
                {!image ? (
                    <div
                        className="w-full h-64 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('avatar-upload')?.click()}
                    >
                        <Text secondary={true}>Drag & drop a .png image here, or click to select</Text>
                        <input
                            id="avatar-upload"
                            type="file"
                            accept=".png"
                            className="hidden"
                            onChange={handleDrop}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center space-y-4 w-full">
                        <AvatarEditor
                            ref={editorRef}
                            image={image}
                            width={200}
                            height={200}
                            border={50}
                            borderRadius={100}
                            color={[0, 0, 0, 0.6]} // RGBA
                            scale={scale}
                            rotate={0}
                            className="rounded-lg shadow-inner bg-neutral-900"
                        />
                        <div className="w-full space-y-2">
                            <Text size="sm" secondary={true} className="text-center w-full block">Scale</Text>
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.01"
                                value={scale}
                                onChange={(e) => setScale(parseFloat(e.target.value))}
                                className="w-full cursor-ew-resize"
                            />
                        </div>
                    </div>
                )}

                <Row className="w-full mt-4">
                    <Column grow={true}>
                        <Button themed={false} className="w-full" onClick={resetAndClose}>Cancel</Button>
                    </Column>
                    <Column grow={true}>
                        <Button themed={true} className="w-full" onClick={handleSave} disabled={!image}>Save</Button>
                    </Column>
                </Row>
            </div>
        </Modal>
    );
}
