/** Returns the JSX attribute with the given name, ignoring spread attributes. */
export function findAttribute(openingElement, name) {
  return openingElement.attributes.find(
    (attr) =>
      attr.type === "JSXAttribute" && attr.name.type === "JSXIdentifier" && attr.name.name === name
  );
}

/** True when a JSX child renders something (whitespace-only text and `{}` don't). */
export function isMeaningfulChild(child) {
  if (child.type === "JSXText") return child.value.trim() !== "";
  if (child.type === "JSXExpressionContainer")
    return child.expression.type !== "JSXEmptyExpression";
  return true;
}
