import os
import json
import asyncio
from datetime import datetime
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from agents.crew_analysis import run_crew
from agents.config_generator import generate_agents_config

# Import database layer
from db import (
    get_all_sessions,
    get_agents_config as db_get_agents_config,
    update_agents_config as db_update_agents_config,
    get_scan_report as db_get_scan_report,
    update_scan_report as db_update_scan_report,
    insert_thought_trace,
    get_thought_traces as db_get_thought_traces,
    ensure_session_exists
)

# Initialize database tables
# You can run `python db.py` manually to initialize tables instead of doing it on every startup.

app = FastAPI(title="Threat Detection Agent System")

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Calculate absolute path to base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        # Maps session_id -> list of WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast_to_session(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"WS Send Error for session {session_id}: {e}")

manager = ConnectionManager()

class ScanRequest(BaseModel):
    asset: str
    attributes: Dict[str, str] = {}
    scanDate: str = datetime.now().strftime("%Y-%m-%d")
    timeDuration: str = "last 60 days"
    sessionId: str = "default"

@app.websocket("/ws/scan/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)

@app.get("/api/sessions")
async def get_sessions():
    try:
        sessions = get_all_sessions()
        
        # Format the result to match the expected format
        formatted_sessions = []
        for s in sessions:
            if s['id'] == "default":
                continue
                
            formatted_sessions.append({
                "id": s["id"],
                "name": s["name"],
                "timestamp": s["timestamp"]
            })
            
        return {"sessions": formatted_sessions}
    except Exception as e:
        print(f"Error fetching sessions from DB: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/agents-config")
async def get_agents_config(sessionId: str = "default"):
    try:
        config = db_get_agents_config(sessionId)
        return config
    except Exception as e:
        print(f"Error fetching agents config from DB: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/scan-report")
async def get_scan_report(sessionId: str = "default"):
    try:
        report = db_get_scan_report(sessionId)
        return report
    except Exception as e:
        print(f"Error fetching scan report from DB: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/thought-trace")
async def get_thought_trace(sessionId: str = "default"):
    try:
        traces = db_get_thought_traces(sessionId)
        return traces
    except Exception as e:
        print(f"Error fetching thought traces from DB: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/agents-config")
async def save_agents_config(config: dict, sessionId: str = "default"):
    try:
        db_update_agents_config(sessionId, config)
        return {"status": "success"}
    except Exception as e:
        print(f"Error saving agents config to DB: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-agents")
async def generate_agents_api(request: ScanRequest):
    try:
        # Pre-create the session in DB
        ensure_session_exists(request.sessionId)
        
        asset_config = {
            "asset": request.asset,
            **request.attributes
        }
        
        # Run generator in a separate thread so it doesn't block FastAPI
        await asyncio.to_thread(generate_agents_config, json.dumps(asset_config), request.sessionId)
        
        # Fetch the newly generated config from DB
        new_config = db_get_agents_config(request.sessionId)
            
        return {"status": "success", "message": "Agents configured successfully.", "config": new_config}
    except Exception as e:
        print(f"Error generating agents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scan")
async def start_scan(request: ScanRequest):
    try:
        # Pre-create session just in case
        ensure_session_exists(request.sessionId)
        
        asset_config = request.attributes
        
        loop = asyncio.get_running_loop()

        def step_callback(step, agent_name="Agent"):
            # Capture agent thought/action for real-time trace
            thought = ""
            tool = ""
            tool_input = ""
            
            try:
                # Handle possible tuple structure from CrewAI
                if isinstance(step, tuple) and len(step) > 0:
                    action = step[0]
                else:
                    action = step
                
                if hasattr(action, 'tool'):
                    tool = getattr(action, 'tool', '')
                if hasattr(action, 'tool_input'):
                    tool_input = getattr(action, 'tool_input', '')
                if hasattr(action, 'log'):
                    thought = getattr(action, 'log', '')
                elif hasattr(action, 'text'):
                    thought = getattr(action, 'text', '')
                elif isinstance(action, str):
                    thought = action
                    
            except Exception as e:
                print(f"Error parsing step: {e}")

            msg = {
                "type": "thought",
                "agent": agent_name,
                "thought": str(thought) if thought else str(step)[:200],
                "action": str(tool) if tool else "",
                "tool_input": str(tool_input) if tool_input else "",
                "timestamp": datetime.now().isoformat()
            }
            
            # Persist trace to DB
            try:
                insert_thought_trace(request.sessionId, msg)
            except Exception as e:
                print(f"Error saving thought trace to DB: {e}")
                
            # Send to all connected WebSocket clients for this session
            asyncio.run_coroutine_threadsafe(manager.broadcast_to_session(request.sessionId, msg), loop)

        # Run CrewAI in a separate thread to avoid blocking the FastAPI event loop
        result = await asyncio.to_thread(
            run_crew,
            request.asset,
            asset_config,
            request.scanDate,
            request.timeDuration,
            request.sessionId,
            step_callback=step_callback
        )
        
        # Parse output
        clean_result = str(result).strip()
        if clean_result.startswith("```json"):
            clean_result = clean_result.split("```json")[1].split("```")[0].strip()
        elif clean_result.startswith("```"):
            clean_result = clean_result.split("```")[1].split("```")[0].strip()
            
        try:
            final_report = json.loads(clean_result)
        except:
            final_report = {"raw_output": str(result)}
            
        # Save the report for session history in DB
        db_update_scan_report(request.sessionId, final_report)
            
        return final_report
        
    except Exception as e:
        print(f"Error in scan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def read_index():
    return {"message": "Threat Detection Backend active. Use the Next.js frontend on port 3000."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
