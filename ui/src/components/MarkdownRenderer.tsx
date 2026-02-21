import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Code from './Code';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
    return (
        <div className={`prose-chat dark:prose-invert max-w-none leading-relaxed select-text ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    pre: ({ children }) => <>{children}</>,
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isMultiLine = String(children).includes('\n');
                        const isBlock = !inline && (match || isMultiLine);

                        return isBlock ? (
                            <div
                                className="my-5 rounded-xl border border-white-trans overflow-hidden shadow-lg"
                                style={{ backgroundColor: 'var(--code-bg)' }}
                            >
                                {match && (
                                    <div
                                        className="px-4 py-2 border-b border-white-trans text-xs font-bold uppercase tracking-widest flex justify-between items-center"
                                        style={{ backgroundColor: 'var(--code-header-bg)', color: 'var(--code-text)' }}
                                    >
                                        <span>{match[1]}</span>
                                        <span
                                            className="cursor-pointer opacity-80 hover:opacity-100 transition-colors"
                                            onClick={() => navigator.clipboard.writeText(String(children))}
                                        >
                                            Copy
                                        </span>
                                    </div>
                                )}
                                <SyntaxHighlighter
                                    {...props}
                                    children={String(children).replace(/\n$/, '')}
                                    style={vscDarkPlus}
                                    language={match ? match[1] : ''}
                                    PreTag="div"
                                    customStyle={{ margin: 0, padding: '20px', fontSize: '13px', background: 'transparent' }}
                                />
                            </div>
                        ) : (
                            <Code>{String(children).replace(/`/g, '')}</Code>
                        );
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownRenderer;
