const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace("import { SettingsView } from './components/views/SettingsView';", "import { SettingsView } from './components/views/SettingsView';\nimport { AboutView } from './components/views/AboutView';");
code = code.replace("case 'settings':\n      case 'about': return <SettingsView />;", "case 'settings': return <SettingsView />;\n      case 'about': return <AboutView />;");
fs.writeFileSync('src/App.tsx', code);
