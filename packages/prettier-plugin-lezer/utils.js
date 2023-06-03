/** @returns {import("prettier").Doc} */
let dont_break = (/** @type {import("prettier").Doc} */ doc) => {
  if (typeof doc === "string") {
    return doc;
  }
  if (Array.isArray(doc)) {
    return doc.map(dont_break);
  }
  if (doc.type === "group") {
    return {
      ...doc,
      contents: dont_break(doc.contents),
    };
  }
  if (doc.type === "line") {
    if (doc.soft) return "";
    if (doc.hard) return "";
    return " ";
  }
  if (doc.type === "concat") {
    return { type: "concat", parts: doc.parts.map(dont_break) };
  }
  if (doc.type === "indent") {
    return { type: "indent", contents: dont_break(doc.contents) };
  }
  if (doc.type === "align") {
    return { type: "align", contents: dont_break(doc.contents), n: doc.n };
  }
  if (doc.type === "break-parent") {
    return "";
  }

  console.warn(`DOC TYPE THAT dont_break DOESNT UNDERSTAND:`, doc);
  return doc;
};

module.exports.dont_break = dont_break;
