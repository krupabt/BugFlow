import os
import sys
import unittest

# Ensure backend in python path
sys.path.insert(0, os.path.abspath('backend'))

from app import create_app
from app.extensions import db
from app.models.issue import Issue
from app.models.user import User
from app.models.project import Project
from app.models.sprint import Sprint

class BugFlowComprehensiveVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_01_database_connection_and_counts(self):
        """Verifies database connection and synthetic dataset integrity."""
        with self.app.app_context():
            issue_count = Issue.query.count()
            synthetic_issues = Issue.query.filter(Issue.id.like('BUG-%')).count()
            user_count = User.query.count()
            synthetic_users = User.query.filter(User.id.like('USR-%')).count()
            project_count = Project.query.count()
            sprint_count = Sprint.query.count()

            print(f"\n[Test 1] DB Counts: Total Issues: {issue_count} (Synthetic: {synthetic_issues}) | Sprints: {sprint_count} | Projects: {project_count} | Users: {user_count} (Synthetic: {synthetic_users})")
            self.assertGreaterEqual(synthetic_issues, 730, "Must have at least 730 valid imported issues")
            self.assertGreaterEqual(project_count, 8, "Must have at least 8 projects")
            self.assertGreaterEqual(sprint_count, 48, "Must have at least 48 sprints")
            self.assertGreaterEqual(synthetic_users, 20, "Must have at least 20 synthetic users")

    def test_02_all_four_roles_login_and_dashboards(self):
        """Verifies login, token generation, and role-based dashboard cards for all 4 roles."""
        role_creds = [
            ('Admin', 'alex.morgan@example.org', ['Total Users', 'Total Projects', 'Total Issues', 'Open Issues']),
            ('Project Manager', 'jordan.lee@example.org', ['My Projects', 'Total Issues', 'Open Issues', 'In Progress']),
            ('Developer', 'riley.chen@example.org', ['Assigned Issues', 'In Progress', 'Resolved', 'Closed']),
            ('Tester', 'emerson.clark@example.org', ['Reported Issues', 'Testing', 'Resolved', 'Closed']),
        ]

        for role_name, email, expected_cards in role_creds:
            res = self.client.post('/api/auth/login', json={'email': email, 'password': 'BugFlow@2026'})
            self.assertEqual(res.status_code, 200, f"Login failed for {role_name} ({email})")
            token = res.json.get('access_token')
            user_obj = res.json.get('user', {})
            self.assertEqual(user_obj.get('role'), role_name)
            self.assertTrue(token)

            # Get role dashboard stats
            headers = {'Authorization': f'Bearer {token}'}
            dash_res = self.client.get('/api/dashboard/stats', headers=headers)
            self.assertEqual(dash_res.status_code, 200)
            cards = [c['title'] for c in dash_res.json.get('cards', [])]
            print(f"[Test 2] {role_name} Dashboard cards: {cards}")
            self.assertEqual(cards, expected_cards)

    def test_03_invalid_login_and_unauthorized_access(self):
        """Verifies rejection of invalid credentials and unauthorized routes."""
        # Wrong password
        res = self.client.post('/api/auth/login', json={'email': 'alex.morgan@example.org', 'password': 'wrongpassword'})
        self.assertEqual(res.status_code, 401)
        self.assertIn('Invalid', res.json.get('error', ''))

        # Public Admin Registration blocked
        res = self.client.post('/api/auth/register', json={
            'name': 'Hacker Admin',
            'email': 'hacker@example.org',
            'password': 'password123',
            'role': 'Admin'
        })
        self.assertEqual(res.status_code, 403)
        self.assertIn('Admin accounts cannot be registered publicly', res.json.get('error', ''))

        # Protected route without token rejected
        res = self.client.delete('/api/issues/BUG-00001')
        self.assertEqual(res.status_code, 401)

    def test_04_issue_crud_lifecycle(self):
        """Verifies issue creation, viewing, editing, assignment, status transitions, and deletion."""
        # Admin login
        adm_res = self.client.post('/api/auth/login', json={'email': 'alex.morgan@example.org', 'password': 'BugFlow@2026'})
        adm_token = adm_res.json['access_token']
        headers = {'Authorization': f'Bearer {adm_token}'}

        # 1. Create Issue
        create_payload = {
            'title': 'E2E Test Defect in Cart Processing',
            'description': 'Automated testing reproduction issue description.',
            'project_id': 'PRJ-001',
            'issue_type': 'Bug',
            'severity': 'High',
            'priority': 'P1',
            'component': 'Checkout',
            'environment': 'Staging'
        }
        res = self.client.post('/api/issues', json=create_payload, headers=headers)
        self.assertEqual(res.status_code, 201)
        created_issue = res.json.get('issue')
        issue_id = created_issue['id']
        self.assertTrue(issue_id.startswith('BUG-'))
        print(f"\n[Test 4] Created Issue: {issue_id}")

        # 2. View Issue
        res = self.client.get(f'/api/issues/{issue_id}', headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json['title'], 'E2E Test Defect in Cart Processing')

        # 3. Edit Issue
        res = self.client.put(f'/api/issues/{issue_id}', json={'title': 'Updated Cart Defect Title', 'severity': 'Critical'}, headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json['issue']['title'], 'Updated Cart Defect Title')
        self.assertEqual(res.json['issue']['severity'], 'Critical')

        # 4. Assign Issue
        res = self.client.patch(f'/api/issues/{issue_id}/assign', json={'assigned_to': 'USR-005'}, headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json['issue']['assigned_to'], 'USR-005')

        # 5. Developer Updates Status (In Progress -> Testing)
        dev_res = self.client.post('/api/auth/login', json={'email': 'riley.chen@example.org', 'password': 'BugFlow@2026'})
        dev_headers = {'Authorization': f"Bearer {dev_res.json['access_token']}"}
        
        # Open -> In Progress
        res = self.client.patch(f'/api/issues/{issue_id}/status', json={'status': 'In Progress', 'comment': 'Starting fix'}, headers=dev_headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json['issue']['status'], 'In Progress')

        # In Progress -> Testing
        res = self.client.patch(f'/api/issues/{issue_id}/status', json={'status': 'Testing', 'comment': 'Ready for QA verification'}, headers=dev_headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json['issue']['status'], 'Testing')

        # 6. Tester Reopens Issue (Testing -> In Progress)
        tester_res = self.client.post('/api/auth/login', json={'email': 'emerson.clark@example.org', 'password': 'BugFlow@2026'})
        tester_headers = {'Authorization': f"Bearer {tester_res.json['access_token']}"}
        res = self.client.patch(f'/api/issues/{issue_id}/status', json={'status': 'In Progress', 'comment': 'Edge case failed in QA'}, headers=tester_headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json['issue']['status'], 'In Progress')
        self.assertEqual(res.json['issue']['reopen_count'], 1)

        # 7. Add Comment
        res = self.client.post(f'/api/issues/{issue_id}/comments', json={'content': 'Investigating new logs for reopen.'}, headers=dev_headers)
        self.assertEqual(res.status_code, 201)

        # 8. Delete Issue
        res = self.client.delete(f'/api/issues/{issue_id}', headers=headers)
        self.assertEqual(res.status_code, 200)

        # Verify deletion
        res = self.client.get(f'/api/issues/{issue_id}', headers=headers)
        self.assertEqual(res.status_code, 404)
        print(f"[Test 4] Full issue lifecycle verified successfully for {issue_id}")

    def test_05_search_and_filtering(self):
        """Verifies text search, project filter, severity filter, priority filter, and sorting."""
        # Search by keyword
        res = self.client.get('/api/issues?q=checkout')
        self.assertEqual(res.status_code, 200)
        self.assertGreater(res.json['total'], 0)

        # Filter by project
        res = self.client.get('/api/issues?project_id=PRJ-001')
        self.assertEqual(res.status_code, 200)
        for i in res.json['issues']:
            self.assertEqual(i['project_id'], 'PRJ-001')

        # Filter by priority
        res = self.client.get('/api/issues?priority=P0')
        self.assertEqual(res.status_code, 200)
        for i in res.json['issues']:
            self.assertEqual(i['priority'], 'P0')

        # Filter by status
        res = self.client.get('/api/issues?status=Resolved')
        self.assertEqual(res.status_code, 200)
        for i in res.json['issues']:
            self.assertEqual(i['status'], 'Resolved')

    def test_06_projects_and_sprints_endpoints(self):
        """Verifies project listing with stats and sprint filtering."""
        res = self.client.get('/api/projects?include_stats=true')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.json), 8)
        p1 = res.json[0]
        self.assertIn('stats', p1)
        self.assertIn('progress', p1)

        # Sprints by project
        res = self.client.get('/api/sprints?project_id=PRJ-001')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json), 6) # 6 sprints per project

    def test_07_reports_analytics_endpoint(self):
        """Verifies real database reports calculations."""
        res = self.client.get('/api/reports')
        self.assertEqual(res.status_code, 200)
        r = res.json
        self.assertGreaterEqual(r['total_issues'], 730)
        self.assertIn('by_status', r)
        self.assertIn('by_priority', r)
        self.assertIn('by_severity', r)
        self.assertIn('by_type', r)
        self.assertIn('project_wise', r)
        self.assertIn('resolved_vs_unresolved', r)
        print(f"[Test 7] Reports Analytics verified: {r['total_issues']} issues, Resolution Rate: {r['resolution_rate']}%")

if __name__ == '__main__':
    unittest.main()
