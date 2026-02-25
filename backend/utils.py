import os
import requests
import msal
from typing import List

def send_o365_email(report: dict, emails: List[str]) -> dict:
    client_id = os.getenv("CLIENT_ID")
    client_secret = os.getenv("CLIENT_SECRET")
    tenant_id = os.getenv("TENANT_ID")
    outlook_email = os.getenv("OUTLOOK_EMAIL")

    if not all([client_id, client_secret, tenant_id, outlook_email]):
        raise Exception("O365 credentials are not fully configured on the server.")

    # Build HTML content
    summary = report.get('summary', {})
    incidents = report.get('incidents', [])
    exec_summary = report.get('executiveSummary', {})

    html_content = f"""
    <html>
        <head>
            <style>
                body {{ font-family: sans-serif; color: #19314B; line-height: 1.6; }}
                h1, h2, h3 {{ color: #19314B; }}
                .container {{ max-w: 800px; margin: 0 auto; padding: 20px; }}
                .card {{ border: 1px solid #e5e7eb; padding: 15px; margin-bottom: 20px; background-color: #f9fafb; }}
                .critical {{ color: #dc2626; font-weight: bold; }}
                .high {{ color: #ea580c; font-weight: bold; }}
                .medium {{ color: #D2B589; font-weight: bold; }}
                .low {{ color: #0E6246; font-weight: bold; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Threat Intelligence Report</h1>
                
                <div class="card">
                    <h2>Executive Summary</h2>
                    <p><strong>Overall Risk Level:</strong> <span class="{exec_summary.get('overallRiskLevel', '').lower()}">{exec_summary.get('overallRiskLevel', 'UNKNOWN')}</span></p>
                    <p>{exec_summary.get('businessImpact', '')}</p>
                </div>

                <div class="card">
                    <h2>Statistics</h2>
                    <ul>
                        <li>Total Incidents: {summary.get('totalIncidents', 0)}</li>
                        <li>Critical: {summary.get('criticalCount', 0)}</li>
                        <li>High: {summary.get('highCount', 0)}</li>
                        <li>Medium: {summary.get('mediumCount', 0)}</li>
                    </ul>
                </div>

                <h2>Identified Incidents ({len(incidents)})</h2>
    """

    for inc in incidents:
        severity_class = str(inc.get('severity', '')).lower()
        html_content += f"""
                <div class="card">
                    <h3>{inc.get('incident', 'Unknown Incident')}</h3>
                    <p><strong>Severity:</strong> <span class="{severity_class}">{inc.get('severity', 'UNKNOWN')}</span></p>
                    <p><strong>Date:</strong> {inc.get('incidentDate', 'N/A')}</p>
                    <p><strong>Impact:</strong> {inc.get('impactAnalysis', '')}</p>
                    <h4>Recommended Actions</h4>
                    <ul>
        """
        for action in inc.get('recommendedActions', []):
            html_content += f"<li>{action}</li>"
            
        html_content += """
                    </ul>
                </div>
        """

    html_content += """
            </div>
        </body>
    </html>
    """

    # O365 Graph API Integration via MSAL
    authority = f"https://login.microsoftonline.com/{tenant_id}"
    msal_app = msal.ConfidentialClientApplication(
        client_id,
        authority=authority,
        client_credential=client_secret,
    )

    result = msal_app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])

    if "access_token" in result:
        endpoint = f"https://graph.microsoft.com/v1.0/users/{outlook_email}/sendMail"
        
        email_msg = {
            "message": {
                "subject": f"Action Required: Threat Intelligence Report [{exec_summary.get('overallRiskLevel', '')}]",
                "body": {
                    "contentType": "HTML",
                    "content": html_content
                },
                "toRecipients": [
                    {"emailAddress": {"address": email}} for email in emails
                ]
            },
            "saveToSentItems": "true"
        }

        headers = {
            "Authorization": f"Bearer {result['access_token']}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(endpoint, headers=headers, json=email_msg)
        
        if response.status_code == 202:
            return {"status": "success", "message": f"Report emailed to {len(emails)} recipients via O365."}
        else:
            raise Exception(f"Failed to send email via Microsoft Graph API. {response.status_code} - {response.text}")
    else:
        raise Exception(f"Failed to acquire O365 access token. {result.get('error')} - {result.get('error_description')}")
