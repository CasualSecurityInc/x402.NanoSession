const fs = require('fs');
const path = require('path');

const SPEC_REV = process.env.SPEC_REV || 'rev3';
const SOURCE_DIR = path.resolve(__dirname, '../../docs');
const TARGET_DIR = path.resolve(__dirname, '../docs');
const EXTENSIONS_DIR = path.join(TARGET_DIR, 'extensions');
const APPENDIX_DIR = path.join(TARGET_DIR, 'appendix');

console.log(`Building documentation for revision: ${SPEC_REV}`);

// Ensure target directories exist and are clean
if (fs.existsSync(TARGET_DIR)) {
  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TARGET_DIR, { recursive: true });
fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
fs.mkdirSync(APPENDIX_DIR, { recursive: true });

// Filter and classify files
const files = fs.readdirSync(SOURCE_DIR);
let introFile = null;
let protocolFile = null;
let glossaryFile = null;
const extensionFiles = [];

files.forEach(file => {
  if (file.includes(SPEC_REV) && file.startsWith('x402_NanoSession_')) {
    if (file.includes('Intro')) {
      introFile = file;
    } else if (file.includes('Protocol')) {
      protocolFile = file;
    } else if (file.includes('Glossary')) {
      glossaryFile = file;
    } else {
      extensionFiles.push(file);
    }
  }
});

if (!introFile) {
  console.error(`ERROR: No Intro file found for revision ${SPEC_REV}!`);
  process.exit(1);
}

if (!protocolFile) {
  console.error(`ERROR: No Protocol file found for revision ${SPEC_REV}!`);
  process.exit(1);
}

// Process Extension Files first to build the list
const extensionLinks = [];
const fileMapping = {}; // Map source filename -> target web path

extensionFiles.sort().forEach(file => {
  const content = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8');

  // Clean up extension filenames for URL friendliness
  // x402_NanoSession_rev3_Extension_A_Pools.md -> extension-a-pools.md
  // Remove the prefix dynamically based on the known format
  const simpleName = file
    .replace(/^x402_NanoSession_rev\d+_/, '') // Remove prefix like "x402_NanoSession_rev3_"
    .replace(/_/g, '-') // Convert underscores to dashes
    .toLowerCase(); // Lowercase

  const targetFilename = `${simpleName}`;
  const targetPath = path.join(EXTENSIONS_DIR, targetFilename);
  const webPath = `/extensions/${simpleName.replace('.md', '')}`;

  fileMapping[file] = webPath;

  // Hack: Also map the "non-rev" version of the filename in case the source markdown uses it
  // e.g. x402_NanoSession_rev3_Extension_A_Pools.md -> Map x402_NanoSession_Extension_A_Pools.md too
  const nonRevName = file.replace(/_rev\d+/, '');
  fileMapping[nonRevName] = webPath;

  // Extract Title for link text (simplistic approach: first H1 or filename)
  const titleMatch = content.match(/^#\s+(.*)$/m);
  const title = titleMatch ? titleMatch[1] : simpleName;

  extensionLinks.push({ text: title, link: webPath });

  // Inject "Back to Protocol" link at the top
  const backLink = `\n[← Back to Protocol](/protocol)\n\n`;
  const newContent = backLink + content;

  fs.writeFileSync(targetPath, newContent);
  console.log(`Processed Extension: ${file} -> extensions/${targetFilename}`);
});

// Process Protocol File
let protocolContent = fs.readFileSync(path.join(SOURCE_DIR, protocolFile), 'utf8');

// Replace links to extensions with their new Web Paths
Object.keys(fileMapping).forEach(sourceName => {
  // Replace [Link Text](sourceName) with [Link Text](targetPath)
  // We escape the sourceName for regex use
  const escapedName = sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\(${escapedName}\\)`, 'g');
  protocolContent = protocolContent.replace(regex, `(${fileMapping[sourceName]})`);
});

// Inject "Tree View" at the top
let treeView = `\n### 📂 Specification Structure\n- **Protocol**: [${SPEC_REV} Protocol Definition](/protocol)\n`;
if (extensionLinks.length > 0) {
  treeView += `- **Extensions**:\n`;
  extensionLinks.forEach(ext => {
    treeView += `  - [${ext.text}](${ext.link})\n`;
  });
}
treeView += `\n---\n\n`;

// Inject "See Also" at the bottom
let seeAlso = `\n\n## 📚 Related Extensions\n`;
if (extensionLinks.length > 0) {
  extensionLinks.forEach(ext => {
    seeAlso += `- [${ext.text}](${ext.link})\n`;
  });
} else {
  seeAlso += `*No extensions found for this revision.*\n`;
}

// Prepend Tree View, Append See Also
const finalProtocolContent = treeView + protocolContent + seeAlso;

fs.writeFileSync(path.join(TARGET_DIR, 'protocol.md'), finalProtocolContent);
console.log(`Processed Protocol: ${protocolFile} -> protocol.md`);

// Process Intro File - now the homepage
const introContent = fs.readFileSync(path.join(SOURCE_DIR, introFile), 'utf8');
fs.writeFileSync(path.join(TARGET_DIR, 'index.md'), introContent);
console.log(`Processed Intro: ${introFile} -> index.md`);

// Process Glossary File (if exists)
if (glossaryFile) {
  const glossaryContent = fs.readFileSync(path.join(SOURCE_DIR, glossaryFile), 'utf8');
  fs.writeFileSync(path.join(APPENDIX_DIR, 'glossary.md'), glossaryContent);
  console.log(`Processed Glossary: ${glossaryFile} -> appendix/glossary.md`);
} else {
  console.log(`Note: No Glossary file found for revision ${SPEC_REV}`);
}
