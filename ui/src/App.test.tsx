import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';

describe('App component', () => {
    it('renders without crashing', () => {
        // We wrap App in MemoryRouter because App likely contains routing
        render(
            <ThemeProvider>
                <MemoryRouter>
                    <App />
                </MemoryRouter>
            </ThemeProvider>
        );
        expect(document.body).toBeInTheDocument();
    });
});
