from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    employee_no: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshIn(BaseModel):
    refresh_token: str


class RoleOut(BaseModel):
    role: str
    department_id: UUID | None


class MeOut(BaseModel):
    id: UUID
    employee_no: str
    display_name: str
    company_id: UUID
    department_id: UUID
    job_grade_id: UUID
    generation: str
    roles: list[RoleOut]
    scope_department_ids: list[UUID]


class DepartmentIn(BaseModel):
    parent_id: UUID | None = None
    name: str = Field(min_length=1, max_length=100)
    sort_order: int = 0


class DepartmentPatch(BaseModel):
    parent_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=100)
    sort_order: int | None = None
    is_active: bool | None = None


class DepartmentOut(BaseModel):
    id: UUID
    parent_id: UUID | None
    name: str
    sort_order: int
    is_active: bool


class RoleIn(BaseModel):
    role: str
    department_id: UUID | None = None


class UserCreate(BaseModel):
    employee_no: str = Field(pattern=r"^[A-Za-z0-9_-]{1,32}$")
    display_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    department_id: UUID
    job_grade_id: UUID
    generation: Literal["20s", "30s", "40s", "50s", "60s_plus"]
    roles: list[RoleIn] = Field(min_length=1)


class UserPatch(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    department_id: UUID | None = None
    job_grade_id: UUID | None = None
    generation: Literal["20s", "30s", "40s", "50s", "60s_plus"] | None = None
    roles: list[RoleIn] | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    id: UUID
    employee_no: str
    display_name: str
    department_id: UUID
    job_grade_id: UUID
    generation: str
    is_active: bool
    roles: list[RoleOut]


class PageOut(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int


class SurveyCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class SurveyPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    component_list: list[dict] | None = None


class SurveyOut(BaseModel):
    id: UUID
    title: str
    status: str
    component_list: list
    published_at: datetime | None
    closed_at: datetime | None
    updated_at: datetime | None


class SurveyListItem(BaseModel):
    id: UUID
    title: str
    status: str
    updated_at: datetime | None
    published_at: datetime | None = None
    closed_at: datetime | None = None
    response_count: int = 0


class AnswerIn(BaseModel):
    fe_id: str
    type: str
    value: Any


class SubmitIn(BaseModel):
    answers: list[AnswerIn]


class CrossTabQuery(BaseModel):
    survey_id: UUID
    department_id: UUID | None = None
    generation: Literal["20s", "30s", "40s", "50s", "60s_plus"] | None = None
    job_grade_id: UUID | None = None


class IntentIn(BaseModel):
    survey_id: UUID
    intent: str
    department_id: UUID


class SummaryIn(BaseModel):
    survey_id: UUID
    department_id: UUID
