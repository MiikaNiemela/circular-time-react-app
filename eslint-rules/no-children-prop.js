import { findAttribute } from "./utils.js";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow passing `children` as a JSX attribute; nest it between the tags instead",
    },
    schema: [],
    messages: {
      childrenProp: "Pass children between the opening and closing tags, not as a `children` prop.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const attr = findAttribute(node, "children");
        if (attr) context.report({ node: attr, messageId: "childrenProp" });
      },
    };
  },
};
