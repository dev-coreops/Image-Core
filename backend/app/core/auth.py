from fastapi import Request


def get_current_user(request: Request) -> str:
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return "dev-user-001"
    return user_id


def get_organization_id(request: Request) -> str:
    org_id = request.headers.get("X-Organization-ID")
    if not org_id:
        return "dev-org-001"
    return org_id


def get_project_id(request: Request) -> str:
    project_id = request.headers.get("X-Project-ID")
    if not project_id:
        return "dev-project-001"
    return project_id
