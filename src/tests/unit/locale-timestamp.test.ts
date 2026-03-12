import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('System locale timestamp formatting', () => {
    let originalToLocaleString: typeof Date.prototype.toLocaleString;

    beforeEach(() => {
        originalToLocaleString = Date.prototype.toLocaleString;
    });

    afterEach(() => {
        Date.prototype.toLocaleString = originalToLocaleString;
    });

    it('should call toLocaleString with undefined locale (system default) not a hardcoded locale', () => {
        const spy = vi.spyOn(Date.prototype, 'toLocaleString');
        const date = new Date('2026-03-12T14:30:00Z');

        // Simulate the heartbeat-manager pattern
        date.toLocaleString(undefined, {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            dateStyle: 'full',
            timeStyle: 'long',
        });

        expect(spy).toHaveBeenCalledWith(undefined, expect.objectContaining({
            dateStyle: 'full',
            timeStyle: 'long',
        }));

        // Verify first argument is undefined (system default), NOT 'en-US'
        const firstArg = spy.mock.calls[0][0];
        expect(firstArg).toBeUndefined();
    });

    it('should call toLocaleString with undefined locale for chat-handler pattern', () => {
        const spy = vi.spyOn(Date.prototype, 'toLocaleString');
        const date = new Date('2026-03-12T14:30:00Z');

        // Simulate the chat-handler pattern
        date.toLocaleString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short',
        });

        const firstArg = spy.mock.calls[0][0];
        expect(firstArg).toBeUndefined();
    });

    it('toLocaleString with undefined locale should return a valid date string', () => {
        const date = new Date('2026-03-12T14:30:00Z');

        const result = date.toLocaleString(undefined, {
            timeZone: 'Europe/London',
            dateStyle: 'full',
            timeStyle: 'long',
        });

        // Should produce a non-empty string containing the year
        expect(result).toBeTruthy();
        expect(result).toContain('2026');
    });

    it('toLocaleString with undefined locale should respect the given timezone', () => {
        const date = new Date('2026-03-12T14:30:00Z');

        const londonResult = date.toLocaleString(undefined, {
            timeZone: 'Europe/London',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });

        const tokyoResult = date.toLocaleString(undefined, {
            timeZone: 'Asia/Tokyo',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });

        // London (GMT) and Tokyo (JST, +9) should produce different times
        expect(londonResult).not.toEqual(tokyoResult);
    });
});
