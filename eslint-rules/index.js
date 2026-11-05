// Local replacement for the few eslint-plugin-react rules TypeScript doesn't cover.
import jsxKey from "./jsx-key.js";
import jsxNoCommentTextnodes from "./jsx-no-comment-textnodes.js";
import noChildrenProp from "./no-children-prop.js";
import noDangerWithChildren from "./no-danger-with-children.js";

const plugin = {
  meta: { name: "local" },
  rules: {
    "jsx-key": jsxKey,
    "jsx-no-comment-textnodes": jsxNoCommentTextnodes,
    "no-children-prop": noChildrenProp,
    "no-danger-with-children": noDangerWithChildren,
  },
};

plugin.configs = {
  recommended: {
    plugins: { local: plugin },
    rules: Object.fromEntries(Object.keys(plugin.rules).map((name) => [`local/${name}`, "error"])),
  },
};

export default plugin;
