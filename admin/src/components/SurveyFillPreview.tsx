import { Alert, Drawer, Grid } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SurveyFillView } from "@survey-fill/SurveyFillView";
import type { ComponentItem } from "../session";
import "@survey-fill/survey-fill.css";

type SurveyFillPreviewProps = {
  open: boolean;
  title: string;
  components: ComponentItem[];
  onClose: () => void;
};

export function SurveyFillPreview({ open, title, components, onClose }: SurveyFillPreviewProps) {
  const { t } = useTranslation();
  const screens = Grid.useBreakpoint();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [fillKey, setFillKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setValues({});
    setFillKey((k) => k + 1);
  }, [open]);

  return open ? (
    <Drawer
      className="survey-preview-drawer"
      title={t("editor.preview")}
      open
      onClose={onClose}
      width={screens.md === false ? "100%" : 720}
      destroyOnClose
      getContainer={() => document.body}
    >
      <SurveyFillView
        key={fillKey}
        title={title}
        components={components}
        values={values}
        onChange={(feId, value) => setValues((prev) => ({ ...prev, [feId]: value }))}
        labels={{
          progress: t("editor.previewProgress"),
          answered: t("editor.previewAnswered"),
          noQuestions: t("editor.previewEmpty"),
        }}
        banner={<Alert className="fill-attr-alert" type="info" showIcon message={t("editor.previewHint")} />}
      />
    </Drawer>
  ) : null;
}
