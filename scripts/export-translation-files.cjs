const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const source = ts.createSourceFile('i18n.ts', fs.readFileSync(path.join(root, 'src/lib/i18n.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
const dictionaries = {}
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'DICT' && node.initializer && ts.isObjectLiteralExpression(node.initializer))
    for (const language of node.initializer.properties) if (ts.isPropertyAssignment(language) && ts.isObjectLiteralExpression(language.initializer)) {
      const values = {}
      for (const item of language.initializer.properties) if (ts.isPropertyAssignment(item) && ts.isStringLiteralLike(item.initializer)) values[item.name.getText(source).replace(/^['"]|['"]$/g, '')] = item.initializer.text
      dictionaries[language.name.getText(source).replace(/^['"]|['"]$/g, '')] = values
    }
  ts.forEachChild(node, visit)
}
visit(source)
const english = { ...JSON.parse(fs.readFileSync(path.join(root, 'src/lib/translation-catalog.json'), 'utf8')), ...dictionaries.en }
const output = path.join(root, 'public/translations')
fs.mkdirSync(output, { recursive: true })
for (const [language, values] of Object.entries(dictionaries)) fs.writeFileSync(path.join(output, `translations-${language}.json`), JSON.stringify(Object.fromEntries(Object.keys(english).sort().map(key => [key, values[key] || english[key]])), null, 2) + '\n')
console.log(`Translation files: ${Object.keys(english).length} keywords per language`)
