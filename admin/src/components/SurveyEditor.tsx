import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Card, Checkbox, Form, Input, InputNumber, Space, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { editorActions, type RootState } from "../store";
import type { ComponentItem } from "../session";
import { OptionListEditor } from "./OptionListEditor";

const PALETTE = ["title", "paragraph", "radio", "checkbox", "input", "textarea"] as const;
const PALETTE_PREFIX = "palette:";
const CANVAS_END = "canvas-end";

function paletteType(id: string): string | null {
  return id.startsWith(PALETTE_PREFIX) ? id.slice(PALETTE_PREFIX.length) : null;
}

function PaletteButton({ type, locked }: { type: (typeof PALETTE)[number]; locked: boolean }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `${PALETTE_PREFIX}${type}`,
    data: { type, fromPalette: true },
    disabled: locked,
  });
  return (
    <Button
      ref={setNodeRef}
      block
      disabled={locked}
      onClick={() => dispatch(editorActions.addComponent(type))}
      {...listeners}
      {...attributes}
    >
      {t(`editor.${type}`)}
    </Button>
  );
}

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

function CanvasEnd({ locked, empty }: { locked: boolean; empty: boolean }) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_END, disabled: locked });
  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: empty ? 120 : 28,
        borderRadius: 6,
        border: empty || isOver ? "1px dashed #d9d9d9" : undefined,
        background: isOver ? "#e6f4ff" : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
      }}
    >
      {empty ? <Typography.Text type="secondary">{t("editor.dropHint")}</Typography.Text> : null}
    </div>
  );
}

export function SurveyEditor({ locked }: { locked: boolean }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const present = useSelector((s: RootState) => s.editor.present);
  const selected = present.componentList.find((c) => c.fe_id === present.selectedFeId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [overlayType, setOverlayType] = useState<string | null>(null);

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    const type = paletteType(id);
    if (type) {
      setOverlayType(type);
      return;
    }
    setOverlayType(null);
    dispatch(editorActions.select(id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setOverlayType(null);
    if (locked) return;
    const { active, over } = event;
    if (!over) return;
    const type = paletteType(String(active.id));
    if (type) {
      if (String(over.id) === CANVAS_END) {
        dispatch(editorActions.addComponent(type));
        return;
      }
      const index = present.componentList.findIndex((c) => c.fe_id === over.id);
      if (index >= 0) dispatch(editorActions.insertComponent({ type, index }));
      return;
    }
    if (active.id === over.id) return;
    const from = present.componentList.findIndex((c) => c.fe_id === active.id);
    const to = present.componentList.findIndex((c) => c.fe_id === over.id);
    if (from >= 0 && to >= 0) dispatch(editorActions.moveComponent({ from, to }));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 320px", gap: 12, minHeight: 480 }}>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, gridColumn: "1 / 3" }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setOverlayType(null)}
        >
          <Card title={t("editor.palette")} size="small">
            <Space direction="vertical" style={{ width: "100%" }}>
              {PALETTE.map((type) => (
                <PaletteButton key={type} type={type} locked={locked} />
              ))}
            </Space>
          </Card>
          <Card title={t("editor.canvas")} size="small">
            <SortableContext items={present.componentList.map((c) => c.fe_id)} strategy={verticalListSortingStrategy}>
              {present.componentList.map((item) => (
                <SortableRow key={item.fe_id} item={item} selected={item.fe_id === present.selectedFeId} locked={locked} />
              ))}
              <CanvasEnd locked={locked} empty={present.componentList.length === 0} />
            </SortableContext>
          </Card>
          <DragOverlay>
            {overlayType ? (
              <Card size="small" style={{ width: 180, opacity: 0.9 }}>
                {t(`editor.${overlayType}`)}
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      <Card title={t("editor.props")} size="small" styles={{ body: { maxHeight: 640, overflow: "auto" } }}>
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
            {selected.type === "radio" || selected.type === "checkbox" ? (
              <Form.Item>
                <OptionListEditor
                  feId={selected.fe_id}
                  type={selected.type}
                  componentProps={selected.props}
                  locked={locked}
                />
              </Form.Item>
            ) : null}
            <Button danger disabled={locked} onClick={() => dispatch(editorActions.removeComponent(selected.fe_id))}>
              {t("editor.delete")}
            </Button>
          </Form>
        ) : (
          <Typography.Text type="secondary">{t("editor.selectHint")}</Typography.Text>
        )}
      </Card>
    </div>
  );
}
