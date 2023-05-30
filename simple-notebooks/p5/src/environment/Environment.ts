import type { Notebook } from "@dral/javascript-notebook-runner";
import { EngineShadow } from "../packages/codemirror-notebook/cell";
import { TypedEventTarget } from "@dral/typed-event-target";

export type EngineLog = {
  id: string;
  cell_id: string;
  code: string;
  cylinder: import("../packages/codemirror-notebook/cell.js").CylinderShadow;
  repeat: number;
  time: Date;
};

export type WorkspaceSerialized = {
  id: string;
  files: {
    [filename: string]: {
      filename: string;
      notebook: import("../packages/codemirror-notebook/cell").NotebookSerialized;
    };
  };
};

export type Environment = {
  // Why is this one suddenly camelcase?
  // Because I feel like it
  createEngine: () => Engine;

  // TODO
  // load_workspace: () => Promise<WorkspaceSerialized>;
};

export class AddLogEvent extends Event {
  constructor(public log: EngineLog) {
    super("add-log");
  }
}
export class UpdateEngineEvent extends Event {
  constructor(public engineShadow: EngineShadow) {
    super("update-engine");
  }
}

export abstract class Engine extends TypedEventTarget<{
  "add-log": AddLogEvent;
  "update-notebook": UpdateEngineEvent;
}> {
  abstract start(): void;
  abstract stop(): void;
  restart() {
    this.stop();
    this.start();
  }

  abstract update_notebook(notebook: Notebook): void;

  abstract deserialize(value: any): any;
}
