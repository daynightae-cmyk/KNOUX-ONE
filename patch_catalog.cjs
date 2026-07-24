const fs = require('fs');

let code = fs.readFileSync('src/data/capabilitiesCatalog.ts', 'utf8');

// Change implementationState of M07 to 'implemented'
code = code.replace(/implementationState: 'partial', handlerId: 'm07/g, "implementationState: 'implemented', handlerId: 'm07");

// Same for the missing m01 handlers
const m01_handlers = [
  'm01.winget.diagnose',
  'm01.software.catalog',
  'm01.software.install_queue',
  'm01.software.import_list',
  'm01.software.export_inventory',
  'm01.profile.manage',
  'm01.queue.manage',
  'm01.restore_point.create'
];
for (const handler of m01_handlers) {
  code = code.replace(
    new RegExp("implementationState: 'partial', handlerId: '" + handler + "'", 'g'),
    "implementationState: 'implemented', handlerId: '" + handler + "'"
  );
}

fs.writeFileSync('src/data/capabilitiesCatalog.ts', code);
