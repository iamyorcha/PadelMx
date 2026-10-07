import * as fs from 'fs';
import * as path from 'path';

interface ButtonEntry {
  file: string;
  line: number;
  snippet: string;
  hasDisabled: boolean;
  hasOnClick: boolean;
  handler: string;
  guards: string;
}

const dir = 'src';

function scanDir(currentPath: string): string[] {
  let files: string[] = [];
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(scanDir(full));
    } else if (entry.name.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

const allTsx = scanDir(dir);
console.log(`Scanning ${allTsx.length} TSX files for button elements...`);

const buttons: ButtonEntry[] = [];

for (const file of allTsx) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('<button') || line.includes('<Button')) {
      // gather full button tag across lines
      let snippet = line;
      let j = i;
      while (!snippet.includes('>') && j < lines.length - 1) {
        j++;
        snippet += ' ' + lines[j].trim();
      }
      
      const hasDisabled = snippet.includes('disabled');
      const hasOnClick = snippet.includes('onClick');
      
      const onClickMatch = snippet.match(/onClick=\{([^}]+)\}/);
      const disabledMatch = snippet.match(/disabled=\{([^}]+)\}/);
      
      buttons.push({
        file: path.relative('.', file),
        line: i + 1,
        snippet: snippet.slice(0, 100).replace(/\s+/g, ' '),
        hasDisabled,
        hasOnClick,
        handler: onClickMatch ? onClickMatch[1] : (hasOnClick ? 'inline/custom' : 'none'),
        guards: disabledMatch ? disabledMatch[1] : (hasDisabled ? 'disabled' : 'NONE')
      });
    }
  }
}

console.log(`Found ${buttons.length} buttons total.\n`);
console.table(buttons.map(b => ({
  File: b.file.replace('src/components/', '').replace('src/', ''),
  Line: b.line,
  OnClick: b.hasOnClick ? 'YES' : 'NO',
  Guarded: b.guards !== 'NONE' ? b.guards.slice(0, 25) : 'NO GUARD'
})));
