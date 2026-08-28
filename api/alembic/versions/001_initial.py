revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None

from alembic import op

DDL = """
CREATE TYPE user_generation AS ENUM ('20s', '30s', '40s', '50s', '60s_plus');
CREATE TYPE user_role_code AS ENUM (
  'system_admin', 'hr_planner', 'executive', 'dept_manager', 'employee'
);
CREATE TYPE survey_status AS ENUM ('draft', 'published', 'closed');
CREATE TYPE ai_run_kind AS ENUM ('intent', 'free_text_summary');
CREATE TYPE ai_run_status AS ENUM ('succeeded', 'failed');

CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE departments (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  parent_id UUID REFERENCES departments(id),
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_departments_company ON departments(company_id, parent_id);

CREATE TABLE job_grades (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  employee_no VARCHAR(32) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id),
  job_grade_id UUID NOT NULL REFERENCES job_grades(id),
  generation user_generation NOT NULL,
  external_hr_id VARCHAR(64),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_no)
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role_code NOT NULL,
  department_id UUID REFERENCES departments(id),
  UNIQUE (user_id, role, department_id)
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX ix_refresh_user ON refresh_tokens(user_id);

CREATE TABLE surveys (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  title VARCHAR(200) NOT NULL,
  status survey_status NOT NULL DEFAULT 'draft',
  component_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE responses (
  id UUID PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES surveys(id),
  user_id UUID NOT NULL REFERENCES users(id),
  department_id UUID NOT NULL REFERENCES departments(id),
  job_grade_id UUID NOT NULL REFERENCES job_grades(id),
  generation user_generation NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survey_id, user_id)
);
CREATE INDEX ix_responses_survey_dept ON responses(survey_id, department_id);

CREATE TABLE answer_items (
  id UUID PRIMARY KEY,
  response_id UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  fe_id VARCHAR(40) NOT NULL,
  type VARCHAR(32) NOT NULL,
  value JSONB NOT NULL,
  UNIQUE (response_id, fe_id)
);

CREATE TABLE ai_runs (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  survey_id UUID NOT NULL REFERENCES surveys(id),
  requester_id UUID NOT NULL REFERENCES users(id),
  kind ai_run_kind NOT NULL,
  intent VARCHAR(64),
  department_id UUID REFERENCES departments(id),
  query_snapshot JSONB NOT NULL,
  evidence JSONB,
  conclusion TEXT,
  model VARCHAR(128),
  status ai_run_status NOT NULL,
  error_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_ai_runs_survey ON ai_runs(survey_id, created_at DESC);
"""


def upgrade() -> None:
    op.execute(DDL)


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS ai_runs, answer_items, responses, surveys, refresh_tokens, user_roles, users, job_grades, departments, companies CASCADE;
        DROP TYPE IF EXISTS ai_run_status, ai_run_kind, survey_status, user_role_code, user_generation;
        """
    )
