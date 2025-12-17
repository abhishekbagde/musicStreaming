const fs = require('fs')
const path = require('path')
const semver = require('semver')

const [, , releaseTypeArg = 'patch', ...messageParts] = process.argv
const releaseType = ['major', 'minor', 'patch'].includes(releaseTypeArg) ? releaseTypeArg : 'patch'
const summary = messageParts.join(' ').trim() || 'Automated deployment'

const packages = [
  { name: 'root', file: 'package.json' },
  { name: 'backend', file: path.join('backend', 'package.json') },
  { name: 'frontend', file: path.join('frontend', 'package.json') },
]

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))
const writeJson = (filePath, data) => fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)

const bumpVersion = (version) => {
  const safeVersion = typeof version === 'string' ? version : '0.0.0'
  const next = semver.inc(safeVersion, releaseType)
  if (!next) {
    throw new Error(`Unable to bump version "${safeVersion}" with release type "${releaseType}"`)
  }
  return next
}

let nextVersion

packages.forEach(({ file }) => {
  const fullPath = path.join(process.cwd(), file)
  const data = readJson(fullPath)
  const updated = bumpVersion(data.version)
  if (!nextVersion) {
    nextVersion = updated
  }
  data.version = updated
  writeJson(fullPath, data)
  console.log(`✓ ${file} bumped to v${updated}`)
})

const releaseNotesPath = path.join(process.cwd(), 'RELEASE_NOTES.md')
const releaseNotes = fs.readFileSync(releaseNotesPath, 'utf8')
const today = new Date().toISOString().split('T')[0]

const updatedTitle = releaseNotes.replace(
  /(Release Notes v)(\d+\.\d+\.\d+)/,
  (_, prefix) => `${prefix}${nextVersion}`
)

const insertionIndex = updatedTitle.indexOf('\n')
const before = updatedTitle.slice(0, insertionIndex + 1)
const after = updatedTitle.slice(insertionIndex + 1)
const newEntry = `\n## v${nextVersion} - ${today}\n\n- ${summary}\n`
const newReleaseNotes = `${before}${newEntry}${after.startsWith('\n') ? after : `\n${after}`}`
fs.writeFileSync(releaseNotesPath, newReleaseNotes)

console.log(`✓ RELEASE_NOTES.md updated with v${nextVersion}`)
console.log('Done!')
