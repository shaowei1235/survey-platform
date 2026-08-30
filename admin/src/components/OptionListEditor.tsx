import { Button, Input, InputNumber, Space, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { parseOptions, withoutScore, type ChoiceOption } from "../choiceOptions";
import { editorActions } from "../store";

type Props = {
  feId: string;
  type: string;
  componentProps: Record<string, unknown>;
  locked: boolean;
};

export function OptionListEditor({ feId, type, componentProps, locked }: Props) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const options = parseOptions(componentProps);
  const scoreEnabled = type === "radio" && Boolean(componentProps.scoreEnabled);

  const setOptions = (next: ChoiceOption[]) => {
    dispatch(editorActions.updateProps({ fe_id: feId, props: { ...componentProps, options: next } }));
  };

  const replaceAt = (index: number, next: ChoiceOption) => {
    setOptions(options.map((opt, i) => (i === index ? next : opt)));
  };

  const add = () => {
    dispatch(editorActions.addChoiceOption({ fe_id: feId, label: t("editor.newOption") }));
  };

  return (
    <div>
      <Typography.Text>{t("editor.options")}</Typography.Text>
      <Space direction="vertical" className="option-list" size="small">
        {options.map((opt, index) => (
          <div key={`${feId}-${index}`} className="option-row">
            <Input
              disabled={locked}
              value={opt.label}
              placeholder={t("editor.optionLabel")}
              aria-label={t("editor.optionLabel")}
              style={{ marginBottom: 8 }}
              onChange={(e) => replaceAt(index, { ...opt, label: e.target.value })}
            />
            <Space wrap>
              <Input
                disabled={locked}
                value={opt.value}
                placeholder={t("editor.optionValue")}
                aria-label={t("editor.optionValue")}
                style={{ width: 96 }}
                onChange={(e) => replaceAt(index, { ...opt, value: e.target.value })}
              />
              {scoreEnabled ? (
                <InputNumber
                  disabled={locked}
                  value={typeof opt.score === "number" ? opt.score : null}
                  placeholder={t("editor.optionScore")}
                  aria-label={t("editor.optionScore")}
                  precision={0}
                  style={{ width: 88 }}
                  onChange={(value) => {
                    if (typeof value === "number" && Number.isInteger(value)) {
                      replaceAt(index, { ...opt, score: value });
                      return;
                    }
                    replaceAt(index, withoutScore(opt));
                  }}
                />
              ) : null}
              <Button
                danger
                size="small"
                disabled={locked || options.length <= 2}
                onClick={() => dispatch(editorActions.removeChoiceOption({ fe_id: feId, index }))}
              >
                {t("editor.delete")}
              </Button>
            </Space>
          </div>
        ))}
        <Button block disabled={locked} onClick={add}>
          {t("editor.addOption")}
        </Button>
      </Space>
    </div>
  );
}
