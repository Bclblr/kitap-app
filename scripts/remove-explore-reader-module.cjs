// One-time, syntax-aware removal of the reader suggestion module only.
const fs = require('node:fs');
const ts = require('typescript');
const file = 'src/app/explore.tsx';
const text = fs.readFileSync(file, 'utf8');
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const ranges = [];
function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(prop => ts.isJsxAttribute(prop) && prop.name.getText(source) === 'style' && prop.initializer?.getText(source) === '{styles.activeReadersSection}')) { ranges.push([node.getStart(source),node.end]); return; }
  if (ts.isTypeAliasDeclaration(node) && node.name.text === 'ActiveReader') { ranges.push([node.getStart(source),node.end]); return; }
  if (ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => ['[activeReaders, setActiveReaders]','[activeReadersLoading, setActiveReadersLoading]','loadActiveReaders'].includes(decl.name.getText(source)))) { ranges.push([node.getStart(source),node.end]); return; }
  if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === 'useEffect' && node.expression.arguments[1]?.getText(source) === '[loadActiveReaders]') { ranges.push([node.getStart(source),node.end]); return; }
  ts.forEachChild(node,visit);
}
visit(source);
if (ranges.length !== 6) throw Error(`Expected six precise removals, found ${ranges.length}`);
let output = text;
for (const [start,end] of ranges.sort((a,b)=>b[0]-a[0])) output = output.slice(0,start)+output.slice(end);
fs.writeFileSync(file,output);
console.log('Removed Explore reader module and its unused query; other loaders and styles preserved.');
