import React from "react";

declare global {
  interface Node {
    getRootNode(): ShadowRoot | Document;
  }
  interface ShadowRoot {
    adoptedStyleSheets: CSSStyleSheet[];
  }
  interface Document {
    adoptedStyleSheets: CSSStyleSheet[];
  }
}

export class CSSish {
  id = `STYLESHEET-` + String((Math.random() * 10 ** 10).toFixed());
  style_text: string;
  sheet: CSSStyleSheet | undefined;

  constructor(style_text) {
    this.style_text = style_text;
    try {
      let sheet = new CSSStyleSheet();
      sheet.replaceSync(style_text);
      this.sheet = sheet;
    } catch {}
  }
}

export let AdoptStylesheet = ({ stylesheet }: { stylesheet: CSSish }) => {
  let ref = React.useRef(null as HTMLStyleElement | null);
  React.useLayoutEffect(() => {
    if (ref.current == null) return;
    let element = ref.current;
    let shadow_root = element.getRootNode();

    if (stylesheet.sheet == null) {
      if (shadow_root.querySelector(`#${stylesheet.id}`) != null) return;

      element.id = stylesheet.id;
      element.textContent = stylesheet.style_text;
      return () => {
        element.id = "";
        element.textContent = "";
      };
    } else {
      let sheet = stylesheet.sheet;
      shadow_root.adoptedStyleSheets = [
        ...(shadow_root.adoptedStyleSheets ?? []),
        sheet,
      ];

      return () => {
        let index = shadow_root.adoptedStyleSheets.indexOf(sheet);
        shadow_root.adoptedStyleSheets = [
          ...shadow_root.adoptedStyleSheets.slice(0, index),
          ...shadow_root.adoptedStyleSheets.slice(index + 1),
        ];
      };
    }
  }, []);
  return <style ref={ref} />;
};
