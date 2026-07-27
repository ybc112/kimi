import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import solidity from "react-syntax-highlighter/dist/esm/languages/prism/solidity";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import vscDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";

for (const alias of ["bash", "sh", "shell"]) SyntaxHighlighter.registerLanguage(alias, bash);
SyntaxHighlighter.registerLanguage("css", css);
for (const alias of ["javascript", "js"]) SyntaxHighlighter.registerLanguage(alias, javascript);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("jsx", jsx);
for (const alias of ["markup", "html", "xml"]) SyntaxHighlighter.registerLanguage(alias, markup);
for (const alias of ["python", "py"]) SyntaxHighlighter.registerLanguage(alias, python);
SyntaxHighlighter.registerLanguage("solidity", solidity);
SyntaxHighlighter.registerLanguage("tsx", tsx);
for (const alias of ["typescript", "ts"]) SyntaxHighlighter.registerLanguage(alias, typescript);

export { SyntaxHighlighter, vscDarkPlus };
