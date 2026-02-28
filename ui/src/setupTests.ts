import '@testing-library/jest-dom';
import { vi } from 'vitest';

Element.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.scrollIntoView = vi.fn();

