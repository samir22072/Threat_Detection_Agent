from dataaccesslayer import get_db_connection

def init_db():
    """Initializes the required tables if they don't exist."""
    print("[DB] Initializing database tables...")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Sessions table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                agents_config JSONB DEFAULT '{}'::jsonb,
                scan_report JSONB
            )
        """)
        
        # Thought Traces table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS thought_traces (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) REFERENCES sessions(id) ON DELETE CASCADE,
                agent_name VARCHAR(255),
                thought TEXT,
                action VARCHAR(255),
                tool_input TEXT,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Add index for faster queries on traces
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_thought_traces_session_id 
            ON thought_traces(session_id)
        """)

        # Ignored Sources table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ignored_sources (
                id SERIAL PRIMARY KEY,
                url TEXT UNIQUE NOT NULL,
                added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                incident_summary TEXT
            )
        """)
        
        # Add incident_summary column if it doesn't exist (migration for existing table)
        try:
            cur.execute("""
                ALTER TABLE ignored_sources
                ADD COLUMN incident_summary TEXT;
            """)
        except Exception as e:
            # Column likely already exists
            conn.rollback() # Rollback the failed ALTER TABLE transaction
            cur = conn.cursor() # Get a new cursor for the commit
        
        conn.commit()
        cur.close()
        conn.close()
        print("[DB] Database initialization complete.")
    except Exception as e:
        print(f"[DB] Error initializing database: {e}")

if __name__ == "__main__":
    init_db()
