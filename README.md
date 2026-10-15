# BugFlow — Intelligent Software Defect Tracking System with Resolution Assistance

> **Tagline:** Better tracking. Faster resolution.

BugFlow is a full-stack, enterprise-grade software defect tracking system with built-in machine-learning resolution assistance powered by TF-IDF and cosine similarity.

---

## 1. System Architecture

* **Frontend:** React (Vite), modern responsive CSS, Recharts analytics
* **Backend:** Python (Flask), Flask-SQLAlchemy, Werkzeug password hashing, Flask-JWT-Extended
* **Database:** PostgreSQL 17 (`bugflow_db`)
* **Resolution Engine:** Scikit-learn (TF-IDF vectorizer + Cosine Similarity)
* **Dataset:** 2,500 real Apache defect issues (`dataset/apache_jira_sample.csv`)

---

## 2. Directory Structure

```text
D:\BugFlow\
├── backend\
│   ├── app\
│   │   ├── models\         # SQLAlchemy database models
│   │   │   ├── user.py     # Users & RBAC (Admin, Developer, Reporter)
│   │   │   ├── project.py  # Projects & member associations
│   │   │   ├── issue.py    # Issues & defects with historical flag
│   │   │   ├── comment.py  # Issue discussions
│   │   │   └── history.py  # Status transition audit log
│   │   ├── routes\         # REST API blueprints (Auth, Issues, Projects, Stats)
│   │   ├── services\       # Resolution recommendation engine
│   │   ├── config.py       # Environment configuration loader
│   │   ├── extensions.py   # Flask extensions (DB, JWT, CORS)
│   │   └── __init__.py     # Flask Application Factory
│   ├── run.py              # Server entry point
│   ├── requirements.txt    # Python package dependencies
│   ├── .env.example        # Environment variables template
│   └── .env                # Local secrets (never committed to git)
├── dataset\
│   └── apache_jira_sample.csv  # 2,500 real Apache defect reports (3.67 MB)
├── scripts\
│   ├── fetch_apache_sample.py  # Pulls issues from Apache Jira REST API
│   ├── test_db_connection.py   # Verifies PostgreSQL connection & creates tables
│   └── import_dataset.py       # Streams and loads historical dataset into PostgreSQL
├── .gitignore
└── README.md
```

---

## 3. Quick Start (Windows PowerShell)

### Step 1: Configure Your PostgreSQL Password
Open `D:\BugFlow\backend\.env` in any text editor and set your PostgreSQL password:
```env
DB_PASSWORD=your_actual_password_here
```

### Step 2: Test Database Connection & Create Tables
In PowerShell:
```powershell
D:\BugFlow\backend\venv\Scripts\python.exe D:\BugFlow\scripts\test_db_connection.py
```

### Step 3: Start the Backend Server
```powershell
D:\BugFlow\backend\venv\Scripts\python.exe D:\BugFlow\backend\run.py
```
Backend health check is accessible at: `http://localhost:5000/api/health`
