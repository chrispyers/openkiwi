import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatBubble, UserChatBubble, AgentChatBubble } from './ChatBubble';

// Mock MarkdownRenderer so we can assert it's used without pulling in the full dependency tree
vi.mock('./MarkdownRenderer', () => ({
    default: ({ content, breaks }) => (
        <div data-testid="markdown-renderer" data-breaks={breaks}>
            {content}
        </div>
    ),
}));

vi.mock('./AgentAvatar', () => ({
    default: ({ agent }) => <span data-testid="agent-avatar">{agent?.name}</span>,
}));

const noop = () => '';

describe('ChatBubble', () => {
    it('renders user messages with MarkdownRenderer', () => {
        render(
            <ChatBubble
                role="user"
                content="Hello **world**"
                isUser={true}
                avatar={<span>U</span>}
                formatTimestamp={noop}
            />
        );

        const md = screen.getByTestId('markdown-renderer');
        expect(md).toBeInTheDocument();
        expect(md).toHaveTextContent('Hello **world**');
    });

    it('renders assistant messages with MarkdownRenderer', () => {
        render(
            <ChatBubble
                role="assistant"
                content="Here is a `code snippet`"
                isUser={false}
                avatar={<span>A</span>}
                formatTimestamp={noop}
            />
        );

        const md = screen.getByTestId('markdown-renderer');
        expect(md).toBeInTheDocument();
        expect(md).toHaveTextContent('Here is a `code snippet`');
    });

    it('passes breaks={true} to MarkdownRenderer for both user and assistant', () => {
        const { unmount } = render(
            <ChatBubble
                role="user"
                content="line1\nline2"
                isUser={true}
                avatar={<span>U</span>}
                formatTimestamp={noop}
            />
        );

        expect(screen.getByTestId('markdown-renderer')).toHaveAttribute('data-breaks', 'true');
        unmount();

        render(
            <ChatBubble
                role="assistant"
                content="line1\nline2"
                isUser={false}
                avatar={<span>A</span>}
                formatTimestamp={noop}
            />
        );

        expect(screen.getByTestId('markdown-renderer')).toHaveAttribute('data-breaks', 'true');
    });

    it('does not render a plain-text div for user messages', () => {
        const { container } = render(
            <ChatBubble
                role="user"
                content="plain text"
                isUser={true}
                avatar={<span>U</span>}
                formatTimestamp={noop}
            />
        );

        // There should be no whitespace-pre-wrap div (the old plain-text rendering)
        const plainTextDiv = container.querySelector('.whitespace-pre-wrap');
        expect(plainTextDiv).toBeNull();
    });
});

describe('UserChatBubble', () => {
    it('renders message content via MarkdownRenderer', () => {
        render(
            <UserChatBubble
                message={{ role: 'user', content: '# Heading\n\nSome **bold** text', timestamp: 1234 }}
                formatTimestamp={noop}
            />
        );

        const md = screen.getByTestId('markdown-renderer');
        expect(md).toBeInTheDocument();
        expect(md).toHaveTextContent('# Heading');
        expect(md).toHaveTextContent('Some **bold** text');
    });

    it('applies user-bubble class', () => {
        const { container } = render(
            <UserChatBubble
                message={{ role: 'user', content: 'test', timestamp: 1234 }}
                formatTimestamp={noop}
            />
        );

        expect(container.querySelector('.user-bubble')).toBeInTheDocument();
    });
});

describe('AgentChatBubble', () => {
    it('renders message content via MarkdownRenderer', () => {
        render(
            <AgentChatBubble
                message={{ role: 'assistant', content: 'Agent **reply**', timestamp: 1234 }}
                agent={{ name: 'TestBot' }}
                formatTimestamp={noop}
            />
        );

        const md = screen.getByTestId('markdown-renderer');
        expect(md).toBeInTheDocument();
        expect(md).toHaveTextContent('Agent **reply**');
    });

    it('applies ai-bubble class', () => {
        const { container } = render(
            <AgentChatBubble
                message={{ role: 'assistant', content: 'test', timestamp: 1234 }}
                agent={{ name: 'TestBot' }}
                formatTimestamp={noop}
            />
        );

        expect(container.querySelector('.ai-bubble')).toBeInTheDocument();
    });
});
