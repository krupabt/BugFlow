import os
import sys
import unittest

# Ensure backend in python path
backend_dir = os.path.abspath('backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app
from extensions import db
from models.issue import Issue
from models.user import User
from models.project import Project
from models.sprint import Sprint

class BugFlowPhase1Verification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_01_database_connection_and_counts(self):
        """Verifies PostgreSQL connection and dataset integrity."""
        with self.app.app_context():
            issue_count = Issue.query.count()
            user_count = User.query.count()
            synthetic_users = User.query.filter(User.id.like('USR-%')).count()
            project_count = Project.query.count()
            sprint_count = Sprint.query.count()

            print(f"\n[Test 1] DB Counts: Total Issues: {issue_count} | Sprints: {sprint_count} | Projects: {project_count} | Users: {user_count}")
            self.assertEqual(project_count, 8, "Must have exactly 8 authoritative projects")
            self.assertEqual(user_count, 20, "Must have exactly 20 authoritative users")
            self.assertEqual(sprint_count, 48, "Must have exactly 48 sprints")
            self.assertEqual(issue_count, 730, "Must have exactly 730 imported issues")

    def test_02_all_four_roles_login_and_dashboards(self):
        """Verifies login, token generation, and role identification for all 4 roles."""
        role_creds = [
            ('Admin', 'ADMIN', 'krupa@example.org', ['Total Users', 'Total Projects', 'Total Issues', 'Open Issues']),
            ('Project Manager', 'PROJECT_MANAGER', 'Arun@example.org', ['My Projects', 'Total Issues', 'Open Issues', 'In Progress']),
            ('Developer', 'DEVELOPER', 'Priya.Sharma@example.org', ['Assigned Issues', 'In Progress', 'Resolved', 'Closed']),
            ('Tester', 'TESTER', 'Sunil.clark@example.org', ['Reported Issues', 'Testing', 'Resolved', 'Closed']),
        ]

        for display_role, internal_role, email, expected_cards in role_creds:
            res = self.client.post('/api/auth/login', json={'email': email, 'password': 'BugFlow@2026'})
            self.assertEqual(res.status_code, 200, f"Login failed for {display_role} ({email})")
            token = res.json.get('access_token')
            user_obj = res.json.get('user', {})
            self.assertIn(user_obj.get('role'), [display_role, internal_role])
            self.assertTrue(token)

            # Get role dashboard stats using ONLY the verified JWT token (no query params)
            headers = {'Authorization': f'Bearer {token}'}
            dash_res = self.client.get('/api/dashboard/stats', headers=headers)
            self.assertEqual(dash_res.status_code, 200)
            cards = [c['title'] for c in dash_res.json.get('cards', [])]
            print(f"[Test 2] {display_role} authenticated successfully. Dashboard cards: {cards}")
            self.assertEqual(cards, expected_cards)

    def test_03_auth_me_and_logout(self):
        """Verifies GET /api/auth/me session restore and POST /api/auth/logout."""
        # 1. Login
        res = self.client.post('/api/auth/login', json={'email': 'krupa@example.org', 'password': 'BugFlow@2026'})
        self.assertEqual(res.status_code, 200)
        token = res.json['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        # 2. GET /api/auth/me returns current user
        me_res = self.client.get('/api/auth/me', headers=headers)
        self.assertEqual(me_res.status_code, 200)
        user = me_res.json.get('user', {})
        self.assertEqual(user['email'], 'krupa@example.org')
        self.assertEqual(user['id'], 'USR-001')
        print(f"[Test 3] /api/auth/me successfully restored session for {user['name']} ({user['id']})")

        # 3. POST /api/auth/logout
        logout_res = self.client.post('/api/auth/logout', headers=headers)
        self.assertEqual(logout_res.status_code, 200)

    def test_04_invalid_login_and_security_checks(self):
        """Verifies rejection of invalid credentials, empty submissions, and bad tokens."""
        # Empty submission
        res = self.client.post('/api/auth/login', json={})
        self.assertEqual(res.status_code, 400)

        # Wrong password
        res = self.client.post('/api/auth/login', json={'email': 'krupa@example.org', 'password': 'wrongpassword'})
        self.assertEqual(res.status_code, 401)
        self.assertIn('Invalid', res.json.get('error', ''))

        # Non-existent email
        res = self.client.post('/api/auth/login', json={'email': 'nonexistent@example.org', 'password': 'BugFlow@2026'})
        self.assertEqual(res.status_code, 401)

        # Protected route without token rejected
        res = self.client.get('/api/auth/me')
        self.assertEqual(res.status_code, 401)

    def test_05_registration_workflow_and_role_safety(self):
        """Verifies public user registration, safe default roles, and duplicate prevention."""
        test_email = 'newdev.test@example.org'

        # Clean up if exists from previous test run
        with self.app.app_context():
            existing = User.query.filter_by(email=test_email).first()
            if existing:
                db.session.delete(existing)
                db.session.commit()

        # 1. Attempt public Admin registration (MUST be rejected)
        res = self.client.post('/api/auth/register', json={
            'full_name': 'Hacker Admin',
            'email': 'hacker@example.org',
            'password': 'password123',
            'role': 'ADMIN'
        })
        self.assertEqual(res.status_code, 403)
        self.assertIn('Elevated roles', res.json.get('error', ''))

        # 2. Attempt public Project Manager registration (MUST be rejected)
        res = self.client.post('/api/auth/register', json={
            'full_name': 'Hacker PM',
            'email': 'hacker_pm@example.org',
            'password': 'password123',
            'role': 'PROJECT_MANAGER'
        })
        self.assertEqual(res.status_code, 403)

        # 3. Valid Registration (defaults to safe DEVELOPER role)
        res = self.client.post('/api/auth/register', json={
            'full_name': 'New Dev Tester',
            'email': test_email,
            'password': 'SecurePassword@2026'
        })
        self.assertEqual(res.status_code, 201)
        created_user = res.json.get('user', {})
        self.assertEqual(created_user['email'], test_email)
        self.assertEqual(created_user['role'], 'DEVELOPER')
        print(f"[Test 5] Successfully registered new user: {created_user['name']} with safe role: {created_user['role']}")

        # 4. Duplicate email prevention
        dup_res = self.client.post('/api/auth/register', json={
            'full_name': 'Another User',
            'email': test_email.upper(), # test case-insensitive duplicate check
            'password': 'SecurePassword@2026'
        })
        self.assertEqual(dup_res.status_code, 409)
        self.assertIn('already exists', dup_res.json.get('error', ''))

        # 5. Login with newly registered account
        login_res = self.client.post('/api/auth/login', json={
            'email': test_email,
            'password': 'SecurePassword@2026'
        })
        self.assertEqual(login_res.status_code, 200)

        # Cleanup test user
        with self.app.app_context():
            u = User.query.filter_by(email=test_email).first()
            if u:
                db.session.delete(u)
                db.session.commit()

    def test_06_unauthorized_role_access(self):
        """Verifies that non-admin roles cannot perform admin operations."""
        # Developer logs in
        dev_res = self.client.post('/api/auth/login', json={'email': 'Priya.Sharma@example.org', 'password': 'BugFlow@2026'})
        dev_token = dev_res.json['access_token']
        dev_headers = {'Authorization': f'Bearer {dev_token}'}

        # Developer attempts to create a user (Admin only)
        user_create_res = self.client.post('/api/users', json={
            'name': 'Unauthorized User',
            'email': 'unauth@example.org',
            'role': 'Developer'
        }, headers=dev_headers)
        self.assertEqual(user_create_res.status_code, 403)
        self.assertIn('Only Administrators', user_create_res.json.get('error', ''))
        print("[Test 6] Verified that Developer cannot access Administrator endpoints (HTTP 403)")

    def test_07_natural_numeric_issue_sorting_and_creation(self):
        """Verifies natural numeric sorting (BUG-00001, BUG-00002...) and concurrency-safe sequential creation."""
        res = self.client.get('/api/issues?sort_by=id&sort_dir=asc&per_page=15')
        self.assertEqual(res.status_code, 200)
        issues = res.json.get('issues', [])
        ids = [i['id'] for i in issues]
        print(f"\n[Test 7] Natural Sorting First 5 IDs: {ids[:5]}")
        self.assertEqual(ids[0], 'BUG-00001')
        self.assertEqual(ids[1], 'BUG-00002')
        self.assertEqual(ids[2], 'BUG-00003')
        self.assertEqual(ids[3], 'BUG-00004')
        self.assertEqual(ids[4], 'BUG-00005')

        # Test creating next sequential issue
        admin_res = self.client.post('/api/auth/login', json={'email': 'krupa@example.org', 'password': 'BugFlow@2026'})
        token = admin_res.json['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        new_issue_res = self.client.post('/api/issues', json={
            'title': 'Test Sequential Creation',
            'description': 'Testing concurrency-safe sequential issue ID generation',
            'project_id': 'PRJ-001',
            'issue_type': 'Bug',
            'severity': 'Medium',
            'priority': 'P2'
        }, headers=headers)
        self.assertEqual(new_issue_res.status_code, 201)
        created_issue = new_issue_res.json.get('issue', {})
        print(f"[Test 7] Newly generated sequential issue ID: {created_issue.get('id')}")
        self.assertTrue(created_issue.get('id', '').startswith('BUG-'))

        # Clean up created issue to keep dataset at 730
        with self.app.app_context():
            iss = db.session.get(Issue, created_issue['id'])
            if iss:
                db.session.delete(iss)
                db.session.commit()

if __name__ == '__main__':
    unittest.main()
