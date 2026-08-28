import { DndContext, type DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Card, Checkbox, Form, Input, InputNumber, Space, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { editorActions, type RootState } from "../store";
import type { ComponentItem } from "../session";

const PALETTE = ["title", "paragraph", "radio", "checkbox", "input", "textarea"] as const;

function SortableRow({ item, selected, locked }: { item: ComponentItem; selected: boolean; locked: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.fe_id, disabled: locked });
  const dispatch = useDispatch();
  const style = { transform: CSS.Transform.toString(transform), transition };
  const title = String(item.props.title ?? item.type);
  return (
    <div ref={setNodeRef} style={style}>
      <Card
        size="small"
        onClick={() => dispatch(editorActions.select(item.fe_id))}
        style={{ marginBottom: 8, borderColor: selected ? "#1677ff" : undefined, cursor: locked ? "default" : "grab" }}
        {...attributes}
        {...listeners}
      >
        <Typography.Text type="secondary">{item.type}</Typography.Text>
        <div>{title}</div>
      </Card>
    </div>
  );
}

export function SurveyEditor({ locked }: { locked: boolean }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const present = useSelector((s: RootState) => s.editor.present);
  const selected = present.componentList.find((c) => c.fe_id === present.selectedFeId);

  const onDragEnd = (event: DragEndEvent) => {
    if (locked) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = present.componentList.findIndex((c) => c.fe_id === active.id);
    const to = present.componentList.findIndex((c) => c.fe_id === over.id);
    if (from >= 0 && to >= 0) dispatch(editorActions.moveComponent({ from, to }));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 280px", gap: 12, minHeight: 480 }}>
      <Card title={t("editor.palette")} size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          {PALETTE.map((type) => (
            <Button key={type} block disabled={locked} onClick={() => dispatch(editorActions.addComponent(type))}>
              {t(`editor.${type}`)}
            </Button>
          ))}
        </Space>
      </Card>
      <Card title={t("editor.canvas")} size="small">
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={present.componentList.map((c) => c.fe_id)} strategy={verticalListSortingStrategy}>
            {present.componentList.map((item) => (
              <SortableRow key={item.fe_id} item={item} selected={item.fe_id === present.selectedFeId} locked={locked} />
            ))}
          </SortableContext>
        </DndContext>
      </Card>
      <Card title={t("editor.props")} size="small">
        {selected ? (
          <Form layout="vertical" disabled={locked} key={selected.fe_id}>
            <Form.Item label={t("survey.title")}>
              <Input
                value={String(selected.props.title ?? "")}
                onChange={(e) =>
                  dispatch(editorActions.updateProps({ fe_id: selected.fe_id, props: { ...selected.props, title: e.target.value } }))
                }
              />
            </Form.Item>
            {"required" in selected.props ? (
              <Form.Item>
                <Checkbox
                  checked={Boolean(selected.props.required)}
                  onChange={(e) =>
                    dispatch(
                      editorActions.updateProps({ fe_id: selected.fe_id, props: { ...selected.props, required: e.target.checked } }),
                    )
                  }
                >
                  {t("editor.required")}
                </Checkbox>
              </Form.Item>
            ) : null}
            {selected.type === "radio" ? (
              <Form.Item>
                <Checkbox
                  checked={Boolean(selected.props.scoreEnabled)}
                  onChange={(e) =>
                    dispatch(
                      editorActions.updateProps({
                        fe_id: selected.fe_id,
                        props: { ...selected.props, scoreEnabled: e.target.checked },
                      }),
                    )
                  }
                >
                  {t("editor.scoreEnabled")}
                </Checkbox>
              </Form.Item>
            ) : null}
            {typeof selected.props.maxLength === "number" ? (
              <Form.Item label="maxLength">
                <InputNumber
                  value={Number(selected.props.maxLength)}
                  onChange={(value) =>
                    dispatch(
                      editorActions.updateProps({
                        fe_id: selected.fe_id,
                        props: { ...selected.props, maxLength: value ?? 200 },
                      }),
                    )
                  }
                />
              </Form.Item>
            ) : null}
            <Button danger disabled={locked} onClick={() => dispatch(editorActions.removeComponent(selected.fe_id))}>
              {t("editor.delete")}
            </Button>
          </Form>
        ) : null}
      </Card>
    </div>
  );
}
