const COMMENT_LIKE = /^\s*\/(\/|\*)/m;

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `//` or `/*` comments written as JSX text, which render on screen",
    },
    schema: [],
    messages: {
      commentText: "Comments inside JSX children must be wrapped in braces: {/* ... */}.",
    },
  },
  create(context) {
    return {
      JSXText(node) {
        if (COMMENT_LIKE.test(node.value)) context.report({ node, messageId: "commentText" });
      },
    };
  },
};
