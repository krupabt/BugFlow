import sys
import os
import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:5000/api"

EXPECTED_COLORS = {
    "Open": "#E97862",
    "In Progress": "#D6A85E",
    "Testing": "#7A7098",
    "Resolved": "#6FAF9A",
    "Closed": "#A8B2BF"
}

def http_post(endpoint, data):
    url = f"{BASE_URL}{endpoint}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def http_get(endpoint, token):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"}, method="GET")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def test_doughnut_chart_all_roles():
    print("=" * 65)
    print("TESTING BUGFLOW DASHBOARD DOUGHNUT CHART & ROLE INTEGRATION")
    print("=" * 65)

    test_users = [
        ("Admin", "krupa@example.org", "BugFlow@2026", "Total Issues", 730),
        ("Project Manager", "Arun@example.org", "BugFlow@2026", "Total Issues", 289),
        ("Developer", "Priya.Sharma@example.org", "BugFlow@2026", "Assigned Issues", 12),
        ("Tester", "Sunil.clark@example.org", "BugFlow@2026", "Reported Issues", 144)
    ]

    for role_name, email, pwd, total_card_key, expected_total in test_users:
        print(f"\n--> 1. Testing {role_name} ({email}):")
        
        # 1. Login
        login_res = http_post("/auth/login", {"email": email, "password": pwd})
        token = login_res["access_token"]
        assert token, f"Login failed for {email}"
        print(f"  [PASS] Authenticated successfully. User ID: {login_res['user']['id']}")

        # 2. Get Dashboard Stats
        stats = http_get("/dashboard/stats", token)
        assert stats, "Failed to retrieve dashboard stats"

        # 3. Check Cards
        cards = {c["title"]: c["value"] for c in stats.get("cards", [])}
        print(f"  [PASS] Dashboard Cards: {cards}")
        assert total_card_key in cards, f"Expected '{total_card_key}' card in {cards}"
        card_total = cards[total_card_key]

        # 4. Check Status Distribution
        status_dist = stats.get("status_distribution", [])
        assert len(status_dist) == 5, f"Expected 5 statuses, got {len(status_dist)}"

        status_names = [item["name"] for item in status_dist]
        expected_names = ["Open", "In Progress", "Testing", "Resolved", "Closed"]
        assert status_names == expected_names, f"Expected statuses {expected_names}, got {status_names}"

        sum_counts = sum(item["count"] for item in status_dist)
        status_total = stats.get("status_total")

        print(f"  [PASS] Doughnut Chart Breakdown (PostgreSQL live):")
        for item in status_dist:
            print(f"         * {item['name']}: {item['count']} ({item['percentage']}%) [Theme Color: {EXPECTED_COLORS[item['name']]}]")

        print(f"  [PASS] Sum of Segments = {sum_counts}")
        print(f"  [PASS] Status Total = {status_total}")
        print(f"  [PASS] Dashboard '{total_card_key}' Card = {card_total}")

        # 5. Strict equality check: sum of segments == status_total == card_total
        assert sum_counts == status_total, f"Segment sum {sum_counts} != status_total {status_total}"
        assert sum_counts == card_total, f"Segment sum {sum_counts} != card total {card_total}"
        assert sum_counts == expected_total, f"Expected {expected_total}, got {sum_counts}"
        print(f"  [VERIFIED] Doughnut chart matches PostgreSQL and '{total_card_key}' card ({expected_total}) with 100% accuracy!")

    print("\n" + "=" * 65)
    print("ALL 4 ROLES VERIFIED SUCCESSFULLY: DOUGHNUT CHART PERFECTLY INTEGRATED!")
    print("=" * 65)

if __name__ == "__main__":
    test_doughnut_chart_all_roles()
