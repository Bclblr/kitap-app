// Narrow AST edit: changes only a StyleSheet variable name, imports and component hook declarations.
// No style property, layout, JSX or color literal is rewritten.
const fs = require('node:fs');
const ts = require('typescript');
const files = [...fs.readdirSync('src/app').filter(n => n.endsWith('.tsx') && n !== '_layout.tsx').map(n=>'src/app/'+n),
 'src/components/BottomNav.tsx','src/components/ReadersList.tsx','src/components/WorksList.tsx','src/components/ChatActions.tsx','src/components/StoryActions.tsx'];
for(const file of files) {
 let text=fs.readFileSync(file,'utf8');
 const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const edits=[];
 let hasStyles=false, hasUI=false;
 for(const statement of source.statements) {
  if(ts.isVariableStatement(statement)) for(const decl of statement.declarationList.declarations) {
   if(decl.name.getText(source)==='styles' && decl.initializer && ts.isCallExpression(decl.initializer) && decl.initializer.expression.getText(source)==='StyleSheet.create') {
    edits.push({start:decl.name.getStart(source),end:decl.name.end,text:'baseStyles'}); hasStyles=true;
   }
  }
  if(ts.isImportDeclaration(statement) && statement.moduleSpecifier.text.includes('ReaderUI')) {
   const bindings=statement.importClause?.namedBindings;
   if(bindings && ts.isNamedImports(bindings)) for(const spec of bindings.elements) if(spec.name.text==='ui') {
    edits.push({start:spec.getStart(source),end:spec.end,text:'useReaderStyles'}); hasUI=true;
   }
  }
 }
 if(!hasStyles && !hasUI) continue;
 if(hasStyles) edits.push({start:0,end:0,text:"import { useThemedStyles } from '@/theme/use-themed-styles';\n"});
 for(const statement of source.statements) if(ts.isFunctionDeclaration(statement) && statement.body) {
  const names=new Set();
  function visit(node) { if(ts.isIdentifier(node)) names.add(node.text); ts.forEachChild(node,visit); }
  visit(statement.body);
  let hook='';
  if(hasStyles && names.has('styles')) hook+='\n  const styles = useThemedStyles(baseStyles);';
  if(hasUI && names.has('ui')) hook+='\n  const ui = useReaderStyles();';
  if(hook) {
   if(!/^[A-Z]/.test(statement.name?.text ?? '')) throw Error('Review non-component scope: '+file+':'+statement.name?.text);
   edits.push({start:statement.body.getStart(source)+1,end:statement.body.getStart(source)+1,text:hook});
  }
 }
 console.log(file+': '+edits.length+' scoped edits');
 if(process.argv.includes('--apply')) { for(const edit of edits.sort((a,b)=>b.start-a.start)) text=text.slice(0,edit.start)+edit.text+text.slice(edit.end); fs.writeFileSync(file,text); }
}
