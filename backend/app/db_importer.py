import os
import pandas as pd
from datetime import datetime
from werkzeug.security import generate_password_hash
from sqlalchemy import text
from app.extensions import db

ROLE_MAPPING = {
    'ADMIN': 'Admin',
    'PROJECT_MANAGER': 'Project Manager',
    'DEVELOPER': 'Developer',
    'TESTER': 'Tester'
}

DEFAULT_DEMO_PASSWORD = "BugFlow@2026"

def clean_val(val, default=None):
    if pd.isna(val) or val is None:
        return default
    if isinstance(val, str):
        v = val.strip()
        return v if v != "" else default
    return val

def clean_date(val):
    v = clean_val(val)
    if not v:
        return None
    try:
        if isinstance(v, str):
            return datetime.strptime(v[:10], '%Y-%m-%d').date()
        return v
    except Exception:
        return None

def ensure_dataset_imported():
    """Idempotently imports the CSV files into PostgreSQL if not already present."""
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    db_folder = os.path.join(base_dir, 'database')
    if not os.path.exists(db_folder):
        return

    # Quick check if synthetic dataset is already imported
    try:
        synthetic_count = db.session.execute(text("SELECT count(*) FROM issues WHERE id LIKE 'BUG-%'")).scalar()
        if synthetic_count and synthetic_count >= 730:
            return
    except Exception:
        pass

    hashed_pwd = generate_password_hash(DEFAULT_DEMO_PASSWORD)
    conn = db.engine.connect()
    trans = conn.begin()
    try:
        # 1. Workflow states
        wf_path = os.path.join(db_folder, 'workflow_states.csv')
        if os.path.exists(wf_path):
            conn.execute(text("DELETE FROM workflow_states WHERE id NOT LIKE 'ST-%'"))
            df_wf = pd.read_csv(wf_path)
            for _, row in df_wf.iterrows():
                conn.execute(text('''
                    INSERT INTO workflow_states (id, name, sequence, terminal)
                    VALUES (:id, :name, :seq, :term)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        sequence = EXCLUDED.sequence,
                        terminal = EXCLUDED.terminal
                '''), {
                    'id': clean_val(row.get('state_id')),
                    'name': clean_val(row.get('state_name')),
                    'seq': clean_val(row.get('sequence'), 1),
                    'term': bool(clean_val(row.get('terminal'), False))
                })

        # 2. Users
        u_path = os.path.join(db_folder, 'users.csv')
        if os.path.exists(u_path):
            df_u = pd.read_csv(u_path)
            for _, row in df_u.iterrows():
                uid = clean_val(row.get('user_id'))
                name = clean_val(row.get('display_name'))
                email = clean_val(row.get('email'))
                raw_role = clean_val(row.get('role'), 'DEVELOPER')
                role = ROLE_MAPPING.get(raw_role.upper(), raw_role)
                active = bool(clean_val(row.get('active'), True))
                
                conn.execute(text('''
                    INSERT INTO users (id, name, email, password_hash, role, active, created_at)
                    VALUES (:id, :name, :email, :pwd, :role, :active, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        role = EXCLUDED.role,
                        active = EXCLUDED.active
                '''), {'id': uid, 'name': name, 'email': email, 'pwd': hashed_pwd, 'role': role, 'active': active})

        # 3. Projects
        p_path = os.path.join(db_folder, 'projects.csv')
        if os.path.exists(p_path):
            df_p = pd.read_csv(p_path)
            for _, row in df_p.iterrows():
                conn.execute(text('''
                    INSERT INTO projects (id, name, description, created_date, project_manager_id, lifecycle_status, created_at)
                    VALUES (:id, :name, :desc, :cdate, :pm_id, :status, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        created_date = EXCLUDED.created_date,
                        project_manager_id = EXCLUDED.project_manager_id,
                        lifecycle_status = EXCLUDED.lifecycle_status
                '''), {
                    'id': clean_val(row.get('project_id')),
                    'name': clean_val(row.get('project_name')),
                    'desc': clean_val(row.get('description'), ''),
                    'cdate': clean_date(row.get('created_date')),
                    'pm_id': clean_val(row.get('project_manager_id')),
                    'status': clean_val(row.get('lifecycle_status'), 'ACTIVE')
                })

        # 4. Sprints
        sp_path = os.path.join(db_folder, 'sprints.csv')
        if os.path.exists(sp_path):
            df_sp = pd.read_csv(sp_path)
            for _, row in df_sp.iterrows():
                sname = clean_val(row.get('sprint_name'))
                conn.execute(text('''
                    INSERT INTO sprints (id, project_id, name, sprint_name, start_date, end_date, status, created_at)
                    VALUES (:id, :pid, :name, :sname, :sdate, :edate, :status, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        project_id = EXCLUDED.project_id,
                        name = EXCLUDED.name,
                        sprint_name = EXCLUDED.sprint_name,
                        start_date = EXCLUDED.start_date,
                        end_date = EXCLUDED.end_date,
                        status = EXCLUDED.status
                '''), {
                    'id': clean_val(row.get('sprint_id')),
                    'pid': clean_val(row.get('project_id')),
                    'name': sname,
                    'sname': sname,
                    'sdate': clean_date(row.get('start_date')),
                    'edate': clean_date(row.get('end_date')),
                    'status': clean_val(row.get('status'), 'PLANNED')
                })

        # 5. Issues (exclude empty rows)
        i_path = os.path.join(db_folder, 'issues.csv')
        if os.path.exists(i_path):
            df_i = pd.read_csv(i_path)
            valid_i = df_i[df_i['issue_id'].notna() & (df_i['issue_id'].astype(str).str.strip() != '')]
            for _, row in valid_i.iterrows():
                iid = clean_val(row.get('issue_id'))
                title = clean_val(row.get('title'), 'Untitled Issue')
                desc = clean_val(row.get('description'), '')
                itype = clean_val(row.get('issue_type'), 'Bug')
                sev = clean_val(row.get('severity'), 'Medium')
                priority = clean_val(row.get('priority'), 'P2')
                status = clean_val(row.get('status'), 'Open')
                pid = clean_val(row.get('project_id'))
                assigned_to = clean_val(row.get('assigned_to'))
                created_by = clean_val(row.get('created_by'))
                cdate = clean_date(row.get('created_date'))
                udate = clean_date(row.get('updated_date'))
                comp = clean_val(row.get('component'))
                env = clean_val(row.get('environment'))
                steps = clean_val(row.get('steps_to_reproduce'))
                exp = clean_val(row.get('expected_result'))
                act = clean_val(row.get('actual_result'))
                biz = clean_val(row.get('business_impact'))
                res_sum = clean_val(row.get('resolution_summary'))
                root_cause = clean_val(row.get('root_cause'))
                res_hours = clean_val(row.get('resolution_time_hours'))
                try:
                    res_hours = float(res_hours) if res_hours is not None else None
                except Exception:
                    res_hours = None
                res_date = clean_date(row.get('resolved_date'))
                reopen_cnt = clean_val(row.get('reopen_count'), 0)
                try:
                    reopen_cnt = int(reopen_cnt) if reopen_cnt is not None else 0
                except Exception:
                    reopen_cnt = 0
                is_dup = bool(clean_val(row.get('is_duplicate'), False))
                dup_of = clean_val(row.get('duplicate_of_issue_id'))
                sprint_id = clean_val(row.get('sprint_id'))

                conn.execute(text('''
                    INSERT INTO issues (
                        id, title, description, issue_type, severity, priority, status,
                        project_id, assigned_to, created_by, reported_by, created_date, updated_date,
                        component, environment, steps_to_reproduce, expected_result, actual_result,
                        business_impact, resolution_summary, root_cause, resolution_time_hours,
                        resolved_date, reopen_count, is_duplicate, duplicate_of_issue_id, sprint_id,
                        created_at, updated_at
                    ) VALUES (
                        :id, :title, :desc, :itype, :sev, :priority, :status,
                        :pid, :assigned_to, :created_by, :created_by, :cdate, :udate,
                        :comp, :env, :steps, :exp, :act,
                        :biz, :res_sum, :root_cause, :res_hours,
                        :res_date, :reopen_cnt, :is_dup, :dup_of, :sprint_id,
                        NOW(), NOW()
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        issue_type = EXCLUDED.issue_type,
                        severity = EXCLUDED.severity,
                        priority = EXCLUDED.priority,
                        status = EXCLUDED.status,
                        project_id = EXCLUDED.project_id,
                        assigned_to = EXCLUDED.assigned_to,
                        created_by = EXCLUDED.created_by,
                        reported_by = EXCLUDED.reported_by,
                        created_date = EXCLUDED.created_date,
                        updated_date = EXCLUDED.updated_date,
                        component = EXCLUDED.component,
                        environment = EXCLUDED.environment,
                        steps_to_reproduce = EXCLUDED.steps_to_reproduce,
                        expected_result = EXCLUDED.expected_result,
                        actual_result = EXCLUDED.actual_result,
                        business_impact = EXCLUDED.business_impact,
                        resolution_summary = EXCLUDED.resolution_summary,
                        root_cause = EXCLUDED.root_cause,
                        resolution_time_hours = EXCLUDED.resolution_time_hours,
                        resolved_date = EXCLUDED.resolved_date,
                        reopen_count = EXCLUDED.reopen_count,
                        is_duplicate = EXCLUDED.is_duplicate,
                        duplicate_of_issue_id = EXCLUDED.duplicate_of_issue_id,
                        sprint_id = EXCLUDED.sprint_id
                '''), {
                    'id': iid, 'title': title, 'desc': desc, 'itype': itype, 'sev': sev, 'priority': priority, 'status': status,
                    'pid': pid, 'assigned_to': assigned_to, 'created_by': created_by, 'cdate': cdate, 'udate': udate,
                    'comp': comp, 'env': env, 'steps': steps, 'exp': exp, 'act': act,
                    'biz': biz, 'res_sum': res_sum, 'root_cause': root_cause, 'res_hours': res_hours,
                    'res_date': res_date, 'reopen_cnt': reopen_cnt, 'is_dup': is_dup, 'dup_of': dup_of, 'sprint_id': sprint_id
                })

        trans.commit()
    except Exception as e:
        trans.rollback()
        print(f"Dataset import error: {e}")
    finally:
        conn.close()
