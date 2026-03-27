import pg from 'pg';

const { Pool } = pg;

interface PostgresQueryArgs {
    query: string;
    params?: any[];
    connection_string?: string;
    _context?: any;
}

// Read-only SQL validation: reject anything that isn't a SELECT or WITH...SELECT
const FORBIDDEN_PATTERNS = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|EXEC|CALL)\b/i;
const ALLOWED_PATTERNS = /^\s*(SELECT|WITH)\b/i;

function validateReadOnly(query: string): void {
    const trimmed = query.trim();
    if (FORBIDDEN_PATTERNS.test(trimmed)) {
        throw new Error('Write operations are not permitted. This tool is read-only (SELECT queries only).');
    }
    if (!ALLOWED_PATTERNS.test(trimmed)) {
        throw new Error('Only SELECT and WITH (CTE) queries are permitted.');
    }
}

// Pool cache keyed by connection string
const pools = new Map<string, pg.Pool>();

function getPool(connectionString: string): pg.Pool {
    let pool = pools.get(connectionString);
    if (!pool) {
        pool = new Pool({
            connectionString,
            max: 3,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            statement_timeout: 10000
        });
        pools.set(connectionString, pool);
    }
    return pool;
}

export default {
    definition: {
        name: 'postgres_query',
        displayName: 'PostgreSQL Query',
        description: 'Execute read-only SQL queries against a PostgreSQL database. Only SELECT and WITH (CTE) queries are permitted.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The SQL SELECT query to execute. Only read-only queries are permitted.'
                },
                params: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional parameterised query values (e.g. ["2026-03-01"] for WHERE date >= $1).'
                },
                connection_string: {
                    type: 'string',
                    description: 'Optional override for the database connection string. If omitted, uses the agent or global config.'
                }
            },
            required: ['query']
        }
    },
    handler: async (args: PostgresQueryArgs) => {
        try {
            const { query, params, connection_string, _context } = args;

            validateReadOnly(query);

            // Resolve connection string: explicit arg > agent config > env var
            const connStr = connection_string
                || _context?.agentConfig?.tools?.postgres?.connectionString
                || process.env.POSTGRES_CONNECTION_STRING;

            if (!connStr) {
                return {
                    error: 'No PostgreSQL connection string configured. Set it in the agent config (tools.postgres.connectionString), pass it as connection_string, or set the POSTGRES_CONNECTION_STRING environment variable.'
                };
            }

            const pool = getPool(connStr);
            const result = await pool.query(query, params || []);

            return {
                rows: result.rows,
                rowCount: result.rowCount,
                fields: result.fields.map(f => ({ name: f.name, dataTypeID: f.dataTypeID }))
            };
        } catch (err: any) {
            return { error: err.message || 'PostgreSQL query error' };
        }
    }
};
