import { EditorState } from "@codemirror/state";

interface Transaction<S> {
  state: S;
  startState: S;
}

interface TransactionSpec<S> {}

export interface UpdateableState {
  update(...spec: TransactionSpec<this>[]): Transaction<this>;
}

interface EditorView<S extends UpdateableState> {
  state: S;
  dispatch(...spec: Parameters<S["update"]>): void;
}

export class GenericViewUpdate<S extends UpdateableState> {
  constructor(transactions: ReturnType<S["update"]>[], view: EditorView<S>);

  view: EditorView<S>;
  transactions: ReturnType<S["update"]>[];
  state: S;
  startState: S;
}

export let CodemirrorFromViewUpdate: ({
  viewupdate,
  children,
  ...props
}: {
  viewupdate: GenericViewUpdate<EditorState>;
  children: React.ReactNode;
  as?: string;
} & import("react").HtmlHTMLAttributes<"div">) => JSX.Element;

export let useViewUpdate: <TState extends UpdateableState>(
  state: TState,
  on_change: (state: TState) => void
) => GenericViewUpdate<TState>;
