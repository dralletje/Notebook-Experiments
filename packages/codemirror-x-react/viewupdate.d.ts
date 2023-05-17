interface Transaction<S> {
  state: S;
  startState: S;
}

interface TransactionSpec<S> {}

interface EditorState {
  update(...spec: TransactionSpec<this>[]): Transaction<this>;
}

interface EditorView<S extends EditorState> {
  state: S;
  dispatch(...spec: Parameters<S["update"]>): void;
}

export class GenericViewUpdate<S extends EditorState> {
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
  viewupdate: GenericViewUpdate;
  children: React.ReactNode;
  as?: string;
} & import("react").HtmlHTMLAttributes<"div">) => JSX.Element;

export let useViewUpdate: <TState extends EditorState>(
  state: TState,
  on_change: (state: TState) => void
) => GenericViewUpdate<TState>;
