import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import jsxKey from "./jsx-key.js";
import jsxNoCommentTextnodes from "./jsx-no-comment-textnodes.js";
import noChildrenProp from "./no-children-prop.js";
import noDangerWithChildren from "./no-danger-with-children.js";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});
const tsx = (code) => ({ code, filename: "file.tsx" });
const invalid = (code, ...messageIds) => ({
  ...tsx(code),
  errors: messageIds.map((messageId) => ({ messageId })),
});

ruleTester.run("jsx-key", jsxKey, {
  valid: [
    tsx("items.map((i) => <li key={i}>{i}</li>)"),
    tsx("items.map((i) => { return <li key={i} />; })"),
    tsx("items.map((i) => <Fragment key={i}><a /><b /></Fragment>)"),
    tsx("items.map((i) => (cond ? <a key={i} /> : <b key={i} />))"),
    tsx("items.map((i) => cond && <a key={i} />)"),
    tsx("items.map((i) => <a key={i} {...props} />)"),
    tsx("Array.from(items, (i) => <a key={i} />)"),
    tsx("items.map((i) => { const render = () => <a />; return <b key={i}>{render()}</b>; })"),
    tsx("[<a key='1' />, <b key='2' />]"),
    tsx("items.map((i) => i * 2)"),
    tsx("const el = <a />"),
  ],
  invalid: [
    invalid("items.map((i) => <li>{i}</li>)", "missingKey"),
    invalid("items.map(function (i) { return <li />; })", "missingKey"),
    invalid("items.flatMap((i) => <li />)", "missingKey"),
    invalid("items.map((i) => <><a /></>)", "fragmentKey"),
    invalid("items.map((i) => (cond ? <a key={i} /> : <b />))", "missingKey"),
    invalid("items.map((i) => cond && <a />)", "missingKey"),
    invalid("items.map((i) => <a {...props} />)", "missingKey"),
    invalid("items.map((i) => (<a />) as JSX.Element)", "missingKey"),
    invalid("Array.from(items, (i) => <a />)", "missingKey"),
    invalid("items.map((i) => { if (i) { return <a />; } return <b key={i} />; })", "missingKey"),
    invalid("[<a />, <b key='2' />]", "missingKey"),
  ],
});

ruleTester.run("jsx-no-comment-textnodes", jsxNoCommentTextnodes, {
  valid: [
    tsx("<div>{/* fine */}</div>"),
    tsx("<div>http://example.com</div>"),
    tsx("<div>a / b</div>"),
  ],
  invalid: [
    invalid("<div>// oops</div>", "commentText"),
    invalid("<div>\n  /* oops */\n</div>", "commentText"),
    invalid("<div>text\n// oops</div>", "commentText"),
  ],
});

ruleTester.run("no-danger-with-children", noDangerWithChildren, {
  valid: [
    tsx("<style dangerouslySetInnerHTML={{ __html: css }} />"),
    tsx("<div dangerouslySetInnerHTML={{ __html: x }}>\n</div>"),
    tsx("<div dangerouslySetInnerHTML={{ __html: x }}>{/* note */}</div>"),
    tsx("<div>child</div>"),
  ],
  invalid: [
    invalid("<div dangerouslySetInnerHTML={{ __html: x }}>child</div>", "dangerWithChildren"),
    invalid("<div dangerouslySetInnerHTML={{ __html: x }}>{value}</div>", "dangerWithChildren"),
    invalid("<div dangerouslySetInnerHTML={{ __html: x }} children='c' />", "dangerWithChildren"),
  ],
});

ruleTester.run("no-children-prop", noChildrenProp, {
  valid: [tsx("<div>child</div>"), tsx("<div {...props} />"), tsx("<Foo render={() => null} />")],
  invalid: [
    invalid("<div children='c' />", "childrenProp"),
    invalid("<Foo children={<a />} />", "childrenProp"),
  ],
});
