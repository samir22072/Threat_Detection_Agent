import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    # Use the DATABASE_URL provided in the .env.
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable is not set")
    
    conn = psycopg2.connect(db_url)
    return conn

# --- Session Operations ---

def ensure_session_exists(session_id: str):
    """Creates a session if it doesn't exist."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT id FROM sessions WHERE id = %s", (session_id,))
    if not cur.fetchone():
        # Session names are usually derived from the start of the UUID
        name = f"Session {session_id.split('-')[0]}"
        cur.execute(
            "INSERT INTO sessions (id, name) VALUES (%s, %s)",
            (session_id, name)
        )
        conn.commit()
    
    cur.close()
    conn.close()

def get_all_sessions():
    """Returns all sessions ordered by updated_at descending."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT id, name, updated_at as timestamp 
        FROM sessions 
        ORDER BY updated_at DESC
    """)
    rows = cur.fetchall()
    
    cur.close()
    conn.close()
    
    # Format the timestamp to ISO format string for JSON serialization
    for row in rows:
        if row['timestamp']:
            row['timestamp'] = row['timestamp'].isoformat()
            
    return rows

def get_agents_config(session_id: str):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT agents_config FROM sessions WHERE id = %s", (session_id,))
    row = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if row and row['agents_config']:
        return row['agents_config']
    return {}

def update_agents_config(session_id: str, config: dict):
    ensure_session_exists(session_id)
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        UPDATE sessions 
        SET agents_config = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """, (json.dumps(config), session_id))
    
    conn.commit()
    cur.close()
    conn.close()

def get_scan_report(session_id: str):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT scan_report FROM sessions WHERE id = %s", (session_id,))
    row = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if row and row['scan_report']:
        return row['scan_report']
    return {}

def update_scan_report(session_id: str, report: dict):
    ensure_session_exists(session_id)
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        UPDATE sessions 
        SET scan_report = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """, (json.dumps(report), session_id))
    
    conn.commit()
    cur.close()
    conn.close()

# --- Thought Trace Operations ---

def insert_thought_trace(session_id: str, trace_data: dict):
    ensure_session_exists(session_id)
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # If a timestamp string was provided, parse or pass as is; otherwise DB handles default
    ts = trace_data.get('timestamp')
    if not ts:
        ts = datetime.now().isoformat()
        
    cur.execute("""
        INSERT INTO thought_traces 
        (session_id, agent_name, thought, action, tool_input, timestamp)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        session_id,
        trace_data.get('agent', ''),
        trace_data.get('thought', ''),
        trace_data.get('action', ''),
        trace_data.get('tool_input', ''),
        ts
    ))
    
    # Update session updated_at time when a thought happens
    cur.execute("""
        UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = %s
    """, (session_id,))
    
    conn.commit()
    cur.close()
    conn.close()

def get_thought_traces(session_id: str):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT agent_name as agent, thought, action, tool_input, timestamp 
        FROM thought_traces 
        WHERE session_id = %s
        ORDER BY id ASC
    """, (session_id,))
    
    rows = cur.fetchall()
    
    cur.close()
    conn.close()
    
    # Format timestamps
    for row in rows:
        if row['timestamp']:
            row['timestamp'] = row['timestamp'].isoformat()
            
    return rows
