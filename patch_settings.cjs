const fs = require('fs');

let code = fs.readFileSync('src/components/views/SettingsAboutView.tsx', 'utf8');

// The file exports SettingsAboutView
code = code.replace(/export const SettingsAboutView: React\.FC = \(\) => \{/, 'export const SettingsView: React.FC = () => {');
code = code.replace(/<article className="knoux-glass-panel p-6">\s*<div className="flex items-start justify-between gap-4">[\s\S]*?<\/article>/, '');
code = code.replace(/<section className="knoux-glass-panel flex items-start gap-3 p-5 rtl:flex-row-reverse">[\s\S]*?<\/section>/, '');
code = code.replace(/Settings & About/, 'Settings');
code = code.replace(/الإعدادات وحول البرنامج/, 'الإعدادات');
code = code.replace(/import \{.*?OFFICIAL_KNOUX_ASSETS.*?\} from '\.\.\/\.\.\/lib\/constants';/, '');

fs.writeFileSync('src/components/views/SettingsView.tsx', code);
fs.unlinkSync('src/components/views/SettingsAboutView.tsx');
