import { findAttribute } from "./utils.js";

const ITERATOR_METHODS = new Set(["map", "flatMap"]);
const FUNCTION_TYPES = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
]);
const TS_WRAPPERS = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression"]);

function getIteratorCallback(call) {
  const { callee, arguments: args } = call;
  if (
    callee.type !== "MemberExpression" ||
    callee.computed ||
    callee.property.type !== "Identifier"
  )
    return null;
  const method = callee.property.name;
  if (ITERATOR_METHODS.has(method)) return args[0];
  if (method === "from" && callee.object.type === "Identifier" && callee.object.name === "Array")
    return args[1];
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a `key` prop on JSX returned from iterators or placed in array literals",
    },
    schema: [],
    messages: {
      missingKey: 'Missing "key" prop for element in {{ where }}.',
      fragmentKey: "Use `<Fragment key={...}>` instead of `<>` in {{ where }}.",
    },
  },
  create(context) {
    const callbacks = new Set();

    function check(node, where) {
      if (!node) return;
      if (TS_WRAPPERS.has(node.type)) return check(node.expression, where);
      if (node.type === "ConditionalExpression") {
        check(node.consequent, where);
        check(node.alternate, where);
      } else if (node.type === "LogicalExpression") {
        if (node.operator !== "&&") check(node.left, where);
        check(node.right, where);
      } else if (node.type === "JSXFragment") {
        context.report({ node, messageId: "fragmentKey", data: { where } });
      } else if (node.type === "JSXElement" && !findAttribute(node.openingElement, "key")) {
        context.report({ node, messageId: "missingKey", data: { where } });
      }
    }

    return {
      CallExpression(node) {
        const fn = getIteratorCallback(node);
        if (!fn || !FUNCTION_TYPES.has(fn.type)) return;
        if (fn.body.type === "BlockStatement") callbacks.add(fn);
        else check(fn.body, "iterator");
      },
      ReturnStatement(node) {
        const owner = context.sourceCode
          .getAncestors(node)
          .findLast((a) => FUNCTION_TYPES.has(a.type));
        if (callbacks.has(owner)) check(node.argument, "iterator");
      },
      ArrayExpression(node) {
        for (const element of node.elements) check(element, "array");
      },
    };
  },
};
