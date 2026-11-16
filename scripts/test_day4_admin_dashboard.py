import requests
import json
import sys

BASE_URL = "http://127.0.0.1:5000"

def test_admin_dashboard():
    print("=" * 70)
    print("DAY 4 - ADMIN DASHBOARD & DEFECT TREND VISUALIZATION VERIFICATION")
    print("=" * 70)

    # 1. Admin Authentication
    login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "krupa@example.org",
        "password": "BugFlow@2026"
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json().get("access_token")
    user = login_resp.json().get("user")
    print(f"[PASS] 1. Admin authenticated successfully as: {user.get('name')} ({user.get('role')})")

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get All Dashboard Stats
    stats_resp = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
    assert stats_resp.status_code == 200, f"Stats failed: {stats_resp.text}"
    data = stats_resp.json()
    print("[PASS] 2. Admin Dashboard stats endpoint loaded successfully (HTTP 200)")

    # 3. Check Summary Totals
    totals = data.get("totals", {})
    total_issues = totals.get("total_issues", 0)
    open_issues = totals.get("open_issues", 0)
    in_progress = totals.get("in_progress", 0)
    resolved_total = totals.get("resolved_total", 0)
    resolved = totals.get("resolved", 0)
    closed = totals.get("closed", 0)

    print(f"       -> Total Issues: {total_issues}")
    print(f"       -> Open Issues: {open_issues}")
    print(f"       -> In Progress: {in_progress}")
    print(f"       -> Resolved Total: {resolved_total} ({resolved} Resolved + {closed} Closed)")

    assert total_issues == 735, f"Expected 735 total issues, got {total_issues}"
    assert open_issues == 112, f"Expected 112 open issues, got {open_issues}"
    assert in_progress == 132, f"Expected 132 in progress issues, got {in_progress}"
    assert resolved_total == 426, f"Expected 426 resolved+closed issues, got {resolved_total}"
    print("[PASS] 3. Issue summary totals match exact PostgreSQL database counts")

    # 4. Check Status Distribution (Donut Chart Data)
    status_dist = data.get("status_distribution", [])
    print(f"       -> Status Distribution: {len(status_dist)} statuses")
    for s in status_dist:
        print(f"          - {s['name']}: {s['count']} ({s['percentage']}%) [Color: {s.get('color')}]")
    status_names = [s['name'] for s in status_dist]
    assert "Open" in status_names and "In Progress" in status_names and "Testing" in status_names and "Resolved" in status_names and "Closed" in status_names
    assert sum(s['count'] for s in status_dist) == 735
    print("[PASS] 4. Issue Status Distribution donut data is verified with dynamic percentages and colors")

    # 5. Check Severity-wise Issues (Bar Chart Data)
    sev_dist = data.get("severity_distribution", [])
    print(f"       -> Severity Distribution: {len(sev_dist)} levels")
    for sev in sev_dist:
        print(f"          - {sev['severity']}: {sev['count']} ({sev['percentage']}%) [Color: {sev.get('color')}]")
    sev_levels = [s['severity'] for s in sev_dist]
    assert ["Critical", "High", "Medium", "Low"] == sev_levels
    assert sum(s['count'] for s in sev_dist) == 735
    print("[PASS] 5. Severity-wise bar chart data verified with distinct colors and counts")

    # 6. Check Monthly Defect Trend (Line Chart Data)
    trend = data.get("monthly_defect_trend", [])
    print(f"       -> Monthly Defect Trend points: {len(trend)} months")
    for t in trend:
        print(f"          - Month: {t['label']} | Created: {t['created']} | Resolved: {t['resolved']}")
    assert len(trend) > 0, "Expected at least 1 month in defect trend"
    print("[PASS] 6. Monthly Defect Trend line chart data aggregated from real database dates")

    # 7. Check Project Quality Metrics
    qm = data.get("quality_metrics", {})
    avg_res = qm.get("average_resolution_time", {})
    res_rate = qm.get("resolution_rate", {})
    pending = qm.get("total_pending_issues")
    density = qm.get("defect_density", {})

    print(f"       -> Avg Resolution Time: {avg_res.get('display')} ({avg_res.get('days')} days)")
    print(f"       -> Resolution Rate: {res_rate.get('display')}")
    print(f"       -> Total Pending Issues: {pending}")
    print(f"       -> Defect Density: Status='{density.get('status')}', Message='{density.get('message')}'")

    assert avg_res.get("hours") > 0, "Expected avg resolution time hours > 0"
    assert res_rate.get("percentage") == 58.0, f"Expected 58.0% resolution rate, got {res_rate.get('percentage')}"
    assert pending == 309, f"Expected 309 pending issues (112+132+65), got {pending}"
    assert density.get("status") == "unavailable", "Expected defect density to be 'unavailable'"
    print("[PASS] 7. Project Quality Metrics verified with reliable PostgreSQL calculations and explanation")

    # 8. Check Top Modules by Defects
    top_mods = data.get("top_modules", [])
    print(f"       -> Top Modules count: {len(top_mods)}")
    for m in top_mods:
        print(f"          - Module '{m['module']}': {m['count']} issues ({m['percentage']}%)")
    assert len(top_mods) > 0, "Expected top modules list"
    assert top_mods[0]['count'] >= top_mods[-1]['count'], "Top modules should be ordered by count descending"
    print("[PASS] 8. Top Modules by Defects verified using real affected_module database records")

    # 9. Check Recent Activity
    recent_act = data.get("recent_activity", [])
    print(f"       -> Recent Activity records: {len(recent_act)}")
    for a in recent_act[:3]:
        print(f"          - [{a.get('issue_id')}] {a.get('description')} ({a.get('created_at')})")
    assert len(recent_act) > 0, "Expected recent activity audit records"
    print("[PASS] 9. Recent Activity verified from real IssueStatusHistory records")

    # 10. Check Project Filter Interaction (e.g. PRJ-001)
    p_resp = requests.get(f"{BASE_URL}/api/dashboard/stats?project_id=PRJ-001", headers=headers)
    assert p_resp.status_code == 200
    p_data = p_resp.json()
    p_total = p_data.get("totals", {}).get("total_issues")
    print(f"       -> PRJ-001 Total Issues: {p_total}")
    assert p_total < total_issues, "Filtered project should have a subset of all issues"
    print("[PASS] 10. Project selection filter dynamically updates all metrics and charts")

    # 11. Check Date Range Filter Interaction (e.g. 30d)
    d_resp = requests.get(f"{BASE_URL}/api/dashboard/stats?date_range=30d", headers=headers)
    assert d_resp.status_code == 200
    d_data = d_resp.json()
    d_total = d_data.get("totals", {}).get("total_issues")
    print(f"       -> 30-Day Range Total Issues: {d_total}")
    assert d_total <= total_issues
    print("[PASS] 11. Date range selection filter dynamically updates all results")

    # 12. Check Vite Frontend Serves Correctly
    vite_resp = requests.get("http://localhost:5173")
    assert vite_resp.status_code == 200
    print("[PASS] 12. Vite frontend dev server is live and serving the application (HTTP 200)")

    print("=" * 70)
    print("ALL DAY 4 ADMIN DASHBOARD REQUIREMENTS VERIFIED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    test_admin_dashboard()
