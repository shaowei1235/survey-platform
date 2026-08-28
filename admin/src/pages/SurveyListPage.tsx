import { Button, Space, Table, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api, apiMessageKey } from "../api";
import { canWriteSurvey, type Me } from "../session";

type Row = { id: string; title: string; status: string; updated_at: string };

export function SurveyListPage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const writable = canWriteSurvey(me);

  const load = async () => {
    const { data } = await api.get("/surveys");
    setRows(data.items);
  };

  useEffect(() => {
    void load().catch((e) => message.error(t(apiMessageKey(e))));
  }, [t]);

  const create = async () => {
    try {
      const { data } = await api.post("/surveys", { title: t("survey.newTitle") });
      navigate(`/surveys/${data.id}/edit`);
    } catch (e) {
      message.error(t(apiMessageKey(e)));
    }
  };

  return (
    <>
      {writable ? (
        <Button type="primary" onClick={() => void create()} style={{ marginBottom: 12 }}>
          {t("survey.create")}
        </Button>
      ) : null}
      <Table
        rowKey="id"
        dataSource={rows}
        columns={[
          { title: t("survey.title"), dataIndex: "title" },
          {
            title: t("survey.statusLabel"),
            dataIndex: "status",
            render: (s: string) => <Tag>{t(`survey.status.${s}`)}</Tag>,
          },
          {
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => navigate(`/surveys/${row.id}/edit`)}>
                  {t("survey.edit")}
                </Button>
                {writable && row.status === "draft" ? (
                  <Button
                    size="small"
                    onClick={async () => {
                      try {
                        await api.post(`/surveys/${row.id}/publish`);
                        await load();
                      } catch (e) {
                        message.error(t(apiMessageKey(e)));
                      }
                    }}
                  >
                    {t("survey.publish")}
                  </Button>
                ) : null}
                {writable && row.status === "published" ? (
                  <Button
                    size="small"
                    onClick={async () => {
                      try {
                        await api.post(`/surveys/${row.id}/close`);
                        await load();
                      } catch (e) {
                        message.error(t(apiMessageKey(e)));
                      }
                    }}
                  >
                    {t("survey.close")}
                  </Button>
                ) : null}
              </Space>
            ),
          },
        ]}
      />
    </>
  );
}
