"use client";

import { Checkbox, Input, Radio, Space, Typography } from "antd";

export type FillComponent = { fe_id: string; type: string; props: Record<string, unknown> };

type Props = {
  item: FillComponent;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
};

export function AnswerField({ item, value, onChange, error }: Props) {
  const title = String(item.props.title ?? "");
  const required = Boolean(item.props.required);
  const heading = (
    <Typography.Paragraph strong>
      {title}
      {required ? " *" : ""}
    </Typography.Paragraph>
  );
  const errorText = error ? (
    <Typography.Text type="danger" className="answer-field-error">
      {error}
    </Typography.Text>
  ) : null;

  if (item.type === "title") {
    return <Typography.Title level={4}>{title}</Typography.Title>;
  }
  if (item.type === "paragraph") {
    return <Typography.Paragraph>{title}</Typography.Paragraph>;
  }
  if (item.type === "radio") {
    const options = (item.props.options as { value: string; label: string }[]) ?? [];
    return (
      <div className="answer-field client-choice">
        {heading}
        <Radio.Group
          value={typeof value === "string" || typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <Space direction="vertical">
            {options.map((o) => (
              <Radio key={o.value} value={o.value}>
                {o.label}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
        {errorText}
      </div>
    );
  }
  if (item.type === "checkbox") {
    const options = (item.props.options as { value: string; label: string }[]) ?? [];
    return (
      <div className="answer-field client-choice">
        {heading}
        <Checkbox.Group
          value={(value as string[]) ?? []}
          options={options.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => onChange(v)}
        />
        {errorText}
      </div>
    );
  }
  if (item.type === "input") {
    return (
      <div className="answer-field">
        {heading}
        <Input
          status={error ? "error" : undefined}
          maxLength={Number(item.props.maxLength) || 200}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {errorText}
      </div>
    );
  }
  if (item.type === "textarea") {
    return (
      <div className="answer-field">
        {heading}
        <Input.TextArea
          status={error ? "error" : undefined}
          maxLength={Number(item.props.maxLength) || 2000}
          rows={4}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {errorText}
      </div>
    );
  }
  return null;
}
