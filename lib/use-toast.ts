import * as React from "react";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

type ToastInput = Omit<Toast, "id">;

interface ToastState {
  toasts: Toast[];
}

type Action =
  { type: "ADD"; toast: Toast } | { type: "REMOVE"; id: string } | { type: "DISMISS"; id: string };

let dispatch: React.Dispatch<Action> = () => {};
let toastId = 0;

function reducer(state: ToastState, action: Action): ToastState {
  switch (action.type) {
    case "ADD":
      return { toasts: [...state.toasts, action.toast] };
    case "DISMISS":
      return {
        toasts: state.toasts.map((t) =>
          t.id === action.id ? ({ ...t, _dismissed: true } as any) : t,
        ),
      };
    case "REMOVE":
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

export function useToastStore() {
  const [state, setDispatch] = React.useReducer(reducer, { toasts: [] });
  React.useEffect(() => {
    dispatch = setDispatch;
  });
  return state;
}

export function toast(input: ToastInput) {
  const id = String(++toastId);
  const t: Toast = { id, variant: "default", duration: 4000, ...input };
  dispatch({ type: "ADD", toast: t });
  return id;
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: "success" });

toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: "error", duration: 6000 });

toast.warning = (title: string, description?: string) =>
  toast({ title, description, variant: "warning" });

toast.info = (title: string, description?: string) =>
  toast({ title, description, variant: "info" });

export function dismissToast(id: string) {
  dispatch({ type: "REMOVE", id });
}
