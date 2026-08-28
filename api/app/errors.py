ERROR_KEYS = {
    "VALIDATION_ERROR": ("error.validation", 400),
    "UNKNOWN_INTENT": ("error.unknown_intent", 400),
    "INVALID_COMPONENT": ("error.invalid_component", 400),
    "UNAUTHENTICATED": ("error.unauthenticated", 401),
    "INVALID_CREDENTIALS": ("error.invalid_credentials", 401),
    "FORBIDDEN_ROLE": ("error.forbidden_role", 403),
    "FORBIDDEN_SCOPE": ("error.forbidden_scope", 403),
    "NOT_FOUND": ("error.not_found", 404),
    "SURVEY_NOT_EDITABLE": ("error.survey_not_editable", 409),
    "ALREADY_SUBMITTED": ("error.already_submitted", 409),
    "NOT_PUBLISHED": ("error.not_published", 409),
    "AI_UPSTREAM_FAILED": ("error.ai_upstream", 502),
    "AI_TIMEOUT": ("error.ai_timeout", 503),
    "AI_NUMBER_MISMATCH": ("error.ai_number_mismatch", 502),
}


class ApiError(Exception):
    def __init__(self, error_code: str, status_code: int | None = None) -> None:
        message_key, default_status = ERROR_KEYS[error_code]
        super().__init__(error_code)
        self.error_code = error_code
        self.message_key = message_key
        self.status_code = status_code or default_status
