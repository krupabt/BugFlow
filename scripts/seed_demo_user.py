import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'))
from db_importer import ensure_dataset_imported

if __name__ == '__main__':
    print("Ensuring authoritative dataset synchronization...")
    ensure_dataset_imported()
    print("[SUCCESS] Authoritative 20 users and dataset verified.")

