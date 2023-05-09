import React from "react";

import { GenericViewUpdate } from "codemirror-x-react/viewupdate.js";
import { SheetPosition } from "../../packages/codemirror-sheet/sheet-position.js";
import { EngineShadow } from "../../packages/codemirror-notebook/cell.js";
import { extract_nested_viewupdate } from "../../packages/codemirror-editor-in-chief/extract-nested-viewupdate.js";

export let SidebarData = ({
  selected_cell,
  viewupdate,
  engine,
}: {
  selected_cell: SheetPosition;
  viewupdate: GenericViewUpdate<any>;
  engine: EngineShadow;
}) => {
  let cell_viewupdate = extract_nested_viewupdate(
    // @ts-ignore
    extract_nested_viewupdate(viewupdate, "sheet"),
    selected_cell.id
  );
  let code = cell_viewupdate.state?.doc?.toString() ?? "";

  return (
    <div>
      Heyyy
      {/* <InlineCell
        key={selected_cell.id}
        cell_id={selected_cell.id}
        cylinder={engine.cylinders[selected_cell.id]}
        code={code}
      /> */}
    </div>
  );
};
