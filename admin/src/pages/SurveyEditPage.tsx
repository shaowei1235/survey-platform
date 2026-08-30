import { ActionCreators } from "redux-undo";
import { Alert, Button, Input, Modal, Space, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiMessageKey } from "../api";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
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
        setLoadError(null);
      })
      .catch((e) => {
        setLoadError(apiMessageKey(e));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
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

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!present.dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [present.dirty]);

  const save = async () => {
    if (saving || locked) return;
    const title = present.title.trim();
    if (!title || title.length > 200) {
      message.error(t("editor.titleLength"));
      return;
    }
    const component_list = withNormalizedChoices(present.componentList);
    const invalid = validateComponentList(component_list);
    if (invalid) {
      message.error(t(invalid));
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/surveys/${id}`, { title: present.title, component_list });
      dispatch(editorActions.markSaved());
      message.success(t("survey.save"));
    } catch (e) {
      message.error(t(apiMessageKey(e)));
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    if (!present.dirty) {
      navigate("/surveys");
      return;
    }
    Modal.confirm({
      title: t("survey.unsavedConfirm"),
      okText: t("editor.leave"),
      cancelText: t("common.cancel"),
      onOk: () => navigate("/surveys"),
    });
  };

  if (loading) return <LoadingState />;
  if (loadError) {
    return (
      <ErrorState message={t(loadError)} onRetry={load} retryLabel={t("common.retry")} />
    );
  }

  return (
    <div className="editor-page">
      <PageHeader
        title={
          <span className="editor-page-heading">
            {t("survey.edit")}
            <StatusTag status={present.status} />
          </span>
        }
        description={t("editor.pageDescription")}
        onBack={back}
        backLabel={t("editor.back")}
        extra={
          <Space wrap>
            <Button disabled={locked || !canUndo} onClick={() => dispatch(ActionCreators.undo())}>
              {t("editor.undo")}
            </Button>
            <Button disabled={locked || !canRedo} onClick={() => dispatch(ActionCreators.redo())}>
              {t("editor.redo")}
            </Button>
            <Button type="primary" disabled={locked} loading={saving} onClick={() => void save()}>
              {t("survey.save")}
            </Button>
          </Space>
        }
      />
      {lockMessage ? <Alert className="editor-lock-alert" type="info" showIcon message={t(lockMessage)} /> : null}
      <SurveyEditor locked={locked} />
    </div>
  );
}
