import subprocess
import os

env = os.environ.copy()
env['PGPASSWORD'] = 'krupa'

backup_file = os.path.abspath('database/backup_before_cleanup.sql')
pg_dump_path = r'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe'

cmd = [
    pg_dump_path,
    '-U', 'postgres',
    '-h', 'localhost',
    '-p', '5432',
    '-F', 'p',
    '-f', backup_file,
    'bugflow_db'
]

print(f"Creating backup to: {backup_file}")
res = subprocess.run(cmd, env=env, capture_output=True, text=True)
if res.returncode == 0:
    print(f"SUCCESS: Backup completed. File size: {os.path.getsize(backup_file)} bytes")
else:
    print(f"ERROR: {res.stderr}")
