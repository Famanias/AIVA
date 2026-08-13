import os

def get_project_storage_dir(project_id: str) -> str:
    """
    Deterministically resolves the absolute path to the project storage directory.
    Guarantees consistent storage across workers regardless of working directory.
    """
    if os.getenv("STORAGE_DIR"):
        path = os.path.abspath(os.path.join(os.getenv("STORAGE_DIR"), "projects", project_id))
        os.makedirs(path, exist_ok=True)
        return path

    cwd = os.path.abspath(os.getcwd())
    if os.path.exists(os.path.join(cwd, "storage", "audio")):
        # We are at repository root
        path = os.path.abspath(os.path.join(cwd, "storage", "projects", project_id))
    elif os.path.exists(os.path.abspath(os.path.join(cwd, "..", "..", "storage", "audio"))):
        # We are inside apps/workers
        path = os.path.abspath(os.path.join(cwd, "..", "..", "storage", "projects", project_id))
    else:
        # Fallback relative to this file's location
        path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "storage", "projects", project_id))

    os.makedirs(path, exist_ok=True)
    return path
