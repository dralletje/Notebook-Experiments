import React from "react";
import { ScopedStorage, useScopedStorage } from "./scoped-storage.js";
import { DEFAULT_WORKSPACE } from "../yuck/DEFAULT_WORKSPACE";
import { mapValues, throttle } from "lodash";
import { notebook_state_to_notebook_serialized } from "../notebook-utils";
import { notebook_to_state } from "../App.jsx";

let workspace_storage = new ScopedStorage("workspace");

let serialized_workspace_to_workspace = (serialized) => {
  return /** @type {import("../App.jsx").Workspace} */ ({
    id: serialized.id,
    files: mapValues(serialized.files, (file) => {
      return {
        filename: file.filename,
        state: notebook_to_state(file),
      };
    }),
  });
};

export let useWorkerStorage = () => {
  let [workspace_json, set_workspace_json] = useScopedStorage(
    workspace_storage,
    DEFAULT_WORKSPACE
  );
  let update_localstorage = React.useMemo(() => {
    return throttle(
      (/** @type {import("../App.jsx").Workspace} */ workspace) => {
        set_workspace_json(
          JSON.stringify(
            /** @type {import("../environment/Environment.js").WorkspaceSerialized} */ ({
              id: workspace.id,
              files: mapValues(workspace.files, (file) => {
                return {
                  filename: file.filename,
                  notebook: notebook_state_to_notebook_serialized(file.state),
                };
              }),
            })
          )
        );
      },
      500
    );
  }, [set_workspace_json]);

  let initial_workspace = React.useMemo(() => {
    let workspace = JSON.parse(workspace_json);
    return serialized_workspace_to_workspace(workspace);
  }, []);

  let [workspace, set_workspace] = React.useState(initial_workspace);

  return /** @type {const} */ ([
    workspace,
    (workspace) => {
      // @ts-ignore
      update_localstorage(workspace);
      set_workspace(workspace);
    },
  ]);
};
//////////////////////////////////////////////////////////////

let error = (message) => {
  throw new Error(message);
};
export let useSocketStorage = () => {
  let [workspace, set_workspace] = React.useState(
    /** @type {import("../App.jsx").Workspace | null} */ (null)
  );

  React.useEffect(() => {
    fetch("http://localhost:3099/workspace")
      .then((res) =>
        res.status === 200
          ? res.json()
          : error("Couldn't load workspace.......")
      )
      .then((workspace) => {
        console.log(`workspace YEH:`, workspace);
        set_workspace(serialized_workspace_to_workspace(workspace));
      });
  }, []);

  return /** @type {const} */ ([workspace, set_workspace]);
};
