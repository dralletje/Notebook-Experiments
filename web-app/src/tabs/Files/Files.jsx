import { IonIcon } from "@ionic/react";
import { imageOutline, walletOutline } from "ionicons/icons";
import { sortBy } from "lodash";
import React from "react";

/**
 * @typedef FileID
 * @type {string}
 *
 * @typedef File
 * @property {"file"} type
 * @property {FileID} id
 * @property {string} name
 *
 * @typedef Directory
 * @property {"directory"} type
 * @property {FileID} id
 * @property {string} name
 * @property {FileID[]} items
 *
 * @typedef Filesystem
 * @property {string} root
 * @property {{ [id: FileID]: File | Directory }} items
 */

/**
 * @param {{ [filename: string]: { filename: string } }} files
 * @returns {Filesystem}
 */
export let files_to_directory = (files) => {
  let filesystem = /** @type {Filesystem} */ ({
    root: "",
    items: {
      "": {
        id: "",
        type: "directory",
        name: "Workspace",
        items: [],
      },
    },
  });
  let root = filesystem.items[filesystem.root];

  for (let file of Object.values(files)) {
    let parts = file.filename.split("/");

    // Create directories if necessary
    let current_path = [];
    for (let part of parts.slice(0, -1)) {
      current_path.push(part);
      let path = current_path.join("/");
      let parent_path = current_path.slice(0, -1).join("/");
      let parent = filesystem.items[parent_path];

      if (filesystem.items[path] == null) {
        if (parent.type !== "directory") break; // wtf?

        filesystem.items[path] = {
          id: path,
          type: "directory",
          name: part,
          items: [],
        };
        parent.items.push(path);
      }
    }

    let path = parts.join("/");
    filesystem.items[path] = {
      id: path,
      type: "file",
      name: parts.at(-1) ?? "UNKNOWN NAME",
    };

    let parent_path = parts.slice(0, -1).join("/");
    let parent = filesystem.items[parent_path];
    if (parent.type !== "directory") break; // wtf?
    parent.items.push(path);
  }
  return filesystem;
};

/**
 * @param {{
 *  filesystem: Filesystem,
 *  directory: Directory
 * }} props
 */
let Directory = ({ filesystem, directory }) => {
  return (
    <div>
      <div>
        <IonIcon icon={walletOutline} /> {directory.name}
      </div>
      <ul style={{ marginLeft: 16 }}>
        {sortBy(directory.items, (id) =>
          filesystem.items[id].type === "directory" ? 0 : 1
        ).map((id) => (
          <li>
            <Entry filesystem={filesystem} id={id} />
          </li>
        ))}
      </ul>
    </div>
  );
};

let Entry = ({ filesystem, id }) => {
  let item = filesystem.items[id];
  if (item.type === "file") {
    return (
      <div>
        <IonIcon icon={imageOutline} /> {item.name}
      </div>
    );
  } else if (item.type === "directory") {
    return <Directory filesystem={filesystem} directory={item} />;
  } else {
    return <span>Unknown item type: {item.type}</span>;
  }
};

/**
 * @param {{
 *  filesystem: Filesystem,
 * }} props
 */
export let FilesTab = ({ filesystem }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <p>
        So I was working on this, and I have some cool implementation stuff
        yadiyada...
      </p>
      <p>But then I found I really don't want to work on this so here ya go</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <h1>Files</h1>
      <p>Aaaaaaaaaa</p>
      <div style={{ minHeight: 30 }} />
      <Entry filesystem={filesystem} id={filesystem.root} />
    </div>
  );
};
