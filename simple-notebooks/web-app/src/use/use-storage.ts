import React from "react";
import { ScopedStorage, useScopedStorage } from "./scoped-storage.js";
import { DEFAULT_WORKSPACE } from "../yuck/DEFAULT_WORKSPACE.js";
import { mapValues, throttle } from "lodash";
import { Workspace } from "../App.jsx";
import { WorkspaceSerialized } from "../environment/Environment.js";

let workspace_storage = new ScopedStorage("workspace");
export let useWorkerStorage = ({
  serialize,
  deserialize,
}: {
  serialize: (value: any) => any;
  deserialize: (value: any) => any;
}) => {
  let [workspace_json, set_workspace_json] = useScopedStorage(
    workspace_storage,
    DEFAULT_WORKSPACE
  );
  let update_localstorage = React.useMemo(() => {
    return throttle((workspace: Workspace) => {
      set_workspace_json(
        JSON.stringify({
          id: workspace.id,
          files: mapValues(workspace.files, (file) => {
            return {
              filename: file.filename,
              notebook: serialize(file.state),
            };
          }),
        })
      );
    }, 500);
  }, [set_workspace_json]);

  let initial_workspace = React.useMemo(() => {
    let workspace = JSON.parse(workspace_json) as WorkspaceSerialized;
    return {
      id: workspace.id,
      files: mapValues(workspace.files, (file) => {
        return {
          filename: file.filename,
          state: deserialize(file),
        };
      }),
    };
  }, []);

  let [workspace, set_workspace] = React.useState(initial_workspace);

  return [
    workspace,
    (workspace) => {
      // @ts-ignore
      update_localstorage(workspace);
      set_workspace(workspace);
    },
  ] as const;
};

//////////////////////////////////////////////////////////////

let error = (message) => {
  throw new Error(message);
};
export let useSocketStorage = ({
  serialize,
  deserialize,
}: {
  serialize: (value: any) => any;
  deserialize: (value: any) => any;
}) => {
  let [workspace, set_workspace] = React.useState(
    /** @type {import("../App.jsx").Workspace | null} */ null
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
        set_workspace({
          id: workspace.id,
          files: mapValues(workspace.files, (file) => {
            return {
              filename: file.filename,
              state: deserialize(file),
            };
          }),
        });
      });
  }, []);

  return [workspace, set_workspace] as const;
};
