import {
  AlignLeftOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  EditOutlined,
  FontSizeOutlined,
  FormOutlined,
  HolderOutlined,
} from "@ant-design/icons";
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
import { Button, Checkbox, Drawer, Form, Grid, Input, InputNumber } from "antd";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { editorActions, type RootState } from "../store";
import type { ComponentItem } from "../session";
import { EmptyState } from "./EmptyState";
import { OptionListEditor } from "./OptionListEditor";

const PALETTE = ["title", "paragraph", "radio", "checkbox", "input", "textarea"] as const;
const PALETTE_PREFIX = "palette:";
const CANVAS_END = "canvas-end";

const PALETTE_ICONS: Record<(typeof PALETTE)[number], ReactNode> = {
  title: <FontSizeOutlined />,
  paragraph: <AlignLeftOutlined />,
  radio: <CheckCircleOutlined />,
  checkbox: <CheckSquareOutlined />,
  input: <EditOutlined />,
  textarea: <FormOutlined />,
};

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
    <button
      type="button"
      ref={setNodeRef}
      className="palette-item"
      disabled={locked}
      onClick={() => dispatch(editorActions.addComponent(type))}
      {...listeners}
      {...attributes}
    >
      <span className="palette-item-icon">{PALETTE_ICONS[type]}</span>
      <span className="palette-item-label">{t(`editor.${type}`)}</span>
    </button>
  );
}

function PaletteList({ locked }: { locked: boolean }) {
  return (
    <div className="palette-list">
      {PALETTE.map((type) => (
        <PaletteButton key={type} type={type} locked={locked} />
      ))}
    </div>
  );
}

function SortableRow({
  item,
  index,
  selected,
  locked,
}: {
  item: ComponentItem;
  index: number;
  selected: boolean;
  locked: boolean;
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.fe_id,
    disabled: locked,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const title = String(item.props.title ?? item.type);
  const required = Boolean(item.props.required);

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={selected ? "canvas-block is-selected" : "canvas-block"}
        onClick={() => dispatch(editorActions.select(item.fe_id))}
        aria-current={selected ? "true" : undefined}
      >
        <button
          type="button"
          className="canvas-block-handle"
          disabled={locked}
          aria-label={t("editor.dragHandle")}
          onClick={(e) => e.stopPropagation()}
          {...(locked ? {} : { ...attributes, ...listeners })}
        >
          <HolderOutlined />
        </button>
        <div className="canvas-block-body">
          <div className="canvas-block-meta">
            <span className="canvas-block-index">{index}</span>
            <span className="canvas-block-type">{t(`editor.${item.type}`)}</span>
            {required ? <span className="canvas-block-required">{t("editor.required")}</span> : null}
          </div>
          <div className="canvas-block-title">{title}</div>
        </div>
        <Button
          danger
          type="text"
          size="small"
          disabled={locked}
          onClick={(e) => {
            e.stopPropagation();
            dispatch(editorActions.removeComponent(item.fe_id));
          }}
        >
          {t("editor.delete")}
        </Button>
      </div>
    </div>
  );
}

function CanvasEnd({ locked, empty }: { locked: boolean; empty: boolean }) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_END, disabled: locked });
  if (locked) return empty ? <EmptyState description={t("editor.emptyCanvas")} /> : null;
  return (
    <div
      ref={setNodeRef}
      className={empty || isOver ? "canvas-end is-active" : "canvas-end"}
      data-over={isOver ? "true" : undefined}
    >
      {empty ? <EmptyState description={t("editor.emptyCanvas")} /> : null}
    </div>
  );
}

function PropsPanel({ locked }: { locked: boolean }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const present = useSelector((s: RootState) => s.editor.present);
  const selected = present.componentList.find((c) => c.fe_id === present.selectedFeId);

  if (!selected) {
    return <EmptyState description={t("editor.selectHint")} />;
  }

  const hasRequired = "required" in selected.props;
  const hasMaxLength = typeof selected.props.maxLength === "number";
  const hasChoices = selected.type === "radio" || selected.type === "checkbox";

  return (
    <Form layout="vertical" disabled={locked} key={selected.fe_id} className="props-form">
      <div className="props-section-label">{t("editor.section.basic")}</div>
      <Form.Item label={t("survey.title")}>
        <Input
          value={String(selected.props.title ?? "")}
          onChange={(e) =>
            dispatch(editorActions.updateProps({ fe_id: selected.fe_id, props: { ...selected.props, title: e.target.value } }))
          }
        />
      </Form.Item>
      {hasRequired || selected.type === "radio" ? (
        <div className="props-section-label">{t("editor.section.answer")}</div>
      ) : null}
      {hasRequired ? (
        <Form.Item>
          <Checkbox
            checked={Boolean(selected.props.required)}
            onChange={(e) =>
              dispatch(
                editorActions.updateProps({
                  fe_id: selected.fe_id,
                  props: { ...selected.props, required: e.target.checked },
                }),
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
      {hasMaxLength ? (
        <Form.Item label={t("editor.maxLength")}>
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
      {hasChoices ? (
        <>
          <div className="props-section-label">{t("editor.section.options")}</div>
          <Form.Item>
            <OptionListEditor
              feId={selected.fe_id}
              type={selected.type}
              componentProps={selected.props}
              locked={locked}
            />
          </Form.Item>
        </>
      ) : null}
      <Button danger disabled={locked} onClick={() => dispatch(editorActions.removeComponent(selected.fe_id))}>
        {t("editor.delete")}
      </Button>
    </Form>
  );
}

export function SurveyEditor({ locked }: { locked: boolean }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const present = useSelector((s: RootState) => s.editor.present);
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [overlayType, setOverlayType] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);

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

  const palette = (
    <div className="editor-panel editor-palette">
      <div className="editor-panel-title">{t("editor.palette")}</div>
      <PaletteList locked={locked} />
    </div>
  );

  const propsPanel = (
    <div className="editor-panel editor-props">
      <div className="editor-panel-title">{t("editor.props")}</div>
      <PropsPanel locked={locked} />
    </div>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setOverlayType(null)}
    >
      {isMobile ? (
        <div className="editor-mobile-bar">
          <Button onClick={() => setPaletteOpen(true)}>{t("editor.palette")}</Button>
          <Button onClick={() => setPropsOpen(true)}>{t("editor.props")}</Button>
        </div>
      ) : null}
      <div className={isMobile ? "editor-layout is-mobile" : "editor-layout"}>
        {isMobile ? null : palette}
        <section className="editor-canvas-panel">
          <div className="editor-panel-title">{t("editor.canvas")}</div>
          <Form layout="vertical" className="editor-survey-title">
            <Form.Item label={t("survey.title")} required>
              <Input
                disabled={locked}
                maxLength={200}
                value={present.title}
                onChange={(e) => dispatch(editorActions.setTitle(e.target.value))}
              />
            </Form.Item>
          </Form>
          <SortableContext items={present.componentList.map((c) => c.fe_id)} strategy={verticalListSortingStrategy}>
            {present.componentList.map((item, index) => (
              <SortableRow
                key={item.fe_id}
                item={item}
                index={index + 1}
                selected={item.fe_id === present.selectedFeId}
                locked={locked}
              />
            ))}
            <CanvasEnd locked={locked} empty={present.componentList.length === 0} />
          </SortableContext>
        </section>
        {isMobile ? null : propsPanel}
      </div>
      {isMobile ? (
        <>
          <Drawer
            title={t("editor.palette")}
            placement="left"
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            width={280}
          >
            <PaletteList locked={locked} />
          </Drawer>
          <Drawer title={t("editor.props")} placement="right" open={propsOpen} onClose={() => setPropsOpen(false)} width={320}>
            <PropsPanel locked={locked} />
          </Drawer>
        </>
      ) : null}
      <DragOverlay>
        {overlayType ? <div className="palette-item is-overlay">{t(`editor.${overlayType}`)}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
