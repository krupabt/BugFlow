import os
import json

def generate_postman_artifacts():
    os.makedirs('postman', exist_ok=True)

    # 1. POSTMAN ENVIRONMENT
    environment = {
        "id": "bugflow-env-2026-v1",
        "name": "BugFlow Local Environment",
        "values": [
            {
                "key": "base_url",
                "value": "http://127.0.0.1:5000",
                "type": "default",
                "enabled": True
            },
            {
                "key": "admin_email",
                "value": "krupa@example.org",
                "type": "default",
                "enabled": True
            },
            {
                "key": "admin_password",
                "value": "BugFlow@2026",
                "type": "secret",
                "enabled": True
            },
            {
                "key": "auth_token",
                "value": "",
                "type": "secret",
                "enabled": True
            },
            {
                "key": "project_id",
                "value": "PRJ-001",
                "type": "default",
                "enabled": True
            },
            {
                "key": "issue_id",
                "value": "BUG-00086",
                "type": "default",
                "enabled": True
            },
            {
                "key": "developer_id",
                "value": "USR-005",
                "type": "default",
                "enabled": True
            },
            {
                "key": "new_issue_id",
                "value": "",
                "type": "default",
                "enabled": True
            },
            {
                "key": "invalid_issue_id",
                "value": "BUG-NONEXISTENT-99999",
                "type": "default",
                "enabled": True
            },
            {
                "key": "invalid_project_id",
                "value": "PRJ-NONEXISTENT-999",
                "type": "default",
                "enabled": True
            }
        ],
        "_postman_variable_scope": "environment"
    }

    with open('postman/BugFlow_Environment.postman_environment.json', 'w', encoding='utf-8') as f:
        json.dump(environment, f, indent=2)
    print("Created postman/BugFlow_Environment.postman_environment.json")

    # 2. POSTMAN COLLECTION
    collection = {
        "info": {
            "_postman_id": "bugflow-collection-2026-v1",
            "name": "BugFlow – Issue Management & Project Analytics APIs",
            "description": "Comprehensive REST API test collection for BugFlow Issue Management, Workflow Transitions, Project Issues, and Project Analytics with automated test assertions.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": [
            # 0. AUTHENTICATION (Helper for test suite)
            {
                "name": "0. Authentication",
                "item": [
                    {
                        "name": "Login (Generate JWT Token)",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 200', function () {",
                                        "    pm.response.to.have.status(200);",
                                        "});",
                                        "",
                                        "pm.test('Response has access_token and user info', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData).to.have.property('access_token');",
                                        "    pm.expect(jsonData.access_token).to.be.a('string');",
                                        "    pm.expect(jsonData).to.have.property('user');",
                                        "    pm.environment.set('auth_token', jsonData.access_token);",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "POST",
                            "header": [
                                { "key": "Content-Type", "value": "application/json" }
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "email": "{{admin_email}}",
                                    "password": "{{admin_password}}"
                                }, indent=2)
                            },
                            "url": {
                                "raw": "{{base_url}}/api/auth/login",
                                "host": ["{{base_url}}"],
                                "path": ["api", "auth", "login"]
                            },
                            "description": "Authenticates user against PostgreSQL user records and populates {{auth_token}} environment variable."
                        }
                    }
                ]
            },
            # 1. ISSUE MANAGEMENT
            {
                "name": "1. Issue Management",
                "item": [
                    {
                        "name": "Get All Issues",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 200', function () {",
                                        "    pm.response.to.have.status(200);",
                                        "});",
                                        "",
                                        "pm.test('Response time is below 3000ms', function () {",
                                        "    pm.expect(pm.response.responseTime).to.be.below(3000);",
                                        "});",
                                        "",
                                        "pm.test('JSON response structure includes issues array, total, and summary counts', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData).to.have.property('issues');",
                                        "    pm.expect(jsonData.issues).to.be.an('array');",
                                        "    pm.expect(jsonData).to.have.property('total');",
                                        "    pm.expect(jsonData.total).to.be.a('number');",
                                        "    pm.expect(jsonData).to.have.property('summary');",
                                        "    pm.expect(jsonData.summary).to.have.property('open');",
                                        "    pm.expect(jsonData.summary).to.have.property('in_progress');",
                                        "    pm.expect(jsonData.summary).to.have.property('resolved');",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "GET",
                            "header": [
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "url": {
                                "raw": "{{base_url}}/api/issues?page=1&per_page=15",
                                "host": ["{{base_url}}"],
                                "path": ["api", "issues"],
                                "query": [
                                    { "key": "page", "value": "1" },
                                    { "key": "per_page", "value": "15" }
                                ]
                            },
                            "description": "Retrieves paginated list of all permitted issues along with top-level PostgreSQL summary statistics."
                        }
                    },
                    {
                        "name": "Get Issue by ID",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 200', function () {",
                                        "    pm.response.to.have.status(200);",
                                        "});",
                                        "",
                                        "pm.test('Returned issue matches requested ID', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    var issueId = jsonData.id || (jsonData.data && jsonData.data.id);",
                                        "    pm.expect(issueId).to.eql(pm.environment.get('issue_id'));",
                                        "    pm.expect(jsonData).to.have.property('title');",
                                        "    pm.expect(jsonData).to.have.property('status');",
                                        "    pm.expect(jsonData).to.have.property('severity');",
                                        "    pm.expect(jsonData).to.have.property('priority');",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "GET",
                            "header": [
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "url": {
                                "raw": "{{base_url}}/api/issues/{{issue_id}}",
                                "host": ["{{base_url}}"],
                                "path": ["api", "issues", "{{issue_id}}"]
                            },
                            "description": "Retrieves one specific issue record by ID from PostgreSQL with full details."
                        }
                    },
                    {
                        "name": "Create Issue",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 201 Created', function () {",
                                        "    pm.response.to.have.status(201);",
                                        "});",
                                        "",
                                        "pm.test('Response indicates success and returns generated issue_id', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData.success).to.be.true;",
                                        "    pm.expect(jsonData).to.have.property('data');",
                                        "    var newId = jsonData.data.issue_id || (jsonData.issue && jsonData.issue.id);",
                                        "    pm.expect(newId).to.match(/^BUG-\\d+$/);",
                                        "    pm.environment.set('new_issue_id', newId);",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "POST",
                            "header": [
                                { "key": "Content-Type", "value": "application/json" },
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "title": "Postman Automated Defect Validation",
                                    "description": "Automated regression issue generated to verify PostgreSQL persistence and ID sequencing.",
                                    "project_id": "{{project_id}}",
                                    "issue_type": "Bug",
                                    "severity": "High",
                                    "priority": "P2",
                                    "affected_module": "Dashboard",
                                    "environment": "Testing"
                                }, indent=2)
                            },
                            "url": {
                                "raw": "{{base_url}}/api/issues",
                                "host": ["{{base_url}}"],
                                "path": ["api", "issues"]
                            },
                            "description": "Creates a new issue in PostgreSQL with automatic sequential BUG-xxxxx ID generation."
                        }
                    },
                    {
                        "name": "Update Issue",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 200 OK', function () {",
                                        "    pm.response.to.have.status(200);",
                                        "});",
                                        "",
                                        "pm.test('Response indicates successful update', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData.success).to.be.true;",
                                        "    pm.expect(jsonData.message).to.include('updated successfully');",
                                        "    var title = jsonData.data ? jsonData.data.issue.title : jsonData.issue.title;",
                                        "    pm.expect(title).to.include('(Updated via Postman)');",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "PUT",
                            "header": [
                                { "key": "Content-Type", "value": "application/json" },
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "title": "Postman Automated Defect Validation (Updated via Postman)",
                                    "description": "Updated defect description with enhanced context and environment reproduction notes.",
                                    "severity": "Critical",
                                    "priority": "P1"
                                }, indent=2)
                            },
                            "url": {
                                "raw": "{{base_url}}/api/issues/{{new_issue_id}}",
                                "host": ["{{base_url}}"],
                                "path": ["api", "issues", "{{new_issue_id}}"]
                            },
                            "description": "Updates issue fields in PostgreSQL using PUT/PATCH with audit logging."
                        }
                    },
                    {
                        "name": "Delete Issue",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 200 OK', function () {",
                                        "    pm.response.to.have.status(200);",
                                        "});",
                                        "",
                                        "pm.test('Response confirms issue deletion', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData.success).to.be.true;",
                                        "    pm.expect(jsonData.message).to.include('deleted');",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "DELETE",
                            "header": [
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "url": {
                                "raw": "{{base_url}}/api/issues/{{new_issue_id}}",
                                "host": ["{{base_url}}"],
                                "path": ["api", "issues", "{{new_issue_id}}"]
                            },
                            "description": "Deletes created test issue from PostgreSQL with cascade cleanup."
                        }
                    }
                ]
            },
            # 2. ISSUE WORKFLOW
            {
                "name": "2. Issue Workflow",
                "item": [
                    {
                        "name": "Assign Issue",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 200 OK', function () {",
                                        "    pm.response.to.have.status(200);",
                                        "});",
                                        "",
                                        "pm.test('Issue assigned to developer successfully', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData.success).to.be.true;",
                                        "    pm.expect(jsonData.data.assigned_to).to.eql(pm.environment.get('developer_id'));",
                                        "    pm.expect(jsonData.message).to.include('assigned to');",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "PATCH",
                            "header": [
                                { "key": "Content-Type", "value": "application/json" },
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "assigned_to": "{{developer_id}}"
                                }, indent=2)
                            },
                            "url": {
                                "raw": "{{base_url}}/api/issues/{{issue_id}}/assign",
                                "host": ["{{base_url}}"],
                                "path": ["api", "issues", "{{issue_id}}", "assign"]
                            },
                            "description": "Reassigns an issue to a team developer and creates audit log record in PostgreSQL."
                        }
                    },
                    {
                        "name": "Update Issue Status",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 200 OK', function () {",
                                        "    pm.response.to.have.status(200);",
                                        "});",
                                        "",
                                        "pm.test('Issue status updated successfully', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData.success).to.be.true;",
                                        "    pm.expect(jsonData.message).to.include('Status updated');",
                                        "    var currentStatus = jsonData.data ? jsonData.data.new_status : jsonData.issue.status;",
                                        "    pm.expect(['Open', 'In Progress', 'Testing', 'Resolved', 'Closed']).to.include(currentStatus);",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "PATCH",
                            "header": [
                                { "key": "Content-Type", "value": "application/json" },
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "status": "In Progress",
                                    "comment": "Status advanced via Postman workflow verification test."
                                }, indent=2)
                            },
                            "url": {
                                "raw": "{{base_url}}/api/issues/{{issue_id}}/status",
                                "host": ["{{base_url}}"],
                                "path": ["api", "issues", "{{issue_id}}", "status"]
                            },
                            "description": "Transitions issue workflow status with permission and lifecycle transition validation."
                        }
                    }
                ]
            },
            # 3. PROJECT MANAGEMENT
            {
                "name": "3. Project Management",
                "item": [
                    {
                        "name": "Get Project-wise Issues",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 200 OK', function () {",
                                        "    pm.response.to.have.status(200);",
                                        "});",
                                        "",
                                        "pm.test('Returns issues strictly belonging to specified project', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData.success).to.be.true;",
                                        "    pm.expect(jsonData.project_id).to.eql(pm.environment.get('project_id'));",
                                        "    pm.expect(jsonData.issues).to.be.an('array');",
                                        "    pm.expect(jsonData.total).to.be.a('number');",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "GET",
                            "header": [
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "url": {
                                "raw": "{{base_url}}/api/projects/{{project_id}}/issues?page=1&per_page=20",
                                "host": ["{{base_url}}"],
                                "path": ["api", "projects", "{{project_id}}", "issues"],
                                "query": [
                                    { "key": "page", "value": "1" },
                                    { "key": "per_page", "value": "20" }
                                ]
                            },
                            "description": "Retrieves project-wise issues with filtering and pagination."
                        }
                    }
                ]
            },
            # 4. PROJECT ANALYTICS
            {
                "name": "4. Project Analytics",
                "item": [
                    {
                        "name": "Get Project Analytics",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 200 OK', function () {",
                                        "    pm.response.to.have.status(200);",
                                        "});",
                                        "",
                                        "pm.test('Analytics response contains all required sections', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData.success).to.be.true;",
                                        "    var d = jsonData.data;",
                                        "    pm.expect(d).to.have.property('project');",
                                        "    pm.expect(d).to.have.property('summary');",
                                        "    pm.expect(d.summary).to.have.property('total_issues');",
                                        "    pm.expect(d.summary).to.have.property('open_issues');",
                                        "    pm.expect(d.summary).to.have.property('in_progress_issues');",
                                        "    pm.expect(d.summary).to.have.property('resolved_issues');",
                                        "    pm.expect(d).to.have.property('status_distribution');",
                                        "    pm.expect(d.status_distribution).to.be.an('array');",
                                        "    pm.expect(d).to.have.property('defect_trend');",
                                        "    pm.expect(d.defect_trend).to.be.an('array');",
                                        "    pm.expect(d).to.have.property('severity_distribution');",
                                        "    pm.expect(d.severity_distribution).to.be.an('array');",
                                        "    pm.expect(d).to.have.property('quality_metrics');",
                                        "    pm.expect(d.quality_metrics).to.have.property('average_resolution_time');",
                                        "    pm.expect(d.quality_metrics).to.have.property('resolution_rate');",
                                        "    pm.expect(d.quality_metrics).to.have.property('defect_density');",
                                        "    pm.expect(d.quality_metrics.defect_density.status).to.eql('unavailable');",
                                        "    pm.expect(d).to.have.property('quality_insights');",
                                        "    pm.expect(d.quality_insights).to.have.property('health');",
                                        "    pm.expect(d.quality_insights).to.have.property('score');",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "GET",
                            "header": [
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "url": {
                                "raw": "{{base_url}}/api/analytics/projects/{{project_id}}",
                                "host": ["{{base_url}}"],
                                "path": ["api", "analytics", "projects", "{{project_id}}"]
                            },
                            "description": "Calculates real-time project software quality metrics, status distributions, monthly defect trends, and quality health scores."
                        }
                    }
                ]
            },
            # 5. ERROR HANDLING & BOUNDARY TEST CASES
            {
                "name": "5. Error Handling & Validation Tests",
                "item": [
                    {
                        "name": "Missing Issue ID (404 Not Found)",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 404', function () {",
                                        "    pm.response.to.have.status(404);",
                                        "});",
                                        "pm.test('Error message received', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData.error).to.include('Issue not found');",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "GET",
                            "header": [
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "url": {
                                "raw": "{{base_url}}/api/issues/{{invalid_issue_id}}",
                                "host": ["{{base_url}}"],
                                "path": ["api", "issues", "{{invalid_issue_id}}"]
                            },
                            "description": "Validates 404 response when querying a non-existent issue ID."
                        }
                    },
                    {
                        "name": "Invalid Project ID (404 Not Found)",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 404', function () {",
                                        "    pm.response.to.have.status(404);",
                                        "});",
                                        "pm.test('Error message received', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData.error).to.include('Project not found');",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "GET",
                            "header": [
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "url": {
                                "raw": "{{base_url}}/api/projects/{{invalid_project_id}}/issues",
                                "host": ["{{base_url}}"],
                                "path": ["api", "projects", "{{invalid_project_id}}", "issues"]
                            },
                            "description": "Validates 404 response when querying issues for an invalid project ID."
                        }
                    },
                    {
                        "name": "Missing Required Fields (400 Bad Request)",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 400 Bad Request', function () {",
                                        "    pm.response.to.have.status(400);",
                                        "});",
                                        "pm.test('Validation error message received', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData.error).to.be.a('string');",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "POST",
                            "header": [
                                { "key": "Content-Type", "value": "application/json" },
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({}, indent=2)
                            },
                            "url": {
                                "raw": "{{base_url}}/api/issues",
                                "host": ["{{base_url}}"],
                                "path": ["api", "issues"]
                            },
                            "description": "Validates 400 Bad Request when mandatory fields (title, project_id, etc.) are omitted."
                        }
                    },
                    {
                        "name": "Invalid Status Transition (400 Bad Request)",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 400 Bad Request', function () {",
                                        "    pm.response.to.have.status(400);",
                                        "});",
                                        "pm.test('Workflow transition error reported', function () {",
                                        "    var jsonData = pm.response.json();",
                                        "    pm.expect(jsonData.error).to.include('Invalid status');",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "PATCH",
                            "header": [
                                { "key": "Content-Type", "value": "application/json" },
                                { "key": "Authorization", "value": "Bearer {{auth_token}}" }
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "status": "NON_EXISTENT_STATUS"
                                }, indent=2)
                            },
                            "url": {
                                "raw": "{{base_url}}/api/issues/{{issue_id}}/status",
                                "host": ["{{base_url}}"],
                                "path": ["api", "issues", "{{issue_id}}", "status"]
                            },
                            "description": "Validates workflow state validation reject invalid status inputs."
                        }
                    },
                    {
                        "name": "Unauthorized API Request (401 Unauthorized)",
                        "event": [
                            {
                                "listen": "test",
                                "script": {
                                    "exec": [
                                        "pm.test('Status code is 401 Unauthorized', function () {",
                                        "    pm.response.to.have.status(401);",
                                        "});"
                                    ],
                                    "type": "text/javascript"
                                }
                            }
                        ],
                        "request": {
                            "method": "GET",
                            "header": [],
                            "url": {
                                "raw": "{{base_url}}/api/issues",
                                "host": ["{{base_url}}"],
                                "path": ["api", "issues"]
                            },
                            "description": "Validates that endpoints reject unauthenticated requests lacking a valid Bearer JWT."
                        }
                    }
                ]
            }
        ]
    }

    with open('postman/BugFlow_APIs.postman_collection.json', 'w', encoding='utf-8') as f:
        json.dump(collection, f, indent=2)
    print("Created postman/BugFlow_APIs.postman_collection.json")

    # 3. POSTMAN README
    readme_content = """# BugFlow – Postman API Collection & Testing Guide

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
"""

    with open('postman/README.md', 'w', encoding='utf-8') as f:
        f.write(readme_content)
    print("Created postman/README.md")

if __name__ == '__main__':
    generate_postman_artifacts()
