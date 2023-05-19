import { acceptCompletion, autocompletion } from "@codemirror/autocomplete";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

export let dral_autocompletion = () => {
  return [
    EditorView.theme({
      ".cm-tooltip.cm-tooltip-autocomplete": {
        "background-color": "#000000",
        "border-radius": "9px",
        transform: "translateY(10px) translateX(-7px)",
        overflow: "hidden",

        "& > ul": {
          font: "inherit",
          "max-width": "min(400px, 95vw)",

          "& > li": {
            "padding-inline": "8px",
            display: "flex",

            "&:first-child": {
              "padding-top": "4px",
            },
            "&:last-child": {
              "padding-bottom": "4px",
            },
            "&[aria-selected]": {
              background: "#ffffff2b",
              // filter: "brightness(1.5)",
            },

            "& .cm-completionMatchedText": {
              "text-decoration": "none",
              "font-weight": "bold",
            },
            "& .cm-completionDetail": {
              opacity: 0.7,
              flex: 1,
              textAlign: "right",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginLeft: "2.5em",
            },
          },
        },
      },
    }),
    autocompletion({
      icons: false,
      optionClass: (x) => x.type ?? "",
    }),
    Prec.highest(
      keymap.of([
        {
          key: "Tab",
          run: acceptCompletion,
        },
      ])
    ),
  ];
};
