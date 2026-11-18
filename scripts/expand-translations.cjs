const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const apply = process.argv.includes('--apply')
const refresh = process.argv.includes('--refresh')
const catalog = {}
if(refresh && fs.existsSync(path.join(root,'src/lib/translation-catalog.json')))Object.assign(catalog,JSON.parse(fs.readFileSync(path.join(root,'src/lib/translation-catalog.json'),'utf8')))
const legacyByText=new Map()
const legacySource=ts.createSourceFile('i18n.ts',fs.readFileSync(path.join(root,'src/lib/i18n.ts'),'utf8'),ts.ScriptTarget.Latest,true)
function legacyScan(node){if(ts.isPropertyAssignment(node)&&node.name.getText(legacySource)==='en'&&ts.isObjectLiteralExpression(node.initializer))for(const p of node.initializer.properties)if(ts.isPropertyAssignment(p)&&ts.isStringLiteralLike(p.initializer)){const key=p.name.getText(legacySource).replace(/^['"]|['"]$/g,'');catalog[key]=p.initializer.text;if(!legacyByText.has(p.initializer.text))legacyByText.set(p.initializer.text,key)}ts.forEachChild(node,legacyScan)}
legacyScan(legacySource)
const friendlyAttributes = new Set(['title','description','placeholder','alt','aria-label','aria-description','label','hint','emptyLabel','actionLabel'])
const friendlyProperties = new Set(['label','title','description','hint','placeholder','question','answer','subtitle','tagline','q','message'])
const protectedNames = new Set(['name','email','body','content','comment','text','children','message','value','country','language','currency','slug','id','code'])
function files(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.(tsx?|json)$/.test(e.name)?[path.join(dir,e.name)]:[]) }
function phrase(text) { return typeof text==='string' && /[A-Za-z]/.test(text) && text.length<=2000 && !/^(?:https?:|\/|@\/|data:|#[\da-f]+$)/i.test(text) }
function add(text) { if(!phrase(text))return; const key=legacyByText.get(text)||'ui.'+crypto.createHash('sha256').update(text).digest('hex').slice(0,14);if(catalog[key]&&catalog[key]!==text)throw Error('Translation key collision');catalog[key]=text }
for(const country of Object.values(require('countries-and-timezones').getAllCountries()))add(country.name)
function decode(text) { return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,v)=>v[0]==='#'?String.fromCodePoint(parseInt(v.slice(v[1].toLowerCase()==='x'?2:1),v[1].toLowerCase()==='x'?16:10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'})[v.toLowerCase()]) }
function jsxText(text) { const lines=text.split(/\r\n|\n|\r/);let last=0;for(let i=0;i<lines.length;i++)if(/[^ \t]/.test(lines[i]))last=i;let result='';for(let i=0;i<lines.length;i++){let line=lines[i].replace(/\t/g,' ');if(i)line=line.replace(/^ +/,'');if(i<lines.length-1)line=line.replace(/ +$/,'');if(line)result+=line+(i<last?' ':'')}return decode(result) }
const sourceFiles=files(path.join(root,'src')).filter(f=>/\.tsx?$/.test(f)&&!f.endsWith('i18n.ts')&&!f.endsWith('ui-text.ts')&&!f.endsWith('translation-catalog.ts'))
for(const file of sourceFiles){
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  function scan(node){
    if(ts.isJsxText(node))add(jsxText(node.text))
    if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='uiText'&&node.arguments[0]&&ts.isStringLiteralLike(node.arguments[0]))add(node.arguments[0].text)
    if(ts.isJsxAttribute(node)&&friendlyAttributes.has(node.name.getText(source))&&node.initializer&&ts.isStringLiteral(node.initializer))add(decode(node.initializer.text))
    if(ts.isPropertyAssignment(node)&&friendlyProperties.has(node.name.getText(source).replace(/^['"]|['"]$/g,''))&&ts.isStringLiteralLike(node.initializer))add(node.initializer.text)
    if(ts.isStringLiteralLike(node)&&/\s/.test(node.text)&&phrase(node.text)&&!/[{}<>]|(?:--|\[|\])/.test(node.text)&&!/(?:className|fontFamily|style|selector|querySelector)/.test(node.parent.getText(source).slice(0,50)))add(node.text)
    if(ts.isStringLiteralLike(node)&&/^[A-Z][a-zA-Z -]{1,60}$/.test(node.text)&&/[a-z]/.test(node.text))add(node.text)
    if(ts.isJsxExpression(node)&&node.expression){const e=node.expression;if(ts.isStringLiteralLike(e))add(e.text);if(ts.isConditionalExpression(e)){for(const n of[e.whenTrue,e.whenFalse])if(ts.isStringLiteralLike(n))add(n.text)}}
    ts.forEachChild(node,scan)
  }
  scan(source)
}
const changes=[]
for(const file of sourceFiles.filter(f=>!refresh&&f.endsWith('.tsx')&&f.includes(path.sep+'components'+path.sep))){
  const original=fs.readFileSync(file,'utf8')
  if(original.includes("from '@/lib/ui-text'")||original.includes("from'@/lib/ui-text'"))continue
  const source=ts.createSourceFile(file,original,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let count=0
  const result=ts.transform(source,[context=>{
    const f=context.factory
    const call=(value,vars)=>{count++;return f.createCallExpression(f.createIdentifier('uiText'),undefined,[value,...(vars?[vars]:[])])}
    function display(expression){
      if(ts.isJsxElement(expression)||ts.isJsxSelfClosingElement(expression)||ts.isJsxFragment(expression))return ts.visitNode(expression,visit)
      if(ts.isCallExpression(expression)&&ts.isIdentifier(expression.expression)&&['uiText','t'].includes(expression.expression.text))return expression
      if(ts.isConditionalExpression(expression))return f.updateConditionalExpression(expression,ts.visitNode(expression.condition,visit),expression.questionToken,display(expression.whenTrue),expression.colonToken,display(expression.whenFalse))
      if(ts.isBinaryExpression(expression)&&[ts.SyntaxKind.BarBarToken,ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind))return f.updateBinaryExpression(expression,ts.visitNode(expression.left,visit),expression.operatorToken,display(expression.right))
      if(ts.isBinaryExpression(expression)&&expression.operatorToken.kind===ts.SyntaxKind.PlusToken){
        const parts=[];const flatten=n=>{if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken){flatten(n.left);flatten(n.right)}else parts.push(n)};flatten(expression)
        if(parts.some(ts.isStringLiteralLike)){let text='';const params=[];for(const part of parts){if(ts.isStringLiteralLike(part))text+=part.text;else{const key='value'+(params.length+1);text+='{{'+key+'}}';params.push(f.createPropertyAssignment(key,ts.visitNode(part,visit)))}}if(phrase(text)){add(text);return call(f.createStringLiteral(text),f.createObjectLiteralExpression(params))}}
      }
      if(ts.isTemplateExpression(expression)){
        let text=expression.head.text;const params=[]
        for(let i=0;i<expression.templateSpans.length;i++){const span=expression.templateSpans[i],key='value'+(i+1);text+='{{'+key+'}}'+span.literal.text;params.push(f.createPropertyAssignment(key,ts.visitNode(span.expression,visit)))}
        if(phrase(text)){add(text);return call(f.createStringLiteral(text),f.createObjectLiteralExpression(params))}
      }
      if(ts.isStringLiteralLike(expression)){if(phrase(expression.text)){add(expression.text);return call(f.createStringLiteral(expression.text))}return expression}
      if(ts.isIdentifier(expression)&&protectedNames.has(expression.text))return expression
      if(ts.isIdentifier(expression)&&/(?:name|email|body|content|comment)$/i.test(expression.text))return expression
      if(!ts.isStringLiteralLike(expression)&&/\.(?:name|email|body|content|comment)\b/.test(expression.getText(source)))return ts.visitNode(expression,visit)
      if(ts.isPropertyAccessExpression(expression)&&protectedNames.has(expression.name.text))return expression
      if(ts.isPropertyAccessExpression(expression)&&/^(?:page|post|review|message|notification|testimonial|slide|user|tutor|student)\b/.test(expression.getText(source)))return expression
      const value=ts.visitNode(expression,visit)
      if(ts.isArrowFunction(expression)||ts.isFunctionExpression(expression)||ts.isObjectLiteralExpression(expression))return value
      // Known catalogue entries are translated; numbers, elements and unknown
      // user-generated strings pass through unchanged.
      return call(value)
    }
    function visit(node){
      if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)==='option'&&!node.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==='value')){
        const children=node.children.filter(n=>!ts.isJsxText(n)||jsxText(n.text).trim())
        if(children.length===1){const child=children[0],value=ts.isJsxExpression(child)?child.expression:ts.isJsxText(child)?f.createStringLiteral(jsxText(child.text)):undefined
          if(value){const attrs=f.updateJsxAttributes(node.openingElement.attributes,[...node.openingElement.attributes.properties,f.createJsxAttribute(f.createIdentifier('value'),f.createJsxExpression(undefined,value))]);const opening=f.updateJsxOpeningElement(node.openingElement,node.openingElement.tagName,node.openingElement.typeArguments,attrs);return f.updateJsxElement(node,opening,node.children.map(c=>ts.visitNode(c,visit)),node.closingElement)}
        }
      }
      if(ts.isJsxText(node)){const text=jsxText(node.text);if(phrase(text)){add(text);return f.createJsxExpression(undefined,call(f.createStringLiteral(text)))}return node}
      if(ts.isJsxAttribute(node)&&friendlyAttributes.has(node.name.getText(source))&&node.initializer){
        if(ts.isStringLiteral(node.initializer)){const text=decode(node.initializer.text);if(phrase(text)){add(text);return f.updateJsxAttribute(node,node.name,f.createJsxExpression(undefined,call(f.createStringLiteral(text))))}}
        if(ts.isJsxExpression(node.initializer)&&node.initializer.expression)return f.updateJsxAttribute(node,node.name,f.updateJsxExpression(node.initializer,display(node.initializer.expression)))
      }
      if(ts.isJsxExpression(node)&&node.expression&&(ts.isJsxElement(node.parent)||ts.isJsxFragment(node.parent)))return f.updateJsxExpression(node,display(node.expression))
      return ts.visitEachChild(node,visit,context)
    }
    return node=>ts.visitNode(node,visit)
  }])
  if(count){
    const transformed=result.transformed[0],statements=[...transformed.statements]
    let index=0;while(index<statements.length&&ts.isExpressionStatement(statements[index])&&ts.isStringLiteral(statements[index].expression))index++
    statements.splice(index,0,ts.factory.createImportDeclaration(undefined,ts.factory.createImportClause(false,undefined,ts.factory.createNamedImports([ts.factory.createImportSpecifier(false,undefined,ts.factory.createIdentifier('uiText'))])),ts.factory.createStringLiteral('@/lib/ui-text')))
    const output=ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(ts.factory.updateSourceFile(transformed,statements))
    changes.push({file,count,output,original})
  }
  result.dispose()
}
if(apply){
  const backup=path.join(root,'.local-backups','translations-before-20261118')
  for(const c of changes){const relative=path.relative(root,c.file),target=path.join(backup,relative);fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target))fs.writeFileSync(target,c.original);fs.writeFileSync(c.file,c.output)}
  fs.writeFileSync(path.join(root,'src/lib/translation-catalog.json'),JSON.stringify(Object.fromEntries(Object.entries(catalog).sort((a,b)=>a[1].localeCompare(b[1]))),null,2)+'\n')
}
if(apply)require('./export-translation-files.cjs')
console.log(JSON.stringify({apply,keywords:Object.keys(catalog).length,components:changes.length,translatedExpressions:changes.reduce((sum,c)=>sum+c.count,0)}))
