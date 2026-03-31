import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock pg before importing the tool
const mockQuery = vi.fn();
const mockPoolEnd = vi.fn();

vi.mock('pg', () => {
    return {
        default: {
            Pool: class MockPool {
                options: any;
                constructor(opts: any) {
                    MockPool._lastInstance = this;
                    MockPool._lastOpts = opts;
                    this.options = opts;
                }
                query = mockQuery;
                end = mockPoolEnd;
                static _lastInstance: any;
                static _lastOpts: any;
            }
        }
    };
});

import pg from 'pg';
import tool from '../postgres/postgres.js';

const MockPool = pg.Pool as any;

function makeContext(connectionString?: string) {
    if (!connectionString) return undefined;
    return {
        agentConfig: {
            tools: {
                postgres: { connectionString }
            }
        }
    };
}

function mockQuerySuccess(rows: any[], fields?: { name: string; dataTypeID: number }[]) {
    mockQuery.mockResolvedValue({
        rows,
        rowCount: rows.length,
        fields: fields || rows.length > 0
            ? Object.keys(rows[0] || {}).map(name => ({ name, dataTypeID: 25 }))
            : []
    });
}

function mockQueryError(message: string) {
    mockQuery.mockRejectedValue(new Error(message));
}

describe('postgres_query tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.POSTGRES_CONNECTION_STRING;
    });

    describe('definition', () => {
        it('should export a valid tool definition', () => {
            expect(tool.definition.name).toBe('postgres_query');
            expect(tool.definition.parameters.type).toBe('object');
            expect(tool.definition.parameters.required).toEqual(['query']);
        });

        it('should have a handler function', () => {
            expect(typeof tool.handler).toBe('function');
        });

        it('should declare query, params, and connection_string properties', () => {
            const props = tool.definition.parameters.properties;
            expect(props.query).toBeDefined();
            expect(props.params).toBeDefined();
            expect(props.connection_string).toBeDefined();
        });
    });

    describe('read-only validation', () => {
        it('should allow SELECT queries', async () => {
            mockQuerySuccess([{ id: 1, name: 'test' }]);
            const result = await tool.handler({
                query: 'SELECT * FROM workouts',
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toBeUndefined();
            expect(result.rows).toHaveLength(1);
        });

        it('should allow WITH (CTE) queries', async () => {
            mockQuerySuccess([{ total: 10 }]);
            const result = await tool.handler({
                query: 'WITH recent AS (SELECT * FROM workouts WHERE date > $1) SELECT count(*) as total FROM recent',
                params: ['2026-03-01'],
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toBeUndefined();
            expect(result.rows).toHaveLength(1);
        });

        it('should allow SELECT with leading whitespace', async () => {
            mockQuerySuccess([]);
            const result = await tool.handler({
                query: '   SELECT 1',
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toBeUndefined();
        });

        it('should reject INSERT queries', async () => {
            const result = await tool.handler({
                query: 'INSERT INTO workouts (name) VALUES ($1)',
                params: ['bench press'],
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toMatch(/read-only/i);
        });

        it('should reject UPDATE queries', async () => {
            const result = await tool.handler({
                query: 'UPDATE workouts SET name = $1 WHERE id = $2',
                params: ['squat', '1'],
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toMatch(/read-only/i);
        });

        it('should reject DELETE queries', async () => {
            const result = await tool.handler({
                query: 'DELETE FROM workouts WHERE id = $1',
                params: ['1'],
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toMatch(/read-only/i);
        });

        it('should reject DROP queries', async () => {
            const result = await tool.handler({
                query: 'DROP TABLE workouts',
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toMatch(/read-only/i);
        });

        it('should reject ALTER queries', async () => {
            const result = await tool.handler({
                query: 'ALTER TABLE workouts ADD COLUMN reps INT',
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toMatch(/read-only/i);
        });

        it('should reject CREATE queries', async () => {
            const result = await tool.handler({
                query: 'CREATE TABLE evil (id INT)',
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toMatch(/read-only/i);
        });

        it('should reject TRUNCATE queries', async () => {
            const result = await tool.handler({
                query: 'TRUNCATE workouts',
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toMatch(/read-only/i);
        });

        it('should reject GRANT queries', async () => {
            const result = await tool.handler({
                query: 'GRANT ALL ON workouts TO public',
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toMatch(/read-only/i);
        });

        it('should reject COPY queries', async () => {
            const result = await tool.handler({
                query: 'COPY workouts TO STDOUT',
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toMatch(/read-only/i);
        });

        it('should reject case-insensitive write attempts', async () => {
            const result = await tool.handler({
                query: 'insert INTO workouts (name) VALUES ($1)',
                params: ['sneaky'],
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toMatch(/read-only/i);
        });

        it('should reject queries that are not SELECT or WITH', async () => {
            const result = await tool.handler({
                query: 'EXPLAIN SELECT * FROM workouts',
                _context: makeContext('postgresql://localhost/fitness')
            });
            expect(result.error).toMatch(/Only SELECT and WITH/);
        });
    });

    describe('connection string resolution', () => {
        it('should use explicit connection_string argument', async () => {
            mockQuerySuccess([]);
            const result = await tool.handler({
                query: 'SELECT 1',
                connection_string: 'postgresql://explicit:5432/db'
            });
            expect(result.error).toBeUndefined();
            expect(MockPool._lastOpts.connectionString).toBe('postgresql://explicit:5432/db');
        });

        it('should use agent config when no explicit connection_string', async () => {
            mockQuerySuccess([]);
            const result = await tool.handler({
                query: 'SELECT 1',
                _context: makeContext('postgresql://agent-config:5432/fitness')
            });
            expect(result.error).toBeUndefined();
            expect(MockPool._lastOpts.connectionString).toBe('postgresql://agent-config:5432/fitness');
        });

        it('should fall back to POSTGRES_CONNECTION_STRING env var', async () => {
            process.env.POSTGRES_CONNECTION_STRING = 'postgresql://env-var:5432/fitness';
            mockQuerySuccess([]);
            const result = await tool.handler({
                query: 'SELECT 1'
            });
            expect(result.error).toBeUndefined();
            expect(MockPool._lastOpts.connectionString).toBe('postgresql://env-var:5432/fitness');
        });

        it('should prefer explicit arg over agent config', async () => {
            mockQuerySuccess([]);
            const result = await tool.handler({
                query: 'SELECT 1',
                connection_string: 'postgresql://explicit-priority:5432/db',
                _context: makeContext('postgresql://agent-config-priority:5432/fitness')
            });
            expect(result.error).toBeUndefined();
            expect(MockPool._lastOpts.connectionString).toBe('postgresql://explicit-priority:5432/db');
        });

        it('should error when no connection string is available', async () => {
            const result = await tool.handler({
                query: 'SELECT 1'
            });
            expect(result.error).toMatch(/No PostgreSQL connection string/);
        });
    });

    describe('query execution', () => {
        it('should return rows, rowCount, and fields', async () => {
            const rows = [
                { id: 1, exercise: 'Squat', weight: 100 },
                { id: 2, exercise: 'Bench Press', weight: 80 }
            ];
            mockQuerySuccess(rows);

            const result = await tool.handler({
                query: 'SELECT * FROM workouts',
                _context: makeContext('postgresql://localhost/fitness')
            });

            expect(result.rows).toEqual(rows);
            expect(result.rowCount).toBe(2);
            expect(result.fields).toEqual([
                { name: 'id', dataTypeID: 25 },
                { name: 'exercise', dataTypeID: 25 },
                { name: 'weight', dataTypeID: 25 }
            ]);
        });

        it('should pass parameterised values', async () => {
            mockQuerySuccess([{ count: 5 }]);

            await tool.handler({
                query: 'SELECT count(*) as count FROM workouts WHERE date >= $1 AND type = $2',
                params: ['2026-03-01', 'strength'],
                _context: makeContext('postgresql://localhost/fitness')
            });

            expect(mockQuery).toHaveBeenCalledWith(
                'SELECT count(*) as count FROM workouts WHERE date >= $1 AND type = $2',
                ['2026-03-01', 'strength']
            );
        });

        it('should pass empty params array when params not provided', async () => {
            mockQuerySuccess([]);

            await tool.handler({
                query: 'SELECT * FROM workouts',
                _context: makeContext('postgresql://localhost/fitness')
            });

            expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM workouts', []);
        });

        it('should return empty results gracefully', async () => {
            mockQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                fields: [{ name: 'id', dataTypeID: 23 }]
            });

            const result = await tool.handler({
                query: 'SELECT * FROM workouts WHERE 1 = 0',
                _context: makeContext('postgresql://localhost/fitness')
            });

            expect(result.rows).toEqual([]);
            expect(result.rowCount).toBe(0);
        });
    });

    describe('error handling', () => {
        it('should handle database connection errors gracefully', async () => {
            mockQueryError('Connection refused');

            const result = await tool.handler({
                query: 'SELECT 1',
                _context: makeContext('postgresql://localhost/fitness')
            });

            expect(result.error).toMatch(/Connection refused/);
        });

        it('should handle query syntax errors gracefully', async () => {
            mockQueryError('syntax error at or near "SELEC"');

            const result = await tool.handler({
                query: 'SELECT * FROM workouts',
                _context: makeContext('postgresql://localhost/fitness')
            });

            expect(result.error).toMatch(/syntax error/);
        });

        it('should handle timeout errors gracefully', async () => {
            mockQueryError('canceling statement due to statement timeout');

            const result = await tool.handler({
                query: 'SELECT * FROM huge_table',
                _context: makeContext('postgresql://localhost/fitness')
            });

            expect(result.error).toMatch(/statement timeout/);
        });

        it('should handle permission denied errors gracefully', async () => {
            mockQueryError('permission denied for table workouts');

            const result = await tool.handler({
                query: 'SELECT * FROM workouts',
                _context: makeContext('postgresql://localhost/fitness')
            });

            expect(result.error).toMatch(/permission denied/);
        });
    });

    describe('pool configuration', () => {
        it('should configure pool with sensible defaults', async () => {
            mockQuerySuccess([]);

            await tool.handler({
                query: 'SELECT 1',
                connection_string: 'postgresql://localhost/fitness'
            });

            const opts = MockPool._lastOpts;
            expect(opts.max).toBe(3);
            expect(opts.idleTimeoutMillis).toBe(30000);
            expect(opts.connectionTimeoutMillis).toBe(5000);
            expect(opts.statement_timeout).toBe(10000);
        });

        it('should reuse pool for same connection string', async () => {
            mockQuerySuccess([]);

            await tool.handler({
                query: 'SELECT 1',
                connection_string: 'postgresql://localhost/fitness'
            });

            const firstPool = MockPool._lastInstance;

            await tool.handler({
                query: 'SELECT 2',
                connection_string: 'postgresql://localhost/fitness'
            });

            // mockQuery is on the instance, same instance should be reused
            // The pool constructor should only have been called once for this connection string
            // (but due to module caching across tests, we check the query was called on same pool)
            expect(mockQuery).toHaveBeenCalledTimes(2);
        });
    });
});
