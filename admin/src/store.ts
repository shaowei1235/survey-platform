import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import undoable, { excludeAction } from "redux-undo";
import { nanoid } from "nanoid";
import type { ComponentItem } from "./session";

export type EditorPresent = {
  surveyId: string;
  title: string;
  status: "draft" | "published" | "closed";
  selectedFeId: string | null;
  componentList: ComponentItem[];
  dirty: boolean;
};

const initialState: EditorPresent = {
  surveyId: "",
  title: "",
  status: "draft",
  selectedFeId: null,
  componentList: [],
  dirty: false,
};

export const defaultProps = (type: string): Record<string, unknown> => {
  if (type === "title") return { title: "セクション" };
  if (type === "paragraph") return { title: "説明" };
  if (type === "radio") {
    return {
      title: "質問",
      required: true,
      scoreEnabled: true,
      options: [
        { value: "1", label: "全くそう思わない", score: 1 },
        { value: "2", label: "そう思わない", score: 2 },
        { value: "3", label: "どちらともいえない", score: 3 },
        { value: "4", label: "そう思う", score: 4 },
        { value: "5", label: "非常にそう思う", score: 5 },
      ],
    };
  }
  if (type === "checkbox") {
    return {
      title: "質問",
      required: false,
      options: [
        { value: "a", label: "選択肢A" },
        { value: "b", label: "選択肢B" },
      ],
    };
  }
  if (type === "input") return { title: "質問", required: false, maxLength: 200 };
  return { title: "改善してほしい点", required: false, maxLength: 2000 };
};

const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    hydrate(_state, action: PayloadAction<Omit<EditorPresent, "dirty" | "selectedFeId"> & { selectedFeId?: string | null }>) {
      return { ...initialState, ...action.payload, selectedFeId: action.payload.selectedFeId ?? null, dirty: false };
    },
    select(state, action: PayloadAction<string | null>) {
      state.selectedFeId = action.payload;
    },
    setTitle(state, action: PayloadAction<string>) {
      state.title = action.payload;
      state.dirty = true;
    },
    addComponent(state, action: PayloadAction<string>) {
      const item: ComponentItem = {
        fe_id: `c_${nanoid(21)}`,
        type: action.payload,
        props: defaultProps(action.payload),
      };
      state.componentList.push(item);
      state.selectedFeId = item.fe_id;
      state.dirty = true;
    },
    removeComponent(state, action: PayloadAction<string>) {
      state.componentList = state.componentList.filter((c) => c.fe_id !== action.payload);
      if (state.selectedFeId === action.payload) state.selectedFeId = null;
      state.dirty = true;
    },
    moveComponent(state, action: PayloadAction<{ from: number; to: number }>) {
      const { from, to } = action.payload;
      const next = [...state.componentList];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      state.componentList = next;
      state.dirty = true;
    },
    updateProps(state, action: PayloadAction<{ fe_id: string; props: Record<string, unknown> }>) {
      const target = state.componentList.find((c) => c.fe_id === action.payload.fe_id);
      if (target) {
        target.props = action.payload.props;
        state.dirty = true;
      }
    },
    markSaved(state) {
      state.dirty = false;
    },
  },
});

export const editorActions = editorSlice.actions;

export const store = configureStore({
  reducer: {
    editor: undoable(editorSlice.reducer, {
      limit: 20,
      filter: excludeAction(["editor/select", "editor/hydrate", "editor/markSaved"]),
    }),
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
