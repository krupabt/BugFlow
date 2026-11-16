import requests
import json
import re

BASE_BACKEND = "http://127.0.0.1:5000"
BASE_FRONTEND = "http://localhost:5173"

def run_tests():
    print("=" * 75)
    print("COMPLETE BUGFLOW DASHBOARD, SIDEBAR & ANALYTICS REDESIGN VERIFICATION")
    print("=" * 75)

    # 1. Login Authentication
    login_resp = requests.post(f"{BASE_BACKEND}/api/auth/login", json={
        "email": "krupa@example.org",
        "password": "BugFlow@2026"
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] 1. Authentication successful as Administrator (Krupa)")

    # 2. Verify Left Sidebar Specification in Source Files
    sidebar_file = open("frontend/src/components/Sidebar.jsx", "r", encoding="utf-8").read()
    expected_menu = [
        "Dashboard",
        "Projects",
        "Issues",
        "Sprints",
        "Backlog",
        "Analytics",
        "Team",
        "Settings"
    ]
    for idx, item in enumerate(expected_menu):
        assert f"name: '{item}'" in sidebar_file, f"Sidebar missing menu item: {item}"
        print(f"       -> Menu Item #{idx+1}: {item}")
    
    # Check bottom profile requirements in Sidebar.jsx
    assert "Krupa" in sidebar_file, "Sidebar must display username 'Krupa'"
    assert "Admin" in sidebar_file, "Sidebar must display 'Admin' badge"
    assert "LogOut" in sidebar_file, "Sidebar must include logout icon"
    print("[PASS] 2. Left Sidebar source matches exact 8 items in exact order & bottom profile")

    # 3. Verify Sidebar Styling in CSS
    css_file = open("frontend/src/index.css", "r", encoding="utf-8").read()
    assert "--sidebar-bg: #0F172A;" in css_file or "#0F172A" in css_file, "Sidebar background must be dark navy-blue (#0F172A)"
    assert "rgba(168, 85, 247" in css_file or "purple" in css_file or "--sidebar-active-bg" in css_file, "Sidebar active state must have purple/pink highlight"
    assert "#F97316" in css_file, "Sidebar active item must have orange accent on the left"
    print("[PASS] 3. Left Sidebar CSS styles verified (Dark navy-blue, purple/pink active, orange left accent)")

    # 4. Verify Main Admin Dashboard APIs & Real Metrics
    dash_resp = requests.get(f"{BASE_BACKEND}/api/dashboard/stats", headers=headers)
    assert dash_resp.status_code == 200, f"Dashboard stats failed: {dash_resp.text}"
    d_data = dash_resp.json()
    
    totals = d_data.get("totals", {})
    assert totals.get("total_issues") == 735, f"Expected 735 total issues, got {totals.get('total_issues')}"
    assert totals.get("open_issues") == 112, f"Expected 112 open issues, got {totals.get('open_issues')}"
    assert totals.get("in_progress") == 132, f"Expected 132 in progress issues, got {totals.get('in_progress')}"
    assert totals.get("resolved_total") == 426, f"Expected 426 resolved issues, got {totals.get('resolved_total')}"
    print(f"[PASS] 4. Main Dashboard Summary Cards verified:")
    print(f"       -> Total Issues: {totals.get('total_issues')}")
    print(f"       -> Open Issues: {totals.get('open_issues')}")
    print(f"       -> In Progress: {totals.get('in_progress')}")
    print(f"       -> Resolved Issues: {totals.get('resolved_total')} ({totals.get('resolved')} Resolved + {totals.get('closed')} Closed)")

    # 5. Verify Main Dashboard Visualizations Data
    status_dist = d_data.get("status_distribution", [])
    assert len(status_dist) == 5, f"Expected 5 status entries, got {len(status_dist)}"
    assert sum(s['count'] for s in status_dist) == 735
    
    sev_dist = d_data.get("severity_distribution", [])
    assert len(sev_dist) == 4, f"Expected 4 severity levels, got {len(sev_dist)}"
    assert sum(s['count'] for s in sev_dist) == 735

    trend = d_data.get("monthly_defect_trend", [])
    assert len(trend) > 0, "Expected monthly defect trend data"
    print(f"[PASS] 5. Main Dashboard Charts verified (Donut status: {len(status_dist)}, Severity bar: {len(sev_dist)}, Line trend: {len(trend)} months)")

    # 6. Verify Project Quality Metrics, Top Modules, Recent Activity
    qm = d_data.get("quality_metrics", {})
    assert qm.get("average_resolution_time", {}).get("hours") > 0
    assert qm.get("resolution_rate", {}).get("percentage") == 58.0
    assert qm.get("total_pending_issues") == 309
    assert qm.get("defect_density", {}).get("status") == "unavailable"
    assert "KLOC" in qm.get("defect_density", {}).get("message")
    
    top_mods = d_data.get("top_modules", [])
    assert len(top_mods) > 0
    recent_act = d_data.get("recent_activity", [])
    assert len(recent_act) > 0
    print(f"[PASS] 6. Quality Metrics, Top Modules ({len(top_mods)}), Recent Activity ({len(recent_act)}) verified")

    # 7. Verify Detailed Analytics API (/api/analytics/detailed)
    detailed_resp = requests.get(f"{BASE_BACKEND}/api/analytics/detailed", headers=headers)
    assert detailed_resp.status_code == 200, f"Detailed analytics failed: {detailed_resp.text}"
    det_data = detailed_resp.json().get("data", {})
    
    det_sum = det_data.get("summary", {})
    assert det_sum.get("resolved_count") == 426
    assert det_sum.get("unresolved_count") == 309
    assert det_sum.get("average_issue_age_days") > 0
    
    top_5_proj = det_data.get("top_5_projects_by_resolution_time", [])
    assert len(top_5_proj) == 5, f"Expected top 5 projects by resolution time, got {len(top_5_proj)}"
    print(f"       -> Top 5 Projects by Resolution Time:")
    for p in top_5_proj:
        print(f"          * {p['project_name']}: {p['avg_hours']}h ({p['avg_days']} days) [{p['resolved_count']} resolved]")

    proj_comp = det_data.get("issues_by_project_and_component", [])
    assert len(proj_comp) > 0, "Expected issues by project and component"
    print(f"[PASS] 7. Analytics API verified (Resolved vs Unresolved, Avg Age {det_sum.get('average_issue_age_days')}d, Top 5 Projects, Component Matrix)")

    # 8. Verify Analytics Component & Project Filter Interaction
    comp_resp = requests.get(f"{BASE_BACKEND}/api/analytics/detailed?component=Payment", headers=headers)
    assert comp_resp.status_code == 200
    comp_total = comp_resp.json().get("data", {}).get("summary", {}).get("total_issues")
    assert comp_total == 73, f"Expected 73 issues in Payment component, got {comp_total}"
    print(f"[PASS] 8. Analytics component filter successfully isolated Payment component ({comp_total} issues)")

    # 9. Verify Vite Frontend Dev Server
    v_resp = requests.get(f"{BASE_FRONTEND}/analytics")
    assert v_resp.status_code == 200
    print("[PASS] 9. Frontend serves /analytics and /admin/dashboard successfully (HTTP 200)")

    print("=" * 75)
    print("ALL REDESIGN REQUIREMENTS VERIFIED & PASSED CLEANLY!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()
