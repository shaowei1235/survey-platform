import { ActionCreators } from "redux-undo";
import { Alert, Button, Input, Space, Tag, message } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiMessageKey } from "../api";
import { SurveyEditor } from "../components/SurveyEditor";
import { editorActions, type RootState } from "../store";
import { validateComponentList, withNormalizedChoices } from "../choiceOptions";
import { canWriteSurvey, type Me } from "../session";

function lockMessageKey(status: string, writable: boolean): string | null {
  if (status === "published") return "editor.readOnlyPublished";
  if (status === "closed") return "editor.readOnlyClosed";
  if (!writable) return "editor.readOnlyNoRole";
  return null;
}

export function SurveyEditPage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const present = useSelector((s: RootState) => s.editor.present);
  const canUndo = useSelector((s: RootState) => s.editor.past.length > 0);
  const canRedo = useSelector((s: RootState) => s.editor.future.length > 0);
  const writable = canWriteSurvey(me);
  const locked = present.status !== "draft" || !writable;
  const lockMessage = lockMessageKey(present.status, writable);

  useEffect(() => {
    if (!id) return;
    void api
      .get(`/surveys/${id}`)
      .then(({ data }) => {
        dispatch(
          editorActions.hydrate({
            surveyId: data.id,
            title: data.title,
            status: data.status,
            componentList: data.component_list ?? [],
          }),
        );
      })
      .catch((e) => message.error(t(apiMessageKey(e))));
  }, [id, dispatch, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) dispatch(ActionCreators.redo());
        else dispatch(ActionCreators.undo());
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch(ActionCreators.redo());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, locked]);

  const save = async () => {
    const component_list = withNormalizedChoices(present.componentList);
    const invalid = validateComponentList(component_list);
    if (invalid) {
      message.error(t(invalid));
      return;
    }
    try {
      await api.patch(`/surveys/${id}`, { title: present.title, component_list });
      dispatch(editorActions.markSaved());
      message.success(t("survey.save"));
    } catch (e) {
      message.error(t(apiMessageKey(e)));
    }
  };

  const back = () => {
    if (present.dirty && !window.confirm(t("survey.unsavedConfirm"))) return;
    navigate("/surveys");
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      {lockMessage ? <Alert type="info" showIcon message={t(lockMessage)} /> : null}
      <Space wrap>
        <Input
          style={{ width: 360 }}
          disabled={locked}
          value={present.title}
          onChange={(e) => dispatch(editorActions.setTitle(e.target.value))}
        />
        <Tag>{t(`survey.status.${present.status}`)}</Tag>
        <Button disabled={locked || !canUndo} onClick={() => dispatch(ActionCreators.undo())}>
          {t("editor.undo")}
        </Button>
        <Button disabled={locked || !canRedo} onClick={() => dispatch(ActionCreators.redo())}>
          {t("editor.redo")}
        </Button>
        <Button type="primary" disabled={locked} onClick={() => void save()}>
          {t("survey.save")}
        </Button>
        <Button onClick={back}>{t("nav.surveys")}</Button>
      </Space>
      <SurveyEditor locked={locked} />
    </Space>
  );
}
