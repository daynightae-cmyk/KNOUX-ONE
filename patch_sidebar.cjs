const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');

const replacement = `    items: [
      { id: 'cloud', route: 'cloud', titleEn: 'Cloud & support', titleAr: 'السحابة والدعم', descriptionEn: 'Account and support capabilities', descriptionAr: 'خدمات الحساب والدعم', icon: Cloud },
      { id: 'settings', route: 'settings', titleEn: 'Settings', titleAr: 'الإعدادات', descriptionEn: 'Appearance, language, accessibility', descriptionAr: 'المظهر واللغة وإمكانية الوصول', icon: Settings },
      { id: 'about', route: 'about', titleEn: 'About KNOUX ONE', titleAr: 'عن كنوكس ون', descriptionEn: 'Product identity and architecture', descriptionAr: 'هوية المنتج ومعماريته', icon: Info },
      { id: 'brand-gallery', route: 'brand-gallery', titleEn: 'Brand Gallery', titleAr: 'معرض الهوية', descriptionEn: 'Official visual gallery', descriptionAr: 'معرض المراجع البصرية الرسمي', icon: ImageIcon },
      { id: 'web-landing', route: 'web-landing', titleEn: 'Web Landing', titleAr: 'صفحة الويب', descriptionEn: 'Public web overview', descriptionAr: 'النظرة العامة لصفحة الويب', icon: LayoutTemplate }
    ],`;

code = code.replace(/    items: \[\n      \{ id: 'cloud'[\s\S]*?icon: Info \},\n    \],/, replacement);

if (!code.includes('import {') || !code.includes('LayoutTemplate')) {
  code = code.replace("Info", "Info,\n  Image as ImageIcon,\n  LayoutTemplate");
}

fs.writeFileSync('src/components/layout/Sidebar.tsx', code);
