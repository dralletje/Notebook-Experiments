import React from "react";
import styled from "styled-components";
import { range, sortBy, uniq } from "lodash-es";
import { ScopedStorage } from "./use/scoped-storage.js";
import { IoHeart, IoLogoGithub } from "react-icons/io5";

let lezer_playground_storage = new ScopedStorage("lezer-playground");

let ProjectDropdownStyle = styled.div`
  position: relative;

  button {
    border: none;
    height: 100%;
    padding: 0 8px;
    font-weight: normal;

    body:not(.mouse-down) &:hover {
      background-color: white;
      color: black;
    }
  }

  .menu {
    display: flex;
    background-color: black;
    min-width: 150px;
    font-size: 16px;

    flex-direction: column;

    border: solid 4px white;

    a {
      padding: 8px 16px;
      white-space: pre;
      cursor: pointer;
      font-family: var(--mono-font-family);

      border-top: solid white 2px;
      &:first-child {
        border-top: none;
      }

      &.active {
        cursor: unset;
        color: #37ff61;
        font-weight: bold;
        background-color: #323232;
      }

      &:not(.active):hover {
        background-color: white;
        color: black;
      }
    }
  }

  .help {
    width: 300px;
    background-color: black;
    font-size: 16px;
    padding: 16px;
    border: solid 4px white;
    border-left: none;
  }

  .dropdown {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;

    flex-direction: row;

    @media (max-width: 450px) {
      position: fixed;
      top: 30px;
      left: 0;
      right: 0;
    }
  }

  body:not(.mouse-down) &:has(button:hover),
  &:has(.dropdown:hover) {
    .dropdown {
      display: flex;
    }
    button {
      background-color: white;
      color: black;
    }
  }
`;

/** @param {Storage} storage */
let storage_keys = function* (storage) {
  for (let i of range(0, storage.length)) {
    let key = storage.key(i);
    if (key != null) {
      yield key;
    }
  }
};

let ProjectsDropdown = () => {
  let path = window.location.pathname;

  let project_names = sortBy(
    uniq(
      Array.from(storage_keys(localStorage))
        .map((x) => x.split("."))
        .filter((x) => x[0] === "lezer-playground")
        .map((x) => x[1])
    )
  );

  return (
    <ProjectDropdownStyle>
      <button>projects</button>
      <div className="dropdown">
        <div className="menu">
          {project_names.map((project_name) => (
            <a
              className={path === project_name ? "active" : ""}
              key={project_name}
              href={project_name}
            >
              {project_name}
            </a>
          ))}
        </div>
        <div className="help">
          To open a new project, change the path to something not listed here.
        </div>
      </div>
    </ProjectDropdownStyle>
  );
};

let path_prefix = "./premade-projects/";
// @ts-expect-error - Vite glob 😎
const modules = import.meta.glob("./premade-projects/**/*", { query: "?raw" });

console.log(`modules:`, modules);

let premade_projects = {};
for (let [path, import_module] of Object.entries(modules)) {
  let [project, filename] = path.slice(path_prefix.length).split("/");
  premade_projects[project] ??= {};

  if (filename.startsWith("example.")) {
    premade_projects[project].example = import_module;
  } else if (filename === "external.js") {
    premade_projects[project].external = import_module;
  } else if (filename.endsWith(".grammar")) {
    premade_projects[project].grammar = import_module;
  } else {
    console.error(`Unknown file type: ${path}/${filename}`);
  }
}

console.log(`premade_projects:`, premade_projects);

let LoadSampleDropdown = ({ scoped_storage }) => {
  let path = window.location.pathname;
  let project_names = Object.keys(premade_projects);

  return (
    <ProjectDropdownStyle>
      <button>load</button>
      <div className="dropdown">
        <div className="menu">
          {project_names.map((project_name) => (
            <a
              key={project_name}
              onClick={() => {
                Promise.all([
                  premade_projects[project_name].example(),
                  premade_projects[project_name].grammar(),
                  premade_projects[project_name].external(),
                ]).then(([example, grammar, external]) => {
                  console.log(`example, grammar, external:`, {
                    example,
                    grammar,
                    external,
                  });
                  scoped_storage.child("code_to_parse").set(example);
                  scoped_storage.child("javascript_stuff").set(external);
                  scoped_storage.child("parser_code").set(grammar);
                  window.location.reload();
                });
              }}
            >
              {project_name}
            </a>
          ))}
        </div>
        <div className="help">
          Load an existing parser.
          <br />
          <br />
          I've compiled those from github, mashing the javascript files
          together. Maybe in the future I'll make a way to actually import from
          github.
          <br />
          <br />
          <b>This will override the project you have open currently!</b>
        </div>
      </div>
    </ProjectDropdownStyle>
  );
};

let InnerHeaderLol = styled.div`
  width: 100%;
  height: 100%;
  max-width: calc(100vw - 16px);
  position: sticky;
  right: 8px;
  left: 8px;

  display: flex;
  align-items: center;

  user-select: none;
  font-size: 12px;
`;

let ExtraDropdown = ({ scoped_storage }) => {
  let project_names = sortBy(
    uniq(
      Array.from(storage_keys(localStorage))
        .map((x) => x.split("."))
        .filter((x) => x[0] === "lezer-playground")
        .map((x) => x[1])
    )
  );

  return (
    <ProjectDropdownStyle>
      <button style={{ color: "gray" }}>other</button>
      <div className="dropdown">
        <div className="menu">
          <a
            onClick={() => {
              scoped_storage.child("history").remove();
              window.location.reload();
            }}
          >
            clear project history
          </a>
          <a
            onClick={() => {
              for (let project_name of project_names) {
                let storage = lezer_playground_storage
                  .child(project_name)
                  .child("history");
                storage.remove();
              }
              window.location.reload();
            }}
          >
            clear <b style={{ color: "#b20000" }}>all history</b>
          </a>
          <a
            onClick={() => {
              if (window.confirm("Hey, are you sure?")) {
                for (let child of scoped_storage.children()) {
                  console.log(`child.key:`, child.key);
                  child.remove();
                }
                window.location.href = "/";
              }
            }}
          >
            remove project
          </a>
        </div>
        <div className="help">
          I needed a catch all where I can put all my other miscellaneous
          options.
          <br />
          <br />
          Delete history is here because I save the codemirror history to
          localstorage, but it turns out localstorage has a limited size, so I
          needed a way to clear the history if it gets too big.
        </div>
      </div>
    </ProjectDropdownStyle>
  );
};

let SimpleLink = styled.a`
  cursor: pointer;
  &:hover {
    color: #00e1ff;
  }
`;

/**
 * @param {{
 *  main_scope: ScopedStorage,
 * }} props
 */
export let AppHeader = ({ main_scope }) => {
  return (
    <InnerHeaderLol>
      <span
        style={{
          flex: 1,
          alignSelf: "stretch",
          display: "flex",
          alignItems: "stretch",
        }}
      >
        <ProjectsDropdown />
        <LoadSampleDropdown scoped_storage={main_scope} />
        <ExtraDropdown scoped_storage={main_scope} />
      </span>
      <span style={{ fontWeight: "bold" }}>Lezer Playground</span>
      <span
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "row",
          justifyContent: "flex-end",
        }}
      >
        <SimpleLink href="https://github.com/dralletje">
          <IoHeart
            title="By Michiel Dral (link to github)"
            style={{ fontSize: 16 }}
          />
        </SimpleLink>
        <div style={{ width: 8 }} />
        <SimpleLink href="https://github.com/dralletje/Notebook-Experiments/tree/main/lezer-playground">
          <IoLogoGithub title="Github Repository" style={{ fontSize: 16 }} />
        </SimpleLink>
      </span>
    </InnerHeaderLol>
  );
};
