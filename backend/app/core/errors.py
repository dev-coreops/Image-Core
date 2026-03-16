from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class ProblemDetail(HTTPException):
    def __init__(
        self,
        status_code: int,
        detail: str,
        title: str | None = None,
        instance: str | None = None,
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.title = title or detail
        self.instance = instance


async def problem_detail_handler(request: Request, exc: ProblemDetail) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "type": "about:blank",
            "title": exc.title,
            "status": exc.status_code,
            "detail": exc.detail,
            "instance": exc.instance or str(request.url),
        },
    )
