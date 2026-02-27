import os
import requests
from crewai_tools import SerperDevTool

class DateSortedSearchTool(SerperDevTool):
    name: str = "DateSortedSearchTool"
    description: str = "Search the internet with results strictly sorted by date (newest first). Use this to find the most recent advisories and intelligence."
    time_bound: str = ""  # e.g., 'd' for day, 'w' for week, 'm' for month
    
    def _make_api_request(self, search_query: str, search_type: str) -> dict:
        search_url = self._get_search_url(search_type)
        
        # sbd:1 is Google's 'Sort by date' parameter. qdr is the time boundary.
        tbs_param = "sbd:1"
        if self.time_bound:
            tbs_param = f"qdr:{self.time_bound},sbd:1"
            
        payload = {"q": search_query, "num": self.n_results, "tbs": tbs_param}
        
        if self.country != "":
            payload["gl"] = self.country
        if self.location != "":
            payload["location"] = self.location
        if self.locale != "":
            payload["hl"] = self.locale

        headers = {
            "X-API-KEY": os.environ.get("SERPER_API_KEY", ""),
            "content-type": "application/json",
        }
        response = requests.post(search_url, headers=headers, json=payload, timeout=10)
        response.raise_for_status()
        return response.json()

class NewsSearchTool(SerperDevTool):
    name: str = "NewsSearchTool"
    description: str = "Search specifically through news articles sorted by date. Excellent for finding newly published zero-days, breaches, and vendor advisories."
    search_type: str = "news"
    time_bound: str = "" # e.g., 'd' for day, 'w' for week, 'm' for month
    
    def _make_api_request(self, search_query: str, search_type: str) -> dict:
        # Force the search type to news
        search_url = self._get_search_url("news")
        
        tbs_param = "sbd:1"
        if self.time_bound:
            tbs_param = f"qdr:{self.time_bound},sbd:1"
            
        payload = {"q": search_query, "num": self.n_results, "tbs": tbs_param}
        
        if self.country != "":
            payload["gl"] = self.country
        if self.location != "":
            payload["location"] = self.location
        if self.locale != "":
            payload["hl"] = self.locale

        headers = {
            "X-API-KEY": os.environ.get("SERPER_API_KEY", ""),
            "content-type": "application/json",
        }
        response = requests.post(search_url, headers=headers, json=payload, timeout=10)
        response.raise_for_status()
        return response.json()
