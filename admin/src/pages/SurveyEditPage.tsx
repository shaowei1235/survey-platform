import { ActionCreators } from "redux-undo";
import { Alert, Button, Modal, Popconfirm, Space, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiMessageKey, isReauthRedirecting } from "../api";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import { SurveyEditor } from "../components/SurveyEditor";
import { SurveyFillPreview } from "../components/SurveyFillPreview";
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
  const [acting, setActing] = useState<"publish" | "close" | "delete" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const busy = saving || acting !== null;

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
        if (!isReauthRedirecting()) setLoadError(apiMessageKey(e));
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

  const persist = async (): Promise<boolean> => {
    if (locked) return false;
    const title = present.title.trim();
    if (!title || title.length > 200) {
      message.error(t("editor.titleLength"));
      return false;
    }
    const component_list = withNormalizedChoices(present.componentList);
    const invalid = validateComponentList(component_list);
    if (invalid) {
      message.error(t(invalid));
      return false;
    }
    await api.patch(`/surveys/${id}`, { title: present.title, component_list });
    dispatch(editorActions.markSaved());
    return true;
  };

  const save = async () => {
    if (busy || locked) return;
    setSaving(true);
    try {
      const ok = await persist();
      if (ok) message.success(t("survey.save"));
    } catch (e) {
      if (!isReauthRedirecting()) message.error(t(apiMessageKey(e)));
    } finally {
      setSaving(false);
    }
  };

  const runStatusAction = async (action: "publish" | "close") => {
    if (busy) return;
    setActing(action);
    try {
      if (action === "publish" && present.dirty) {
        const ok = await persist();
        if (!ok) return;
      }
      const { data } = await api.post(`/surveys/${id}/${action}`);
      dispatch(
        editorActions.hydrate({
          surveyId: data.id,
          title: data.title,
          status: data.status,
          componentList: data.component_list ?? present.componentList,
        }),
      );
    } catch (e) {
      if (!isReauthRedirecting()) message.error(t(apiMessageKey(e)));
    } finally {
      setActing(null);
    }
  };

  const runDelete = async () => {
    if (busy || present.status !== "draft") return;
    setActing("delete");
    try {
      await api.delete(`/surveys/${id}`);
      navigate("/surveys");
    } catch (e) {
      if (!isReauthRedirecting()) message.error(t(apiMessageKey(e)));
    } finally {
      setActing(null);
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
            <Button onClick={() => setPreviewOpen(true)}>{t("editor.preview")}</Button>
            <Button disabled={locked || !canUndo} onClick={() => dispatch(ActionCreators.undo())}>
              {t("editor.undo")}
            </Button>
            <Button disabled={locked || !canRedo} onClick={() => dispatch(ActionCreators.redo())}>
              {t("editor.redo")}
            </Button>
            <Button type="primary" disabled={locked} loading={saving} onClick={() => void save()}>
              {t("survey.save")}
            </Button>
            {writable && present.status === "draft" ? (
              <Popconfirm
                title={t("survey.publishConfirm.title")}
                description={t("survey.publishConfirm.description")}
                okText={t("survey.publish")}
                cancelText={t("common.cancel")}
                onConfirm={() => void runStatusAction("publish")}
              >
                <Button loading={acting === "publish"} disabled={busy}>
                  {t("survey.publish")}
                </Button>
              </Popconfirm>
            ) : null}
            {writable && present.status === "published" ? (
              <Popconfirm
                title={t("survey.closeConfirm.title")}
                description={t("survey.closeConfirm.description")}
                okText={t("survey.close")}
                cancelText={t("common.cancel")}
                onConfirm={() => void runStatusAction("close")}
              >
                <Button danger loading={acting === "close"} disabled={busy}>
                  {t("survey.close")}
                </Button>
              </Popconfirm>
            ) : null}
            {writable && present.status === "draft" ? (
              <Popconfirm
                title={t("survey.deleteConfirm.title")}
                description={t("survey.deleteConfirm.description")}
                okText={t("survey.delete")}
                cancelText={t("common.cancel")}
                okButtonProps={{ danger: true }}
                onConfirm={() => void runDelete()}
              >
                <Button danger loading={acting === "delete"} disabled={busy}>
                  {t("survey.delete")}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        }
      />
      {lockMessage ? <Alert className="editor-lock-alert" type="info" showIcon message={t(lockMessage)} /> : null}
      <SurveyEditor locked={locked} />
      <SurveyFillPreview
        open={previewOpen}
        title={present.title.trim() || t("survey.newTitle")}
        components={present.componentList}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
