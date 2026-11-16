# BugFlow – Postman API Collection & Testing Guide

This directory contains the official Postman collection and environment files for testing BugFlow's Issue Management, Workflow Transitions, Project Issues, and Software Quality Analytics REST APIs.

## Files
1. **`BugFlow_APIs.postman_collection.json`** – The complete Postman collection v2.1.0 with automated JavaScript test scripts (`pm.test`).
2. **`BugFlow_Environment.postman_environment.json`** – Pre-configured environment variables (`base_url`, `auth_token`, `project_id`, `issue_id`, `developer_id`, etc.).

---

## How to Import & Run in Postman

### Step 1: Import Files into Postman
1. Open the Postman desktop application or Postman Web.
2. Click the **Import** button in the top left corner.
3. Select and drag both files into Postman:
   - `postman/BugFlow_APIs.postman_collection.json`
   - `postman/BugFlow_Environment.postman_environment.json`
4. Confirm import.

### Step 2: Select the Environment
- In the top right corner of Postman, change the active environment dropdown from *No Environment* to **`BugFlow Local Environment`**.
- Verify that `base_url` is set to `http://127.0.0.1:5000` (or your active Flask port).

### Step 3: Run the Collection
1. Expand the imported collection: **BugFlow – Issue Management & Project Analytics APIs**.
2. Run the first request **`0. Authentication / Login (Generate JWT Token)`**.
   - This sends credentials for `krupa@example.org` (`BugFlow@2026`).
   - The test script automatically captures the returned JWT token and sets `{{auth_token}}` in your environment.
3. Click the **Runner** button (or right click the collection and click **Run Collection**).
4. Click **Run BugFlow – Issue Management & Project Analytics APIs**.
5. All test assertions will execute sequentially:
   - HTTP status code checks (200, 201, 400, 401, 404).
   - JSON structure and schema validations.
   - Response field assertions (title, status, resolution metrics, defect density).
   - Dynamic issue creation, assignment, status transition, and deletion lifecycle.

---

## Folder & Test Summary

| Folder | Request | Method | Path | Expected Status |
|---|---|---|---|---|
| **0. Authentication** | Login (Generate JWT Token) | POST | `/api/auth/login` | 200 OK |
| **1. Issue Management** | Get All Issues | GET | `/api/issues` | 200 OK |
| | Get Issue by ID | GET | `/api/issues/{{issue_id}}` | 200 OK |
| | Create Issue | POST | `/api/issues` | 201 Created |
| | Update Issue | PUT | `/api/issues/{{new_issue_id}}` | 200 OK |
| | Delete Issue | DELETE | `/api/issues/{{new_issue_id}}` | 200 OK |
| **2. Issue Workflow** | Assign Issue | PATCH | `/api/issues/{{issue_id}}/assign` | 200 OK |
| | Update Issue Status | PATCH | `/api/issues/{{issue_id}}/status` | 200 OK |
| **3. Project Management** | Get Project-wise Issues | GET | `/api/projects/{{project_id}}/issues` | 200 OK |
| **4. Project Analytics** | Get Project Analytics | GET | `/api/analytics/projects/{{project_id}}` | 200 OK |
| **5. Error Handling** | Missing Issue ID | GET | `/api/issues/{{invalid_issue_id}}` | 404 Not Found |
| | Invalid Project ID | GET | `/api/projects/{{invalid_project_id}}/issues` | 404 Not Found |
| | Missing Required Fields | POST | `/api/issues` | 400 Bad Request |
| | Invalid Status Transition | PATCH | `/api/issues/{{issue_id}}/status` | 400 Bad Request |
| | Unauthorized API Request | GET | `/api/issues` | 401 Unauthorized |
