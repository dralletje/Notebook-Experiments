import React from "react";
import { ScopedStorage, useScopedStorage } from "./scoped-storage.js";
import { DEFAULT_WORKSPACE } from "../yuck/DEFAULT_WORKSPACE.js";
import { mapValues, throttle } from "lodash";
import { WorkspaceSerialized } from "../environment/Environment.js";

let workspace_storage = new ScopedStorage("workspace");

type Workspace<T> = { files: { [key: string]: T } };

export let useWorkerStorage = <Serialized, Living>({
  serialize,
  deserialize,
}: {
  serialize: (value: Living) => Serialized;
  deserialize: (value: Serialized) => Living;
}) => {
  let [workspace_json, set_workspace_json] = useScopedStorage(
    workspace_storage,
    DEFAULT_WORKSPACE
  );

  let initial_workspace = React.useMemo(() => {
    let workspace = JSON.parse(workspace_json) as Workspace<Serialized>;
    return {
      files: mapValues(workspace.files, (file) => {
        return deserialize(file);
      }),
    };
  }, []);

  let [workspace, set_workspace] = React.useState(initial_workspace);

  let update_localstorage = React.useMemo(() => {
    return throttle(
      (workspace: { id: string; files: { [key: string]: Living } }) => {
        set_workspace_json(
          JSON.stringify({
            files: mapValues(workspace.files, (file) => {
              return serialize(file);
            }),
          })
        );
      },
      500
    );
  }, [set_workspace_json]);

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
