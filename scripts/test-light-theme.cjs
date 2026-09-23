const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');

let scheme = 'light';
let palette;
const cache = {};
function compile(source, filename, dependencies) {
  const exports = {};
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(js, { exports, require: dependencies }, { filename });
  return exports;
}
function load(file) {
  if (cache[file]) return cache[file];
  return cache[file] = compile(fs.readFileSync(file, 'utf8'), file, dependency => {
    if (dependency === 'react') return { useMemo: fn => fn() };
    if (dependency.includes('ThemeProvider')) return { useAppTheme: () => ({ scheme, colors: palette[scheme] }) };
    if (dependency === './light-styles') return load('src/theme/light-styles.ts');
    throw Error(dependency);
  });
}
palette = load('src/theme/palette.ts').palette;
const hooks = load('src/theme/use-themed-styles.ts');
const plain = value => JSON.parse(JSON.stringify(value));
function luminance(hex) {
  const full = hex.length === 4 ? '#'+hex.slice(1).split('').map(c=>c+c).join('') : hex;
  const values = [1,3,5].map(i=>parseInt(full.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return values[0]*.2126+values[1]*.7152+values[2]*.0722;
}
function contrast(a,b) {const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);}
const c=palette.light;
let minimum=Infinity, pairs=0;
for (const foreground of ['text','textSecondary','textMuted','primary']) {
  for (const background of ['background','surface','surfaceElevated','surfaceSecondary','input','primarySoft']) {
    const ratio=contrast(c[foreground],c[background]);
    assert.ok(ratio>=4.5,`${foreground}/${background}: ${ratio}`);
    minimum=Math.min(minimum,ratio);pairs++;
  }
}
for (const [foreground,background] of [['onPrimary','primary'],['danger','dangerSoft'],['warning','warningSoft'],['success','successSoft']]) {
  assert.ok(contrast(c[foreground],c[background])>=4.5,`${foreground}/${background}`);pairs++;
}
assert.ok(contrast(c.border,c.input)>=3,'Input outline must remain distinguishable');
assert.equal(c.primary,'#6232B5');
assert.equal(c.accent,c.primary);
console.log(`${pairs} text contrast pairs pass AA; minimum neutral/primary text contrast ${minimum.toFixed(2)}:1; primary/onPrimary ${contrast(c.primary,c.onPrimary).toFixed(2)}:1.`);

function staticValue(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText().replace(/['"]/g,''),staticValue(p.initializer)]).filter(([,v])=>v!==undefined));
}
const files = ['src/app','src/components'].flatMap(root=>fs.readdirSync(root,{recursive:true}).filter(n=>n.endsWith('.tsx')).map(n=>`${root}/${n}`));
let styleCount=0, sheetCount=0;
const sheets=[];
for (const file of files) {
  const text=fs.readFileSync(file,'utf8');
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(source)==='StyleSheet.create') {
      const styles=staticValue(node.initializer.arguments[0]);
      if (styles && text.includes(`useThemedStyles(${node.name.getText(source)})`)) {
        sheets.push({file,styles});sheetCount++;styleCount+=Object.keys(styles).length;
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
}
const home=sheets.find(s=>s.file==='src/app/index.tsx').styles;
const themedHome=hooks.useThemedStyles(home);
assert.equal(themedHome.storyName.color,c.textSecondary);
assert.equal(themedHome.storyNameSeen.color,c.textSecondary);
assert.equal(themedHome.commentInput.backgroundColor,c.input);
assert.equal(themedHome.sendButton.backgroundColor,c.primary);
assert.equal(themedHome.sendText.color,c.onPrimary);
assert.equal(themedHome.floatingCreateIcon.color,c.onPrimary);
assert.equal(themedHome.addStoryIcon.color,c.primary);
assert.equal(themedHome.storyTextOverlay.backgroundColor,home.storyTextOverlay.backgroundColor);
for (const [file,button,label] of [['book','saveQuoteButton','saveQuoteText'],['explore','searchButton','searchButtonText'],['chat','sendButton','sendButtonText'],['messages','unreadBadge','unreadBadgeText']]) {
  const styles=hooks.useThemedStyles(sheets.find(s=>s.file===`src/app/${file}.tsx`).styles);
  assert.equal(styles[button].backgroundColor,c.primary,`${file}/${button}`);
  assert.equal(styles[label].color,c.onPrimary,`${file}/${label}`);
}
console.log('Feed, book actions, discovery search, message badges, composer and media-overlay regression checks pass.');

const login=sheets.find(s=>s.file==='src/app/login.tsx').styles;
const lightLogin=hooks.useThemedStyles(login);
assert.equal(lightLogin.disabledButtonText.color,c.onPrimary);
assert.ok(lightLogin.disabledButton.opacity>=.8);
const review=hooks.useThemedStyles(sheets.find(s=>s.file==='src/app/review.tsx').styles);
assert.equal(review.bottomBar.backgroundColor,c.surface);
const read=hooks.useThemedStyles(sheets.find(s=>s.file==='src/app/read.tsx').styles);
assert.equal(read.continueButtonArrow.color,c.onPrimary);
scheme='dark';
const darkHome=hooks.useThemedStyles(home);
assert.equal(darkHome.storyName.color,'#D0D0D6');
assert.equal(darkHome.storyNameSeen.color,'rgba(160,160,170,0.58)');
assert.equal(darkHome.floatingCreateIcon.color,'#0A0A0E');
assert.equal(darkHome.floatingCreateButton.backgroundColor,'#A985FF');
assert.equal(hooks.useThemedStyles(login).disabledButton.opacity,.38);
const authoredCard={card:{backgroundColor:'#15151D',color:'#F5F5F8'}};
assert.equal(hooks.useLightStyles(authoredCard,{card:{backgroundColor:'surface',color:'text'}}),authoredCard);
assert.equal(hooks.useLightColor()('primary','#8058D9'),'#8058D9');
scheme='light';
assert.equal(hooks.useLightStyles(authoredCard,{card:{backgroundColor:'surface',color:'text'}}).card.backgroundColor,c.surface);
assert.equal(hooks.useLightColor()('primary','#8058D9'),c.primary);
console.log('Theme switching, authored dark styles, disabled buttons and review footer checks pass.');

// Optional review-time comparison against the exact pre-change repository version.
if (process.argv.includes('--compare-head')) {
  const readOld=file=>execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8'});
  const oldPalette=compile(readOld('src/theme/palette.ts'),'old-palette',()=>{}).palette;
  for (const [key,value] of Object.entries(oldPalette.dark)) assert.equal(palette.dark[key],value,`Dark palette: ${key}`);
  scheme='dark';
  const oldHooks=compile(readOld('src/theme/use-themed-styles.ts'),'old-hook',dependency=>dependency==='react'?{useMemo:fn=>fn()}:{useAppTheme:()=>({scheme:'dark',colors:oldPalette.dark})});
  for (const {file,styles} of sheets) assert.deepEqual(plain(hooks.useThemedStyles(styles)),plain(oldHooks.useThemedStyles(styles)),`Dark styles changed: ${file}`);
  const original={card:{backgroundColor:'#15151D',color:'#F5F5F8'}};
  assert.equal(hooks.useLightStyles(original,{card:{backgroundColor:'surface',color:'text'}}),original);
  assert.equal(hooks.useLightColor()('primary','#8058D9'),'#8058D9');
  console.log(`Dark regression: ${sheetCount} stylesheets / ${styleCount} styles equal HEAD; all existing dark palette tokens unchanged.`);
  let authoredComponents=0;
  for (const file of files.filter(file=>fs.readFileSync(file,'utf8').includes('useLightStyles(baseStyles, lightTokens)'))) {
    function authored(sourceText) {
      const source=ts.createSourceFile(file,sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      let result;
      function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(source)==='StyleSheet.create') result=staticValue(node.arguments[0]);
        ts.forEachChild(node,visit);
      }
      visit(source);return result;
    }
    const current=authored(fs.readFileSync(file,'utf8'));
    assert.deepEqual(current,authored(readOld(file)),`Authored dark styles changed: ${file}`);
    assert.equal(hooks.useLightStyles(current,{}),current);
    authoredComponents++;
  }
  console.log(`${authoredComponents} newly connected components retain their exact authored dark styles.`);
}

if (process.argv.includes('--inspect')) {
  scheme='light';
  for (const {file,styles} of sheets) {
    const resolved=hooks.useThemedStyles(styles);
    for (const [name,style] of Object.entries(resolved)) {
      if (/^#[a-f\d]{6}$/i.test(style.color??'') && /^#[a-f\d]{6}$/i.test(style.backgroundColor??'') && contrast(style.color,style.backgroundColor)<4.5) console.log('REVIEW',file,name,style.color,style.backgroundColor);
    }
  }
}

if (process.argv.includes('--inspect-parents')) {
  scheme='light';
  for (const {file,styles} of sheets) {
    const resolved=hooks.useThemedStyles(styles);
    const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function elementStyle(node) {
      const opening=ts.isJsxElement(node)?node.openingElement:ts.isJsxSelfClosingElement(node)?node:null;
      if (!opening) return {};
      const attribute=opening.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==='style');
      const result={};
      function collect(n) {
        if (ts.isPropertyAccessExpression(n)&&n.expression.getText(source)==='styles') Object.assign(result,resolved[n.name.text]??{});
        else if (!ts.isConditionalExpression(n) && !ts.isBinaryExpression(n)) ts.forEachChild(n,collect);
      }
      if(attribute)collect(attribute);
      return result;
    }
    function visit(node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source)==='Text') {
        const style=elementStyle(node);
        let background=style.backgroundColor, parent=node.parent;
        while(!background && parent) { background=elementStyle(parent).backgroundColor;parent=parent.parent; }
        if (/^#[a-f\d]{6}$/i.test(style.color??'')&&/^#[a-f\d]{6}$/i.test(background??'')&&contrast(style.color,background)<4.5) console.log('PARENT REVIEW',file,source.getLineAndCharacterOfPosition(node.pos).line+1,style.color,background);
      }
      ts.forEachChild(node,visit);
    }
    visit(source);
  }
}
