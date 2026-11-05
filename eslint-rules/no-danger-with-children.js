import { findAttribute, isMeaningfulChild } from "./utils.js";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow combining `dangerouslySetInnerHTML` with children (React throws at runtime)",
    },
    schema: [],
    messages: { dangerWithChildren: "Only set one of `children` or `dangerouslySetInnerHTML`." },
  },
  create(context) {
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        if (!findAttribute(opening, "dangerouslySetInnerHTML")) return;
        if (node.children.some(isMeaningfulChild) || findAttribute(opening, "children")) {
          context.report({ node: opening, messageId: "dangerWithChildren" });
        }
      },
    };
  },
};
