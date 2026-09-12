// Import-only AST edit; preview opt-in is applied manually at each local image picker.
const fs=require('node:fs'); const ts=require('typescript');
const files=['src/app','src/components'].flatMap(dir=>fs.readdirSync(dir).filter(n=>n.endsWith('.tsx')&&n!=='SafeImage.tsx').map(n=>dir+'/'+n));
for(const file of files) {
 let text=fs.readFileSync(file,'utf8'); const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX); const edits=[];
 for(const node of source.statements) if(ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='react-native') {
  const bindings=node.importClause?.namedBindings;
  if(bindings&&ts.isNamedImports(bindings)&&bindings.elements.some(s=>s.name.text==='Image')) {
   const remaining=bindings.elements.filter(s=>s.name.text!=='Image').map(s=>s.getText(source));
   edits.push({start:node.getStart(source),end:node.end,text:`import { ${remaining.join(', ')} } from 'react-native';\nimport Image from '@/components/SafeImage';`});
  }
 }
 if(edits.length) { console.log(file); if(process.argv.includes('--apply')) {for(const edit of edits.sort((a,b)=>b.start-a.start)) text=text.slice(0,edit.start)+edit.text+text.slice(edit.end); fs.writeFileSync(file,text);} }
}
