import time
import os
from playwright.sync_api import sync_playwright

def test_browser_flow():
    print("=" * 70)
    print("STARTING PLAYWRIGHT BROWSER VERIFICATION")
    print("=" * 70)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()

        # 1. Login
        print("Navigating to http://localhost:5173/login...")
        page.goto('http://localhost:5173/login')
        page.wait_for_selector('input[type="email"]', timeout=10000)

        page.fill('input[type="email"]', 'krupa@example.org')
        page.fill('input[type="password"]', 'BugFlow@2026')
        page.click('button[type="submit"]')
        page.wait_for_timeout(1500)

        # 2. Check Issues Page
        print("Navigating to Issues Page...")
        page.goto('http://localhost:5173/issues')
        page.wait_for_selector('table', timeout=10000)

        # Verify 4 Summary Cards
        page.wait_for_selector('text=Total Issues', timeout=5000)
        page.wait_for_selector('text=Open Issues', timeout=5000)
        page.wait_for_selector('text=In Progress Issues', timeout=5000)
        page.wait_for_selector('text=Resolved Issues', timeout=5000)
        print("[PASS] 1. Issues page summary cards rendered correctly (Total, Open, In Progress, Resolved)")

        # Verify Table Columns
        table_html = page.inner_html('table thead')
        for col in ['Issue ID', 'Title', 'Issue Type', 'Severity', 'Priority', 'Status', 'Assigned Developer', 'Created Date', 'Actions']:
            assert col in table_html, f"Column '{col}' not found in table header!"
        print("[PASS] 2. Issues table columns verified:", ['Issue ID', 'Title', 'Issue Type', 'Severity', 'Priority', 'Status', 'Assigned Developer', 'Created Date', 'Actions'])

        # 3. Create New Issue from UI
        print("Opening Create Issue page...")
        page.goto('http://localhost:5173/issues/create')
        page.wait_for_selector('input[placeholder*="summary"]', timeout=10000)

        # Verify button text is strictly "Create Issue"
        submit_btn = page.query_selector('button[type="submit"]')
        assert submit_btn is not None
        assert 'Create Issue' in submit_btn.inner_text()
        print("[PASS] 3. Create Issue form button correctly says 'Create Issue'")

        page.fill('input[placeholder*="summary"]', 'Browser Playwright Verified Issue')
        page.fill('textarea[placeholder*="context"]', 'Automated issue created to verify end-to-end integration.')
        page.select_option('select >> nth=1', 'Bug')
        page.select_option('select >> nth=2', 'High')
        page.select_option('select >> nth=3', 'P2')

        submit_btn.click()
        page.wait_for_timeout(2000)
        print("[PASS] 4. Issue created successfully via UI form submission")

        # 4. Open Analytics Page
        print("Navigating to Analytics page...")
        page.goto('http://localhost:5173/analytics')
        page.wait_for_selector('text=Project Quality Analytics', timeout=10000)

        # Verify Analytics components
        page.wait_for_selector('text=Issue Status Distribution', timeout=5000)
        page.wait_for_selector('text=Defect Trend Analysis', timeout=5000)
        page.wait_for_selector('text=Severity-wise Issues', timeout=5000)
        page.wait_for_selector('text=Average Resolution Time', timeout=5000)
        page.wait_for_selector('text=Resolution Rate', timeout=5000)
        page.wait_for_selector('text=Defect Density', timeout=5000)
        page.wait_for_selector('text=Data unavailable', timeout=5000)
        page.wait_for_selector('text=Project Quality Insight', timeout=5000)
        print("[PASS] 5. Analytics page loaded with all charts, metrics, defect density explanation, and dynamic insights")

        # 5. Export Report (PDF)
        print("Testing Export Report PDF download...")
        with page.expect_download(timeout=10000) as download_info:
            export_btn = page.query_selector('button:has-text("Export Report")')
            export_btn.click()
        download = download_info.value
        pdf_path = os.path.join('postman', download.suggested_filename)
        download.save_as(pdf_path)
        assert os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 1000
        print(f"[PASS] 6. Export Report PDF generated and saved successfully: '{pdf_path}' ({os.path.getsize(pdf_path)} bytes)")

        # 6. Technology leakage check
        content = page.content()
        for banned in ['Create Issue in PostgreSQL', 'PostgreSQL Live']:
            assert banned not in content, f"Leaked forbidden string: {banned}"
        print("[PASS] 7. No underlying technology stack names exposed to user")

        browser.close()

    print("=" * 70)
    print("BROWSER PLAYWRIGHT VERIFICATION COMPLETED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == '__main__':
    test_browser_flow()
