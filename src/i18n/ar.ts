/**
 * KNOUX ONE — Arabic Translations Dictionary
 */

import { en } from './en';

export const ar: Record<keyof typeof en, string> = {
  appTitle: 'كنوكس ون',
  appSubtitle: 'منظومة ويندوز والمطور الذكية',
  brandTagline: 'ابنِ • احمِ • حسّن',
  authorAttribution: 'تطوير المهندس صادق الجزار (Knoux)',

  // Navigation & Routes
  navDashboard: 'اللوحة الرئيسية الشاملة',
  navFirstRun: 'البداية وإعداد ما بعد الفورمات',
  navCleanup: 'التنظيف الذكي',
  navDuplicates: 'البحث عن الملفات المكررة',
  navStorage: 'تحليل مساحة التخزين',
  navStartup: 'برامج البدء والخدمات',
  navPerformance: 'مركز الأداء والأحمال',
  navRepair: 'مركز إصلاح نظام ويندوز',
  navNetwork: 'الشبكة والاتصال بالإنترنت',
  navPrivacy: 'مركز الخصوصية',
  navSecurity: 'مركز الأمان والحماية',
  navBackup: 'النسخ الاحتياطي والاستعادة',
  navApplications: 'التطبيقات والتعريفات',
  navFileTools: 'أدوات ومعالجة الملفات',
  navAutomation: 'الأتمتة والإنتاجية',
  navDeveloper: 'استوديو المطورين',
  navProjectTools: 'أدوات المشاريع والكود',
  navDiagnostics: 'السجلات والتشخيص',
  navHardware: 'العتاد وفحص الجهاز',
  navCloud: 'سحابة كنوكس والدعم الفني',
  navBrandGallery: 'الشعارات والمعرض البصري',
  navCatalog: 'دليل كافة الوظائف 190',
  navWebLanding: 'صفحة الويب التعريفية',
  navSettings: 'الإعدادات وعن البرنامج',

  // Statuses
  statusAvailable: 'متاحة للتنفيذ',
  statusImplemented: 'مفعلة بالكامل',
  statusPartial: 'وظيفة جزئية',
  statusPlanned: 'مخطط لها مستقبلاً',
  statusRequiresConfig: 'تتطلب إعدادات إضافية',
  statusRequiresAdmin: 'تتطلب صلاحيات المسؤول',
  statusUnsupported: 'غير مدعومة بنظام التشغيل',

  // Actions
  actionPreview: 'معاينة النتيجة',
  actionExecute: 'تشغيل الأداة',
  actionCancel: 'إلغاء العملية',
  actionQuarantine: 'نقل للمحجر الآمن',
  actionRestore: 'استعادة الملف',
  actionDelete: 'حذف نهائي',
  actionRefresh: 'تحديث البيانات',
  actionExport: 'تصدير التقرير',

  // Common UI
  searchPlaceholder: 'ابحث في 190 أداة أو أمر (Ctrl+K)...',
  systemHealth: 'ملخص حالة النظام',
  elevationRequiredTitle: 'مطلوب ترقية الصلاحيات إلى مسؤول (UAC)',
  elevationReason: 'سبب طلب صلاحية المسؤول',
  confirmElevation: 'تأكيد الترقية',
  cancelElevation: 'إلغاء'
};
