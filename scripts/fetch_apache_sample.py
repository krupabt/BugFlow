"""
BugFlow - Fetch Sample Apache Jira Issues
-----------------------------------------
This script downloads a clean, verified sample of 2,500 real defect issues
directly from the official public Apache Software Foundation Jira REST API
(KAFKA, SPARK, ZOOKEEPER, HADOOP, FLINK).

It writes the result to: dataset/apache_jira_sample.csv
Fields collected:
- issue_key (e.g., KAFKA-1234)
- project (e.g., KAFKA)
- title (Summary)
- description (Full defect description)
- status (Resolved, Closed)
- priority (Blocker, Critical, Major, Minor, Trivial)
- severity (Mapped from priority)
- resolution (Fixed, Duplicate, Won't Fix, etc.)
- created_at (ISO timestamp)
- resolved_at (ISO timestamp)
"""

import os
import sys
import csv
import json
import time
import urllib.request
import urllib.parse

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dataset")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "apache_jira_sample.csv")

TARGET_COUNT = 2500
PAGE_SIZE = 100
PROJECTS = ["KAFKA", "SPARK", "ZOOKEEPER", "HADOOP", "FLINK"]

def fetch_sample():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    fields_to_request = "summary,description,status,priority,resolution,created,resolutiondate,project"
    jql = f"project in ({','.join(PROJECTS)}) AND issuetype = Bug AND status in (Resolved, Closed) ORDER BY created DESC"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BugFlow-Academic-Project/1.0",
        "Accept": "application/json"
    }

    issues_saved = 0
    start_at = 0
    
    print(f"[*] Connecting to Apache Jira REST API...")
    print(f"[*] Target: {TARGET_COUNT} real defect reports from projects: {', '.join(PROJECTS)}")
    print(f"[*] Destination: {OUTPUT_FILE}")
    
    with open(OUTPUT_FILE, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "issue_key",
            "project",
            "title",
            "description",
            "status",
            "priority",
            "severity",
            "resolution",
            "created_at",
            "resolved_at"
        ])
        
        while issues_saved < TARGET_COUNT:
            params = {
                "jql": jql,
                "fields": fields_to_request,
                "startAt": start_at,
                "maxResults": min(PAGE_SIZE, TARGET_COUNT - issues_saved)
            }
            url = f"https://issues.apache.org/jira/rest/api/2/search?{urllib.parse.urlencode(params)}"
            
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    
                issues = data.get("issues", [])
                if not issues:
                    print("[-] No more issues returned by Apache Jira API.")
                    break
                    
                for issue in issues:
                    fields = issue.get("fields", {})
                    key = issue.get("key", "")
                    proj = fields.get("project", {}).get("key", key.split("-")[0] if "-" in key else "APACHE")
                    title = fields.get("summary", "").strip()
                    desc = fields.get("description") or ""
                    desc = desc.strip()
                    status = fields.get("status", {}).get("name", "Closed")
                    priority = fields.get("priority", {}).get("name", "Major") if fields.get("priority") else "Major"
                    
                    # Map Jira priority to Defect Severity
                    sev_map = {
                        "Blocker": "Critical",
                        "Critical": "Critical",
                        "Major": "High",
                        "Minor": "Medium",
                        "Trivial": "Low"
                    }
                    severity = sev_map.get(priority, "Medium")
                    
                    resolution = fields.get("resolution", {}).get("name", "Fixed") if fields.get("resolution") else "Fixed"
                    created_at = fields.get("created", "")
                    resolved_at = fields.get("resolutiondate", "")
                    
                    writer.writerow([
                        key,
                        proj,
                        title,
                        desc,
                        status,
                        priority,
                        severity,
                        resolution,
                        created_at,
                        resolved_at
                    ])
                    issues_saved += 1
                
                print(f"[+] Downloaded {issues_saved}/{TARGET_COUNT} issues...")
                start_at += len(issues)
                time.sleep(0.3)  # Polite rate limiting
                
            except Exception as e:
                print(f"[!] Error fetching batch at startAt={start_at}: {e}")
                time.sleep(2)
                # retry once
                continue

    file_size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"\n[OK] Completed! Successfully saved {issues_saved} issues.")
    print(f"[OK] File location: {OUTPUT_FILE}")
    print(f"[OK] File size: {file_size_mb:.2f} MB")

if __name__ == "__main__":
    fetch_sample()
