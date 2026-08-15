import os

def get_storage_root() -> str:
    """
    Deterministically resolves the absolute path to the root storage directory.
    Works consistently across execution from repo root, apps/workers, or subdirectories.
    """
    if os.getenv("STORAGE_DIR"):
        return os.path.abspath(os.getenv("STORAGE_DIR"))

    cwd = os.path.abspath(os.getcwd())
    if os.path.exists(os.path.join(cwd, "storage")):
        return os.path.join(cwd, "storage")
    if os.path.exists(os.path.abspath(os.path.join(cwd, "..", "..", "storage"))):
        return os.path.abspath(os.path.join(cwd, "..", "..", "storage"))

    # Fallback relative to this file's location (apps/workers/app/core/storage.py -> 4 levels up to root)
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "storage"))


def get_project_storage_dir(project_id: str) -> str:
    """
    Deterministically resolves the absolute path to the project storage directory.
    Guarantees consistent storage across workers regardless of working directory.
    """
    root = get_storage_root()
    path = os.path.join(root, "projects", project_id)
    os.makedirs(path, exist_ok=True)
    return path

