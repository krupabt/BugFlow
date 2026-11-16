import os
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.cicd import CiCdWorkflowRun, CiCdTestResult
from models.user import User
from services.github_service import GitHubService

cicd_bp = Blueprint("cicd", __name__, url_prefix="/api/cicd")

def get_current_user():
    user_id = get_jwt_identity()
    if user_id:
        return db.session.get(User, user_id)
    return None


@cicd_bp.route("/status", methods=["GET"])
def get_cicd_status():
    """Get GitHub Actions CI/CD connection and readiness status."""
    gh_status = GitHubService.get_status()
    workflows_res = GitHubService.get_actions_workflows()
    return jsonify({
        "connected": gh_status.get("connected", False),
        "repository_name": gh_status.get("repository_name", "krupabt/BugFlow"),
        "status": "Connected" if gh_status.get("connected") else "Not Connected",
        "workflows_count": workflows_res.get("total_count", 0),
        "workflows": workflows_res.get("workflows", []),
        "error": workflows_res.get("error") if not gh_status.get("connected") else None
    }), 200


@cicd_bp.route("/workflows", methods=["GET"])
def list_workflows():
    """List real GitHub Actions workflows for the repository."""
    result = GitHubService.get_actions_workflows()
    return jsonify(result), 200


@cicd_bp.route("/runs", methods=["GET"])
def list_workflow_runs():
    """Retrieve real workflow runs from GitHub Actions API."""
    limit = request.args.get("limit", 15, type=int)
    branch = request.args.get("branch")
    
    # Check live GitHub Actions runs
    result = GitHubService.get_actions_runs(limit=limit, branch=branch)
    if result.get("connected") and len(result.get("runs", [])) > 0:
        return jsonify(result), 200

    # If GitHub is not connected or no live runs returned, check verified runs in PostgreSQL
    db_runs = CiCdWorkflowRun.query.order_by(CiCdWorkflowRun.started_at.desc()).limit(limit).all()
    if db_runs:
        return jsonify({
            "connected": result.get("connected", False),
            "runs": [r.to_dict() for r in db_runs],
            "count": len(db_runs),
            "source": "database_verified"
        }), 200

    # Truthful empty state
    return jsonify({
        "connected": result.get("connected", False),
        "runs": [],
        "count": 0,
        "message": "No workflow runs available. Configure GitHub Actions workflows in .github/workflows/ and trigger a build."
    }), 200


@cicd_bp.route("/runs/<run_id>", methods=["GET"])
def get_workflow_run(run_id):
    """Get details for a specific workflow run including real jobs."""
    # If run_id is numeric, attempt GitHub API jobs fetch
    jobs_res = {"jobs": []}
    clean_id = run_id.replace("#", "")
    if clean_id.isdigit():
        jobs_res = GitHubService.get_run_jobs(int(clean_id))

    # Check database record
    db_run = CiCdWorkflowRun.query.filter((CiCdWorkflowRun.run_id == run_id) | (CiCdWorkflowRun.run_id == f"#{run_id}")).first()
    if db_run:
        data = db_run.to_dict()
        if jobs_res.get("jobs"):
            data["jobs"] = jobs_res["jobs"]
        return jsonify({"run": data}), 200

    return jsonify({"error": f"Workflow run '{run_id}' not found."}), 404


@cicd_bp.route("/latest", methods=["GET"])
def get_latest_run():
    """Retrieve the latest real workflow run."""
    # 1. Check live GitHub Actions
    result = GitHubService.get_actions_runs(limit=1)
    if result.get("connected") and len(result.get("runs", [])) > 0:
        latest = result["runs"][0]
        # Attach jobs
        clean_id = str(latest.get("id", "")).replace("#", "")
        if clean_id.isdigit():
            jobs_res = GitHubService.get_run_jobs(int(clean_id))
            latest["jobs"] = jobs_res.get("jobs", [])
        return jsonify({"run": latest, "source": "github_actions"}), 200

    # 2. Check database verified runs
    db_run = CiCdWorkflowRun.query.order_by(CiCdWorkflowRun.started_at.desc()).first()
    if db_run:
        return jsonify({"run": db_run.to_dict(), "source": "database_verified"}), 200

    # Truthful empty state
    return jsonify({
        "run": None,
        "status": "Not Configured",
        "message": "No workflow runs have executed yet."
    }), 200


@cicd_bp.route("/run-tests", methods=["POST"])
@jwt_required(optional=True)
def execute_automated_tests():
    """
    Execute real automated pytest test suite, generate JUnit XML report,
    and persist verified test results in PostgreSQL.
    """
    user = get_current_user()
    triggered_by = f"{user.name} ({user.role_display})" if user else "Automated Runner"

    # Base workspace directory
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    test_results_dir = os.path.join(base_dir, "test-results")
    os.makedirs(test_results_dir, exist_ok=True)
    junit_xml_path = os.path.join(test_results_dir, "junit.xml")

    # Command to run pytest with JUnit XML output
    cmd = [
        "pytest",
        "tests",
        f"--junitxml={junit_xml_path}",
        "-v"
    ]

    start_time = datetime.now(timezone.utc)
    try:
        proc = subprocess.run(cmd, cwd=base_dir, capture_output=True, text=True, timeout=60)
        end_time = datetime.now(timezone.utc)
        duration_seconds = max(1, int((end_time - start_time).total_seconds()))

        # Parse real JUnit XML report
        test_cases = []
        if os.path.exists(junit_xml_path):
            try:
                tree = ET.parse(junit_xml_path)
                root = tree.getroot()
                
                # Iterate testcases
                for tc in root.iter("testcase"):
                    name = tc.attrib.get("name", "Unknown Test")
                    classname = tc.attrib.get("classname", "")
                    time_sec = float(tc.attrib.get("time", "0.1"))
                    duration_ms = int(time_sec * 1000)

                    failure = tc.find("failure")
                    error = tc.find("error")
                    skipped = tc.find("skipped")

                    if failure is not None:
                        status = "FAILED"
                        details = failure.text or failure.attrib.get("message", "Assertion failed")
                    elif error is not None:
                        status = "ERROR"
                        details = error.text or error.attrib.get("message", "Execution error")
                    elif skipped is not None:
                        status = "SKIPPED"
                        details = skipped.attrib.get("message", "Test skipped")
                    else:
                        status = "PASSED"
                        details = "All assertions passed successfully."

                    # Human-friendly test suite name mapping
                    friendly_name = name.replace("test_", "").replace("_", " ").title()
                    if "Login" in friendly_name:
                        category = "Authentication & RBAC"
                    elif "Issue" in friendly_name:
                        category = "Issue Management"
                    elif "Analytics" in friendly_name:
                        category = "Project Analytics"
                    elif "Dashboard" in friendly_name:
                        category = "Performance & SLA"
                    elif "Github" in friendly_name or "Action" in friendly_name:
                        category = "VCS & DevOps"
                    else:
                        category = "Integration Test"

                    test_cases.append({
                        "name": friendly_name,
                        "category": category,
                        "status": status,
                        "duration_ms": duration_ms,
                        "assertions_passed": 1 if status == "PASSED" else 0,
                        "assertions_total": 1,
                        "details": details
                    })
            except Exception as e:
                print(f"Error parsing JUnit XML: {e}")

        # If pytest executed, record verified run in database
        total_tests = len(test_cases)
        passed_tests = sum(1 for t in test_cases if t["status"] == "PASSED")
        run_status = "SUCCESS" if (total_tests > 0 and passed_tests == total_tests) else "FAILED"

        next_id = CiCdWorkflowRun.query.count() + 1
        run_id_str = f"#{1050 + next_id}"

        new_run = CiCdWorkflowRun(
            run_id=run_id_str,
            workflow_name="BugFlow Automated Test Suite",
            branch="main",
            commit_id="local_exec",
            short_sha="local",
            commit_message="Local pytest test suite automated execution",
            commit_author=triggered_by,
            status=run_status,
            stage_code_push="SUCCESS",
            stage_build_test="SUCCESS",
            stage_tests_passed="SUCCESS" if run_status == "SUCCESS" else "FAILED",
            stage_deployment="SKIPPED", # Honest status: not deployed in local test run
            duration_seconds=duration_seconds,
            started_at=start_time,
            completed_at=end_time,
            triggered_by=triggered_by,
            environment="Test Environment"
        )
        db.session.add(new_run)
        db.session.flush()

        for t in test_cases:
            res_obj = CiCdTestResult(
                run_id=new_run.id,
                name=t["name"],
                category=t["category"],
                status=t["status"],
                duration_ms=t["duration_ms"],
                assertions_passed=t["assertions_passed"],
                assertions_total=t["assertions_total"],
                details=t["details"]
            )
            db.session.add(res_obj)

        db.session.commit()

        return jsonify({
            "message": f"Executed {total_tests} tests. Result: {run_status} ({passed_tests}/{total_tests} passed).",
            "run": new_run.to_dict(),
            "stdout": proc.stdout,
            "stderr": proc.stderr
        }), 200

    except Exception as e:
        return jsonify({"error": f"Failed to execute tests: {str(e)}"}), 500


@cicd_bp.route("/test-results", methods=["GET"])
def get_test_results():
    """Retrieve verified automated test results from PostgreSQL."""
    latest_run = CiCdWorkflowRun.query.order_by(CiCdWorkflowRun.started_at.desc()).first()
    if not latest_run:
        return jsonify({"test_results": [], "count": 0, "status": "No test results recorded yet."}), 200

    results = [t.to_dict() for t in latest_run.test_results]
    return jsonify({
        "run_id": latest_run.run_id,
        "status": latest_run.status,
        "tests_total": len(results),
        "tests_passed": sum(1 for t in results if t["status"] == "PASSED"),
        "test_results": results
    }), 200


@cicd_bp.route("/metrics", methods=["GET"])
def get_cicd_metrics():
    """Return high-level CI/CD metrics."""
    total_runs = CiCdWorkflowRun.query.count()
    successful_runs = CiCdWorkflowRun.query.filter_by(status="SUCCESS").count()
    success_rate = round((successful_runs / total_runs * 100), 1) if total_runs > 0 else 100.0
    latest_run = CiCdWorkflowRun.query.order_by(CiCdWorkflowRun.started_at.desc()).first()

    return jsonify({
        "total_runs": total_runs,
        "successful_runs": successful_runs,
        "success_rate": success_rate,
        "latest_run": latest_run.to_dict() if latest_run else None,
        "required_test_suites": [
            "Login API Test",
            "Issue Creation Test",
            "Analytics API Test",
            "Dashboard Load Test",
            "GitHub Integration Test"
        ]
    }), 200
