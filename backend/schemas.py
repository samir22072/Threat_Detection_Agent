from pydantic import BaseModel
from typing import Dict, List
from datetime import datetime

class ScanRequest(BaseModel):
    asset: str
    attributes: Dict[str, str] = {}
    scanDate: str = datetime.now().strftime("%Y-%m-%d")
    timeDuration: str = "last 60 days"
    sessionId: str = "default"

class EmailRequest(BaseModel):
    sessionId: str
    emails: List[str]
