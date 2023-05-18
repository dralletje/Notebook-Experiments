import { StateEffect, StateField } from "@codemirror/state";
import { invertedEffects } from "./codemirror-editor-in-chief/codemirror-shared-history";
import { produce } from "immer";

type CellMeta = {
  name: string;
  code: string;
  folded: boolean;
  enabled: boolean;
};

export let MutateCellMetaEffect =
  StateEffect.define<(value: CellMeta) => void>();

let invert_fold = invertedEffects.of((tr) => {
  let was = tr.startState.field(CellMetaField).folded;
  let is = tr.state.field(CellMetaField).folded;
  if (was !== is) {
    return [
      MutateCellMetaEffect.of((meta) => {
        meta.folded = was;
      }),
    ];
  } else {
    return [];
  }
});

export let CellMetaField = StateField.define({
  create() {
    return /** @type {CellMeta} */ {
      code: "",
      name: "",
      enabled: true,
      folded: false,
    };
  },
  update(value, transaction) {
    return produce(value, (value) => {
      for (let effect of transaction.effects) {
        if (effect.is(MutateCellMetaEffect)) {
          // @ts-ignore
          effect.value(value);
        }
      }
    });
  },
  provide: () => invert_fold,
});
