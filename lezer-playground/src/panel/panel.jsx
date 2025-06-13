import React from "react";
import { IoBonfire } from "react-icons/io5";
import { Failure, Loading } from "../use/OperationMonadBullshit.js";

// @ts-ignore
import classes from "./panel.module.css";

/**
 * @template T
 * @typedef ExecutionResult
 * @type {import("../use/OperationMonadBullshit.js").ExecutionResult<T>}
 */

/**
 * @param {{
 *  title: string,
 *  process?: null | ExecutionResult<any> | Array<ExecutionResult<any>>,
 * }} props
 */
export let PaneTab = ({ title, process }) => {
  let ERROR_COLOR = "rgb(133 0 0)";
  let processes =
    process == null ? [] : Array.isArray(process) ? process : [process];
  let errors = processes.filter((p) => p instanceof Failure);
  let loading = processes.find((p) => p instanceof Loading);

  return (
    <>
      <span style={{ color: errors.length !== 0 ? ERROR_COLOR : undefined }}>
        {title}
      </span>
      {loading != null && (
        <>
          <div style={{ minWidth: 8 }} />
          <div className={classes.loadingringthing} />
        </>
      )}
      {/* Now slicing the first, gotta make sure I show all the errors but not too much though */}
      {errors.slice(0, 1).map((error, index) => (
        // TODO Using `index` here is wrong, but it doesn't hurt too much
        <React.Fragment key={index}>
          <div style={{ minWidth: 8 }} />
          <IoBonfire style={{ color: ERROR_COLOR }} />
        </React.Fragment>
      ))}
    </>
  );
};

export let Pane = ({ children, header, ...props }) => {
  return (
    <div className={`pane ${classes.pane}`} {...props}>
      <div className={classes.paneheader}>{header}</div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
};
