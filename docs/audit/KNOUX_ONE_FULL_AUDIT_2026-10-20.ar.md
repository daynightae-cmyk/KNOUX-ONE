# KNOUX ONE — أوديت شامل وخطة تميّز

- **التاريخ:** 20 أكتوبر 2026
- **المستودع:** `daynightae-cmyk/KNOUX-ONE`
- **الفرع المفحوص:** `feat/production-closure-20261018` @ `66461fb`، ومقارنته بـ `main` @ `f76b801`
- **النطاق:** الكود، البناء، الاختبارات، الكتالوج والخدمات، الأصول، CI، الفروع، إعدادات GitHub، وتجربة الاستخدام.
- **مرجع التنفيذ المرحلي:** [`KNOUX_ONE_DEVELOPER_PROMPT_2026-10-20.ar.md`](./KNOUX_ONE_DEVELOPER_PROMPT_2026-10-20.ar.md)

---

## 1) الحكم التنفيذي

المشروع ليس نموذجًا أوليًا. هو تطبيق Tauri 2 حقيقي فيه 19 وحدة و190 خدمة، و115 خدمة مطبقة، و135 اختبارًا ناجحًا، وسلسلة أدلة runtime موثقة على جهاز Windows فعلي. هذه قاعدة قوية ونادرة.

لكنه **ليس جاهزًا للإصدار العام** اليوم، لخمسة أسباب حاسمة:

1. **CI على `main` أحمر**: وظيفة `Dependency integrity and secret scan` تفشل بسبب ثغرة `source-map-js` عالية الخطورة في سلسلة أدوات البناء.
2. **أهم عمل هندسي غير مدموج**: محركا M16 (المشاريع) وM17 (التشخيص) موجودان في فرع محلي غير مدفوع، ومعهما 8 ملفات معدّلة غير ملتزمة، و`cargo fmt --check` يفشل.
3. **التوثيق العام يكذب على المنتج**: README يقول 101 خدمة و72 static و28.71%، بينما Baseline الفعلي يقول 115 خدمة و86 static و25.22%، ويقول إن M09–M14 وM16–M19 «planned» رغم وجود تنفيذ فعلي لبعضها.
4. **سطح الأمان مفتوح**: `csp: null` في Tauri، والشعار والـ favicon والخطوط تُحمَّل من الإنترنت، وأيقونات التطبيق ملفات placeholder.
5. **الحزمة الأمامية كتلة واحدة**: 1,074.77 kB JavaScript (258.48 kB gzip) بلا code splitting، مع ~6.4 MB أصول هوية غير محسّنة.

نقاط القوة التي يجب البناء عليها:

- فلسفة «الدليل قبل الادعاء» موجودة فعلًا في الكود: `Runtime_VERIFIED` لا يُمنح إلا بأربع مراحل موثقة، والبوابة معلنة `BLOCKED`.
- سلسلة الأوامر سليمة حاليًا: 115 خدمة implemented → 114 أمرًا فريدًا → كلها موجودة في `NATIVE_COMMANDS` ومسجلة في `generate_handler!` في Rust.
- RTL والثيم موجودان، والـ command palette فيها focus trap، والـ inspector وoperation drawer أفكار UX جيدة.
- المثبت 8.65 MB والتطبيق 25.9 MB حسب أدلة runtime، وهذا خفيف جدًا مقارنة بنطاق الوظائف.

الفرصة الأكبر ليست إضافة خدمات جديدة. الفرصة هي تحويل «الأدلة» من JSON داخلي إلى **تجربة منتج مرئية** (سجل أدلة، معاينة أثر، خريطة نضج، وضع offline مثبت)، وتنظيف الأساس الهندسي قبل التوسع.

---

## 2) المنهجية والحدود

ما تم فحصه:

- شجرة المستودع، الفروع المحلية والبعيدة، حالة Git، وآخر 5 commits.
- GitHub عبر API: الفروع، الـ workflows، الـ runs، الحماية، dependabot، secret scanning، tags، license.
- تشغيل `typecheck` و`test` و`build` و`services:check` و`cargo fmt --check` و`cargo check`.
- تشغيل `bun audit` محليًا لتحديد الثغرة بدقة.
- قراءة الكتالوج، سجل الأوامر، `main.rs`، ومولّد baseline، ومقارنة السلسلة برمجيًا.
- قراءة الملفات المحورية للواجهة: الراوتر، السايدبار، الهيدر، الداشبورد، مساحة الخدمات، مركز الخصوصية، الهوية، CSS.

ما لم يتم التحقق منه:

- **بناء Rust محليًا**: فشل بسبب غياب MSVC linker (`link.exe not found`). لم يُبنَ المثبت على هذا الجهاز.
- **تشغيل الواجهة ولقطات بصرية حية**: التحليل البصري من الكود وCSS، لا من screenshot للنسخة الحالية.
- **إعادة إنتاج أدلة runtime**: الـ 29 خدمة موثقة في المستودع من جهاز آخر؛ لم تُعدَّ التجربة هنا.
- **مراجعة سطر بسطر لكل فرع من 19 فرعًا**: تمت مراجعة الفروع ذات الـ commits الفريدة على مستوى السجل والملفات المتغيرة.
- **اختبار اختراق أو مراجعة أمنية خارجية**.

كل الأرقام أدناه من مخرجات فعلية، ومصادرها في الملحق.

---

## 3) حالة المستودع والفروع وGitHub

### 3.1 الحالة المحلية

| العنصر | الحالة |
|---|---|
| المستودع الفعلي | `K:\Knoux Projects\KNOuX ONE\Base` |
| الفرع الحالي | `feat/production-closure-20261018` |
| HEAD | `66461fb` — `feat(m16,m17): integrate the code/project and logs/diagnostics engines honestly` |
| العلاقة بـ main | متقدم 1 commit، غير مدفوع، غير مدموج |
| التغييرات غير الملتزمة | 8 ملفات معدّلة: مولّد baseline، 6 ملفات Rust (2 diagnostics + 4 projects)، و`BrandGalleryView.tsx` |
| `main` | `f76b801` — squash merge لـ PR #23 |
| tags | لا يوجد أي tag |
| license | لا يوجد ملف ترخيص؛ GitHub `licenseInfo = null` |

### 3.2 الفروع البعيدة

19 فرعًا بعيدًا غير `main`. أحد عشر منها **مدموجة بالكامل** (0 commits فريدة) ويمكن حذفها:

`feat/premium-workspace-rebuild`، `feat/m03-real-duplicate-engine`، `feat/m15-developer-studio`، `feat/m02-real-cleanup-engine`، `feat/m04-real-storage-analyzer`، `feat/complete-14-partial-services`، `feat/m05-startup-services-complete`، `feat/m06-performance-center-complete`، `feat/m07-windows-repair-complete`، `feat/m08-network-internet-complete`، `feat/knoux-one-unified-workspace-shell-20260925`.

ثمانية فروع تحمل commits فريدة:

| الفرع | Ahead | Behind | القرار المقترح |
|---|---:|---:|---|
| `feat/m17-logs-diagnostics-center` | 23 | 243 | لا يُدمج كما هو؛ محتواه موجود في الفرع المحلي الحالي. أرشفة بعد التحقق. |
| `bundle/gemini-m03-m15-m16` | 7 | 243 | تفكيك إن كان فيه إصلاحات فريدة، ثم حذف. |
| `feat/m05-real-startup-services` | 7 | 167 | تقييم إصلاحات M05، ثم حذف. |
| `fix/official-logo-unification` | 6 | 335 | تعديلات هوية وقص فقط؛ **لا يحل مشكلة الأصول الخارجية** (ما زال يستخدم postimg). لا يُدمج كما هو. |
| `chore/consolidate-local-knoux-one-20260926` | 3 | 8 | مراجعة سريعة ثم حذف. |
| `fix/services-check-eol-normalization` | 1 | 7 | إصلاح EOL صغير؛ تقييم ثم دمج أو حذف. |
| `docs/restore-guide-and-implementation-log` | 1 | 6 | وثائق فقط؛ تقييم. |
| `fix/readme-runtime-honesty-and-deploy-provenance` | 1 | 1 | محتواه وصل عبر squash إلى main؛ حذف. |

### 3.3 إعدادات GitHub

| الإعداد | القيمة | التقييم |
|---|---|---|
| default branch | `main` | سليم |
| حماية main | غير محمي | خطر: force-push وحذف ودمج مباشر ممكن |
| delete branch on merge | معطّل | سبب تراكم الفروع |
| Dependabot | معطّل | سبب تأخر تحديثات الأمان |
| Secret scanning | مفعّل | جيد |
| allow merge/squash/rebase | الثلاثة مفعّلة | يفضل squash فقط لاتساق السجل |
| workflows مسجلة | 21 | 4 فقط موجودة على main؛ الباقي workflows مؤقتة عالقة |
| workflows على main | `ci.yml`، `m03-native-validation.yml`، `release.yml`، `validate-ui.yml` | سليم |
| tags | 0 | لا إصدارات مؤرشفة |
| license | لا يوجد | المستودع public بلا ترخيص = غموض قانوني |

---

## 4) البوابات الهندسية

| البوابة | الأمر | النتيجة | ملاحظة |
|---|---|---|---|
| TypeScript | `bun run typecheck` | PASS | لا أخطاء |
| الاختبارات | `bun run test` | PASS | 22 ملفًا، 135 اختبارًا، 8.02 ثانية |
| الكتالوج | `bun run services:check` | PASS | لكنه لا يفحص نثر README ولا سلسلة Rust |
| البناء | `bun run build` | PASS مع تحذير | 30.23 ثانية، chunk واحد 1,074.77 kB |
| Rust format | `cargo fmt --check` | FAIL | ملفات M16/M17 الجديدة غير منسقة |
| Rust check | `cargo check --all-targets --all-features` | FAIL (بيئة) | `linker link.exe not found` |
| Bun audit | `bun audit` | FAIL | 1 high: `source-map-js@1.2.1` |
| CI على main | run `39104075466` | FAIL | job التبعيات والأسرار فقط |

### 4.1 تفصيل فشل CI

```
source-map-js@1.2.1
  @tailwindcss/vite > @tailwindcss/node > source-map-js
  autoprefixer > postcss > source-map-js
  vite > postcss > source-map-js
high: GHSA-68fv-2mgg-jv7q (event-loop DoS through indexed source-map section offsets)
1 vulnerability (1 high)
```

الثغرة في سلسلة أدوات البناء فقط، وليست في كود التطبيق الذي يُشحن. لكن البوابة صحيحة في منعها، والإصلاح بسيط: تثبيت `source-map-js` على `1.2.2` عبر `overrides`. لا يجوز تعطيل الفحص.

---

## 5) العيوب والأخطاء

### 5.1 عيوب P0 — تمنع الإصدار

#### P0-1: CI أحمر على main بسبب `source-map-js`

- **الدليل:** `bun audit` أعلاه؛ GitHub run `39104075466`؛ job `Dependency integrity and secret scan` = failure بينما Windows وWeb = success.
- **الأثر:** كل PR جديد يبدأ من بوابة حمراء؛ لا يمكن الاعتماد على CI كإشارة إصدار؛ Dependabot معطّل فلا يوجد إصلاح تلقائي.
- **الإصلاح:** إضافة `"source-map-js": "1.2.2"` إلى `overrides` في `package.json`، تحديث lockfile، ثم `bun audit` يجب أن يعطي 0. لا تُعطَّل الخطوة.
- **المرحلة:** 1.

#### P0-2: M16/M17 غير مدموجين، وشجرة العمل متسخة، وRust غير منسق

- **الدليل:** `git status` يظهر 8 ملفات معدّلة؛ `cargo fmt --check` يفشل في `src-tauri/src/projects/mod.rs` وملفات diagnostics/projects؛ commit `66461fb` غير مدفوع.
- **الأثر:** الادعاء بـ 115 خدمة موجود فقط على فرع محلي. أي إصدار من `main` لا يحتوي محركي المشاريع والتشخيص. كما أن CI سيفشل على الفرع بسبب fmt.
- **الإصلاح:** فصل التغييرات إلى commits منطقية، تشغيل `cargo fmt --all`، دفع الفرع، فتح PR، إصلاح CI، ثم الدمج بعد المرحلة 2.
- **المرحلة:** 0 و3.

#### P0-3: README يناقض Baseline ويناقض نفسه

- **الدليل:** `README.md:19` يقول 86 static، و`README.md:27` يقول «101 implemented — 29 runtime + 72 static» و«28.71%»، و`README.md:29` يقول «M09–M14 and M16–M19 remain planned». بينما `docs/services/service-reality-baseline.json` يقول 115 implemented (86 static + 29 runtime) و75 planned، وM09/M10/M11/M16/M17 فيها تنفيذ فعلي.
- **الأثر:** أخطر عيب على المصداقية. المشروع يبني سمعته على الصدق، ثم ينشر أرقامًا خاطئة في واجهة المستودع. `services:check` يمر لأن README ليس جزءًا من المولّد.
- **الإصلاح:** إزالة الأرقام الثابتة من النثر، أو توليد كتلة README من baseline، وإضافة فحص يمنع الأرقام القديمة. تحديث جملة «planned» لتطابق الحالة الفعلية.
- **المرحلة:** 2.

#### P0-4: `csp: null` وأصول هوية خارجية

- **الدليل:** `src-tauri/tauri.conf.json:25` فيه `"csp": null`؛ `index.html:9` يحمّل favicon من postimg؛ `index.html:11-14` يحمّل أربع عائلات خطوط من Google Fonts؛ `src/data/officialBrand.ts:6-7` يحمّل الشعار من postimg.
- **الأثر:** سطح XSS أوسع في WebView، وفشل الهوية البصرية عند انقطاع الإنترنت أو حجب postimg، واعتماد شبكي غير ضروري لتطبيق يدّعي الخصوصية.
- **الإصلاح:** نقل الشعار والـ favicon والخطوط إلى `public/`، توليد أيقونات Tauri، ثم فرض CSP إنتاجي يسمح فقط بـ `self` و`ipc:` و`asset:`. إبقاء `devCsp` للتطوير.
- **المرحلة:** 1.

#### P0-5: أيقونات التطبيق وملفات الهوية placeholder

- **الدليل:** `src-tauri/icons/128x128.png` = 77 bytes، `32x32.png` = 77 bytes، `icon.icns` = 86 bytes، `icon.ico` = 2,086 bytes. `public/brand/logos/*.jpg` = 286 bytes (ملفات تالفة). `public/brand/manifest.json` يسجل jpg بحجم 134 bytes ونفس sha للملفين، بينما الموجود الفعلي PNG بحجم 1.6 MB و1.5 MB.
- **الأثر:** مثبت Windows بأيقونة placeholder؛ معرض الهوية يعرض صورًا مكسورة؛ manifest لا يطابق الواقع.
- **الإصلاح:** إنشاء SVG master للشعار، توليد `tauri icon` من PNG 1024، إعادة توليد manifest بالحجم والبصمة الفعليين، وحذف ملفات 286B.
- **المرحلة:** 1 و6.

#### P0-6: بوابة runtime معلّقة عند 29/115 ولا توجد إصدارات

- **الدليل:** `globalRuntimeGate.state = BLOCKED`، `verified = 29`، `eligible = 115` (25.22%). لا tags في المستودع. أعلى تغطية runtime: M04 (8/10)، M02 (6/10)، M01 (5/10). صفر runtime في M03 وM05 وM06 وM07 وM08 وM16 وM17 وM18 وM19.
- **الأثر:** لا يمكن وصف المنتج بأنه production-ready. هذا ليس عيبًا في الصدق، بل في الجاهزية. كما أن أخطر الوحدات (تكرار الملفات، بدء التشغيل، الإصلاح) غير مثبتة runtime.
- **الإصلاح:** إما إصدار pre-release رسمي (0.x/beta) بوسم واضح، أو إكمال runtime evidence للوحدات عالية الخطورة أولًا. لا تُرفع البوابة يدويًا.
- **المرحلة:** 10.

### 5.2 عيوب P1 — خطر أو أثر مباشر على التجربة

#### P1-1: الحزمة الأمامية كتلة واحدة بلا تقسيم

- **الدليل:** `dist/assets/index-BQD0SoN1.js` = 1,074.77 kB (gzip 258.48 kB)؛ تحذير Vite >500 kB؛ `src/App.tsx:12-35` يستورد كل الواجهات استيرادًا ثابتًا.
- **الأثر:** زمن إقلاع أطول، تحميل كود M12–M19 حتى لو لم يفتحها المستخدم، وصعوبة تحسين الأداء لاحقًا.
- **الإصلاح:** `React.lazy` لكل route، `manualChunks` للمكتبات، وSuspense skeleton. هدف مبدئي: ≤250 kB gzip للحمولة الأولى.
- **المرحلة:** 4.

#### P1-2: خلل معلومات التنقل: «Operations & history» يفتح m19

- **الدليل:** `src/shell/workspaceRegistry.ts:49` يعرّف `id: 'operations'، route: 'support'` بعنوان «Operations & history». لكن `src/App.tsx` يحوّل `support` إلى `SupportPortalView`، وهو نسخة حرفية من `CloudSupportView` (كلاهما يبحث عن `m19` ويرندر `UniversalServiceWorkspace`). لا توجد شاشة operations history أصلًا.
- **الأثر:** المستخدم يضغط على «سجل العمليات» فيرى «KNOUX Cloud & Support». سجل العمليات الحقيقي مدفون في drawer سفلي فقط.
- **الإصلاح:** إنشاء `OperationsHistoryView` يقرأ `actionLogs` والأدلة ومسودات الدعم، توجيه `support` إليه، وإبقاء `cloud` لـ m19.
- **المرحلة:** 5.

#### P1-3: مسارات غير قابلة للوصول من الواجهة

- **الدليل:** `SHELL_WORKSPACES` يحتوي dashboard/operations/settings/about فقط. المسارات `catalog` و`brand-gallery` و`web-landing` موجودة في `App.tsx` لكنها ليست في السايدبار ولا في قائمة الـ command palette (التي تعرض 3 shell + 5 modules فقط).
- **الأثر:** ميزات كاملة (دليل 190 خدمة، معرض الهوية، صفحة الويب) لا يمكن الوصول إليها إلا بتعديل الكود.
- **الإصلاح:** إضافة مدخلات صريحة، أو نقلها إلى مجموعات «المزيد»/«النظام»، وضمان أن كل route له مدخل واحد واضح.
- **المرحلة:** 5.

#### P1-4: اللغة والثيم لا يُحفظان، والبداية بالإنجليزية، والـ onboarding مخفي

- **الدليل:** `src/context/KnouxContext.tsx:120-121` القيم الافتراضية `dark` و`en`؛ لا يوجد `localStorage` للثيم أو اللغة (فقط السايدبار في `Sidebar.tsx:15-22`)؛ `isFirstRunWizardCompleted` يبدأ `true` في السطر 141؛ route `first-run` ليس في السايدبار.
- **الأثر:** مستخدم عربي يفتح التطبيق كل مرة بالإنجليزية والثيم الداكن؛ شاشة «البداية» لا تظهر أبدًا.
- **الإصلاح:** حفظ `theme/language`، افتراضي `ar` أو «حسب النظام»، وإظهار first-run عند أول تشغيل مع خيار تخطي، وربطه بمدخل واضح.
- **المرحلة:** 5.

#### P1-5: رقم الإصدار غير موحّد

- **الدليل:** `Header.tsx:78` يعرض `v3.0`؛ `package.json` و`tauri.conf.json` وruntime evidence كلها `1.0.0`.
- **الأثر:** المستخدم يرى 3.0 والمثبت 1.0.0؛ أي دعم أو تحديث يصبح مربكًا.
- **الإصلاح:** مصدر واحد للحقيقة (package.json → Vite define → Header)، ورقم واحد في Tauri والـ updater.
- **المرحلة:** 2.

#### P1-6: i18n مزدوج ونصف موصول

- **الدليل:** `src/i18n/ar.ts` و`en.ts` و`useTranslation` موجودة، لكنها مستخدمة فقط في `features/duplicates` و`features/developer`؛ باقي الواجهة تستخدم `t(en, ar)` inline من `KnouxContext.tsx:154`. لا يوجد `import` لـ i18n في shell/dashboard/services.
- **الأثر:** قاموسان للحقيقة، انحراف ترجمات، صعوبة إضافة لغة ثالثة، ونصوص عربية مبعثرة داخل JSX.
- **الإصلاح:** توحيد النصوص في dictionaries، أو الاعتراف رسميًا بأن `t(en, ar)` هو النظام والاكتفاء به وإزالة الملفات الميتة. لا تُبقِ الاثنين.
- **المرحلة:** 5 (أو 10).
- **ملاحظة:** العربية في الملفات سليمة. ما ظهر كـ `؟؟؟` في مخرجات الطرفية كان تشويه ترميز عرض، وليس تلفًا في الملفات.

#### P1-7: فجوة في حارس «static verified»

- **الدليل:** `scripts/generate-service-reality.ts:164` يمنح `STATIC_VERIFIED` لأي خدمة `implemented` ولها `handlerId`، دون التحقق من وجود `handlerId` في `NATIVE_COMMANDS` أو من تسجيل الأمر في `main.rs`. التحقق الحالي يحدث فقط لسجلات runtime (الأسطر 87-98).
- **الأثر:** اليوم السلسلة سليمة (115/115 → 114 أمرًا → كلها مسجلة)، لكن أي خطأ مستقبلي في الربط سيمر من `services:check` بصمت.
- **الإصلاح:** إضافة تأكيدات: handler موجود في registry، command موجود في `generate_handler!`، ولا تكرار غير مسموح. وفشل المولّد عند أي كسر.
- **المرحلة:** 2.

#### P1-8: سلسلة الأوامر سليمة لكن فيها ازدواج مقصود

- **الدليل:** 115 خدمة implemented، 114 handler فريدًا. `m15.ports.manage` مستخدم لخدمتين (M15-S08 عرض المنافذ، وM15-S09 إنهاء العملية). كلاهما映射 إلى نفس الأمر.
- **الأثر:** ليس خطأً بالضرورة، لكن أي واجهة تفترض 1:1 بين الخدمة والأمر ستنكسر. كما أن عدّ «115 خدمة» قد يوحي بتغطية أكبر من عدد الأوامر الفعلية.
- **الإصلاح:** توثيق الازدواج في الكتالوج، أو فصل handler للإنهاء إن كان له عقد مختلف. لا تغيّر الرقم بلا داعٍ.
- **المرحلة:** 2.

#### P1-9: غياب أدوات الجودة الحقيقية

- **الدليل:** `lint` = `tsc --noEmit` فقط؛ لا ESLint/Biome/Prettier؛ 52 استخدامًا لـ `any`؛ 7 `console.*`؛ 4 TODO/FIXME؛ 31 سمة `aria-*` فقط في ~19,171 سطر TS/TSX؛ لا اختبارات UI أو E2E أو a11y أو visual regression.
- **الأثر:** مشكلات الوصول والأخطاء المنطقية تُكتشف متأخرًا؛ لا حماية من الانحدار البصري.
- **الإصلاح:** Biome أو ESLint+Prettier، قاعدة `no-explicit-any` تدريجية، Playwright smoke للويب، وaxe للوصول.
- **المرحلة:** 10.

#### P1-10: نظافة المستودع

- **الدليل:** 21 workflow مسجل مقابل 4 على main؛ 11 فرعًا مدموجًا غير محذوف؛ main غير محمي؛ Dependabot معطّل؛ لا tags؛ لا license.
- **الأثر:** ضوضاء، مخاطر أمان، غموض قانوني، وصعوبة معرفة «ما الذي يُشحن فعلًا».
- **الإصلاح:** حذف الفروع المدموجة وworkflows المؤقتة، تفعيل الحماية وDependabot، إضافة LICENSE بعد قرار المالك، واعتماد إصدارات موسومة.
- **المرحلة:** 0 و10.

#### P1-11: أداء الأصول والخطوط

- **الدليل:** شعارا PNG بحجم 1,623,362 و1,503,864 bytes؛ معرض 18 صورة منها 5 ملفات 286B (ref-02..05، ref-19) والباقي ~3.31 MB؛ أربع عائلات خطوط من Google Fonts بأوزان متعددة؛ لا `loading="lazy"` منهجي للصور.
- **الأثر:** ~6.4 MB أصول هوية، واعتماد شبكي، وCLS محتمل من الخطوط.
- **الإصلاح:** WebP/AVIF بأحجام متعددة، `srcset`، lazy loading، خطوط WOFF2 محلية مُجزأة، وإزالة العائلات غير المستخدمة.
- **المرحلة:** 1 و4.

### 5.3 عيوب P2 — تحسينات وجودة

- **P2-1:** `src/index.css:233` يحتوي `shrink: 0;` وهي خاصية غير صالحة في CSS القياسي (الصحيح `flex-shrink: 0`).
- **P2-2:** `motion` في dependencies لكن لا يوجد أي `import` له؛ حزمة غير مستخدمة.
- **P2-3:** `DashboardHero.tsx` و`StatusCardsGrid.tsx` مكوّنان ميتان (لا imports).
- **P2-4:** `@vitejs/plugin-react` و`@tailwindcss/vite` في `dependencies` بدل `devDependencies`؛ `@types/node` 22 مع Node 24؛ `autoprefixer` قد لا يكون ضروريًا مع Tailwind 4 عبر Vite.
- **P2-5:** نظاما CSS (`index.css` و`workspace.css`) بلا طبقات واضحة؛ كثرة Tailwind arbitrary values داخل JSX.
- **P2-6:** أحجام نصوص 9–11px مع ألوان muted في أماكن كثيرة؛ خطر WCAG AA.
- **P2-7:** `index.html` يحمل `lang="en"` ثابتًا حتى يتغير من React؛ وميض لغة محتمل.
- **P2-8:** معرض الهوية يعرض 5 صور مكسورة، و`BrandGalleryView.tsx` معدّل محليًا بلا commit.
- **P2-9:** `WebLandingView` داخل تطبيق سطح المكتب قد لا يخدم المستخدم؛ يحتاج قرارًا (نافذة خارجية/إزالة/داخل About).
- **P2-10:** ملفات `REAL_IMPLEMENTATION_MATRIX.md` و`PARTIAL_SERVICES_CLOSURE.md` و`PLANNED_SERVICES_BUILD_MAP.md` في الجذر تكرر المعلومات وتزيد فرص الانحراف.

---

## 6) الخدمات: الحقيقة الكاملة

### 6.1 معاني الحالات

| الحالة | المعنى | العدد |
|---|---|---:|
| `RUNTIME_VERIFIED` | نُقر زر React، عبر IPC، نفّذ أمر Rust على Windows، وظهرت النتيجة في DOM، مع سجل موثق. | 29 |
| `STATIC_VERIFIED` | implemented + handlerId + أمر مسجل، لكن لم يُشغّل على Windows. | 86 |
| `PARTIAL` | مسار native بحدود موثقة. | 0 |
| `PLANNED` | بلا handler. | 75 |
| الإجمالي |  | 190 |

**115 implemented = 86 static + 29 runtime.** نسبة runtime الحقيقية = **25.22%** من implemented، و15.26% من إجمالي 190.

### 6.2 التوزيع لكل وحدة

| الوحدة | الإجمالي | Runtime | Static | Planned |
|---|---:|---:|---:|---:|
| M01 Windows Setup | 10 | 5 | 2 | 3 |
| M02 Cleanup | 10 | 6 | 4 | 0 |
| M03 Duplicates | 10 | 0 | 10 | 0 |
| M04 Storage | 10 | 8 | 2 | 0 |
| M05 Startup | 10 | 0 | 10 | 0 |
| M06 Performance | 10 | 0 | 10 | 0 |
| M07 Repair | 10 | 0 | 10 | 0 |
| M08 Network | 10 | 0 | 10 | 0 |
| M09 Privacy | 10 | 3 | 4 | 3 |
| M10 Security | 10 | 2 | 3 | 5 |
| M11 Backup | 10 | 3 | 2 | 5 |
| M12 Applications | 10 | 0 | 0 | 10 |
| M13 File Tools | 10 | 0 | 0 | 10 |
| M14 Automation | 10 | 0 | 0 | 10 |
| M15 Developer | 10 | 2 | 5 | 3 |
| M16 Projects | 10 | 0 | 4 | 6 |
| M17 Diagnostics | 10 | 0 | 10 | 0 |
| M18 Hardware | 10 | 0 | 0 | 10 |
| M19 Cloud/Support | 10 | 0 | 0 | 10 |
| **الإجمالي** | **190** | **29** | **86** | **75** |

### 6.3 التحقق من سلسلة الأوامر

تمت المقارنة برمجيًا بين الكتالوج و`nativeCommandRegistry.ts` و`main.rs`:

| الفحص | النتيجة |
|---|---|
| خدمات implemented | 115 |
| لها `handlerId` | 115 |
| handler فريد | 114 (ازدواج `m15.ports.manage`) |
| handler موجود في `NATIVE_COMMANDS` | 115/115 |
| أمر native فريد | 114 |
| أمر مسجل في `generate_handler!` | 114/114 |
| خدمات بسلسلة مكسورة | 0 |
| أوامر Rust المسجلة إجمالًا | 165 |

هذه نتيجة قوية: لا توجد خدمة «مزعومة» بلا أمر فعلي في الكود الحالي. لكن 51 أمرًا مسجلًا لا يقابله خدمة implemented في الكتالوج (بعضها أوامر مساعدة أو لخدمات planned). هذا ليس خطأً، لكنه يستحق توثيقًا حتى لا يُفسَّر كتغطية إضافية.

### 6.4 أدلة runtime

- الجهاز: `DESKTOP-FCJJB5O`، Windows 10 Pro 19045، WebView2 153.
- التطبيق: 25,899,008 bytes؛ المثبت NSIS: 8,652,718 bytes.
- 29 خدمة موزعة على M01 (5)، M02 (6)، M04 (8)، M09 (3)، M10 (2)، M11 (3)، M15 (2).
- صفر runtime في: M03، M05، M06، M07، M08، M16، M17، M18، M19.

**أخطر فجوة:** الوحدات التي تغيّر حالة النظام فعليًا (تكرار الملفات، بدء التشغيل، الإصلاح) كلها static فقط. هذا يجب أن يكون أولوية التحقق التالية، لا زيادة عدد الخدمات.

### 6.5 ملاحظة تنفيذية

`implemented` في الكتالوج لا يعني أن الزر سيعمل في كل بيئة. التنفيذ الفعلي يمر عبر `NativeClient` وallowlist وTauri IPC. في معاينة المتصفح لا تُنفَّذ الخدمات، ويجب أن تظل الواجهة صادقة في عرض ذلك. الكود الحالي يفعل هذا جزئيًا عبر `NativeClient.isTauriAvailable()`، لكن يجب أن يكون السلوك موحدًا في كل شاشة.

---

## 7) الأداء والسرعة والخفة

### 7.1 أرقام البناء الحالية

| المقياس | القيمة |
|---|---:|
| JavaScript | 1,074.77 kB (gzip 258.48 kB) |
| CSS | 127.08 kB (gzip 20.49 kB) |
| HTML | 1.20 kB |
| زمن البناء | 30.23 ثانية |
| عدد chunks | 1 |
| أصول الهوية في `public/brand` | ~6.43 MB |
| الشعاران | 3.13 MB |
| المعرض | 3.31 MB |
| خطوط | 4 عائلات من Google Fonts |
| التطبيق (evidence) | 25.9 MB |
| المثبت (evidence) | 8.65 MB |

### 7.2 الأسباب

1. استيراد كل الواجهات في `App.tsx` يمنع التقسيم.
2. صور الشعار تُعرض بحجم 40px لكنها ملفات 1.5–1.6 MB.
3. معرض كامل يُحمَّل مع التطبيق رغم أنه شاشة ثانوية.
4. خطوط خارجية بأوزان كثيرة تزيد طلبات الشبكة وCLS.
5. لا `manualChunks` ولا تحميل مؤجل للمكوّنات الثقيلة مثل `CapabilitiesCatalogView` (23.7 kB) و`UniversalServiceWorkspace` (35 kB).

### 7.3 أهداف مقترحة

| الهدف | القيمة |
|---|---|
| الحمولة الأولى JS | ≤ 250 kB gzip |
| إجمالي JS بعد التقسيم | ≤ 900 kB gzip |
| أصول الهوية | ≤ 1.5 MB |
| الخطوط المحلية | ≤ 300 kB |
| زمن البناء | ≤ 20 ثانية |
| CLS | < 0.1 |
| عدد chunks | ≥ 6 (route-based) |

هذه أهداف هندسية قابلة للقياس، لا وعود تسويقية.

---

## 8) البصريات وتجربة الاستخدام

### 8.1 التشخيص الحالي

- **الهوية:** بنفسجي `#8b5cf6` على خلفية شبه سوداء، مع توهجات ambient orbs وزجاج شفاف. النتيجة أنيقة لكنها قريبة من «قالب داشبورد AI» الشائع، وليست هوية أداة نظام احترافية.
- **الخطوط:** Cairo + Inter + JetBrains Mono + Tajawal، أربع عائلات، بعضها غير مستخدم فعليًا.
- **الشعار:** صورة نقطية 1.6 MB تُعرض في دائرة 40px، وتُحمَّل من الإنترنت، مع CSS إصلاحات قص متفرقة.
- **Splash:** غير موجود. نافذة Tauri تظهر فارغة حتى يجهز React.
- **الداشبورد:** شبكة بطاقات عامة؛ لا توجد قصة واضحة («ماذا يحدث الآن؟ ماذا أفعل؟»).
- **شاشة الخدمات:** `UniversalServiceWorkspace` جيدة وظيفيًا (Overview/Services/Activity/Help) لكنها تعرض 190 خدمة بنفس النمط، بلا تمييز بصري حقيقي بين «جاهز»، «محدود»، «خطة».
- **الخصوصية:** `PrivacyStatusPanels` + مساحة الخدمات؛ لا توجد شاشة «مركز خصوصية» مستقلة بمصفوفة صلاحيات وقرارات.
- **الإيجابيات:** متغيرات CSS دلالية، وضع فاتح/داكن، RTL صحيح عبر `documentElement`، command palette بـ focus trap، inspector، operation drawer، chips حالة صادقة، وempty states.

### 8.2 الفجوات البصرية

1. لا تسلسل هرمي: كل شيء بنفس الوزن البصري (كل بطاقة لها حدود وتوهج).
2. الزجاج يُستخدم على الأسطح النصية فيقلل التباين.
3. أحجام 9–11px كثيرة، خصوصًا labels وchips.
4. حركة غير موحدة؛ لا نظام motion durations.
5. لا حالات skeleton/error موحدة على مستوى الودجات.
6. لا هوية حركية للشعار أو splash.
7. لا توجد «لحظة ثقة»: المستخدم لا يرى دليل العملية بعد تنفيذها إلا في drawer صغير.

---

## 9) اقتراحات التميّز (ما يجعل KNOUX ONE مختلفًا فعلًا)

هذه ليست قائمة ميزات عامة. كل اقتراح مرتبط بما هو موجود في الكود، ويحوّل ضعفًا حاليًا إلى تمايز.

### 9.1 سجل الأدلة (Proof Ledger)

حوّل `actionLogs` و`OperationResult` وسجلات `docs/evidence` إلى شاشة «سجل أدلة» محلية: لكل عملية بطاقة تحتوي ماذا نُفِّذ، قبل/بعد، الأمر native، الوقت، النتيجة، وإمكانية النسخ/التصدير. أضف توقيعًا محليًا (hash) للسجل. هذا يحوّل شعار «honesty» إلى تجربة مرئية لا يستطيع منافس تقليده بسهولة.

### 9.2 معاينة الأثر (Impact Preview)

قبل أي عملية، اعرض «ماذا سيحدث»: البايتات المتوقعة، عدد الملفات، أثر بدء التشغيل، المخاطر، وخطة التراجع. استخدم بيانات `reads/writes/reversible` الموجودة في الكتالوج. لا تعرض أرقامًا مخترعة؛ اعرض «غير متاح» عند غياب القياس.

### 9.3 آلة زمن لحالة Windows

لقطات دورية محلية لحالة startup/services/drivers/privacy، مع diff بصري: «ما الذي تغيّر منذ الأسبوع الماضي؟». تعتمد على M05/M06/M17 الموجودة. هذه ميزة إدارة نظام حقيقية، لا مجرد تنظيف.

### 9.4 Triage Wizard بدل 190 خدمة

المستخدم لا يريد 190 خدمة؛ يريد حل مشكلة. أضف مسار «ما المشكلة؟» (بطء، امتلاء القرص، إقلاع بطيء، خصوصية، شبكة) يبني خطة من 3–5 خطوات مع أدلة وأثر متوقع. الكتالوج يبقى للمحترفين.

### 9.5 عربية أولًا بإتقان

ليس ترجمة، بل تصميم عربي: RTL أصلي، أرقام LTR داخل النص العربي، خطوط عربية تقنية (Alexandria/IBM Plex Sans Arabic)، مصطلحات متسقة، وخرائط/رسوم تُقرأ من اليمين. هذه ميزة سوقية قوية في منطقة لا تجد فيها أدوات نظام بهذا العمق بالعربية.

### 9.6 وضع «بدون اتصال» مُثبت

زر واضح يوقف كل اتصال شبكي للتطبيق (فحص التحديثات، أي رابط خارجي)، مع لوحة تعرض «آخر محاولة اتصال» و«كل الأصول محلية». ادمجه مع CSP والأصول المحلية. هذا تمايز حقيقي أمام أدوات تجمع telemetry.

### 9.7 خريطة نضج الخدمات

اعرض 190 خدمة كخريطة حرارية (module × state) مع أرقام runtime/static/planned. المستخدم والمطوّر يريان الحقيقة فورًا. هذه شفافية نادرة في منتجات النظام.

### 9.8 Command Deck

وسّع Ctrl+K من بحث إلى لوحة أوامر تنفيذية: «افحص الجهاز»، «نظّف Temp»، «اعرض سجل الأدلة»، «بدّل اللغة»، مع معاينة خطر قبل التنفيذ. الـ palette موجودة؛ ينقصها الأفعال.

### 9.9 حزمة أدلة قابلة للنقل

تصدير «Evidence Bundle» (JSON + Markdown + screenshots اختيارية) لمشكلة أو فحص، ليشاركها المستخدم مع الدعم أو المطوّر. M17 فيه `bundle.export`؛ اجعله منتجًا مرئيًا.

### 9.10 هوية «Instrument» لا «Dashboard»

استبدل الزجاج/التوهج بأسطح صلبة، خطوط رفيعة، لون واحد أساسي + لون بيانات، وحركة هادفة. الشعار يدور حول «مدار» (orbit) يمكن استخدامه كعنصر تخطيط: مسار أدلة عمودي، نقاط حالة، وحواف دائرية محسوبة. النتيجة: يبدو كأداة قياس احترافية، لا كقالب AI.

---

## 10) خارطة الطريق المقترحة

التفاصيل التنفيذية الكاملة في ملف البرومبت. كل مرحلة = PR واحد، تُدمج قبل بدء التالية.

| المرحلة | الهدف | الناتج |
|---|---|---|
| 0 | تثبيت خط الأساس وحوكمة الفروع | شجرة نظيفة، PR لـ M16/M17، حماية main، حذف الفروع الميتة |
| 1 | سلسلة التوريد والأصول وCSP | `bun audit` = 0، أصول محلية، أيقونات صحيحة، CSP إنتاجي |
| 2 | مصدر حقيقة واحد | README صادق، نسخة موحدة، حارس سلسلة الأوامر |
| 3 | دمج M16/M17 | 115 خدمة على main مع CI أخضر |
| 4 | الأداء والخفة | route splitting، صور/خطوط محسّنة، ميزانية حزمة |
| 5 | المعلومات والتنقل | Operations History، كل route قابل للوصول، تفضيلات محفوظة |
| 6 | نظام التصميم والهوية وSplash | tokens، خطوط، شعار SVG، BootGate |
| 7 | الداشبورد | Mission Control ببيانات حقيقية |
| 8 | Service Studio | تفاصيل عقد الخدمة، dry-run، إيصال |
| 9 | Privacy Center | مصفوفة صلاحيات، وضع offline، تقرير |
| 10 | الجودة والإصدار | lint/a11y/E2E، ميزانيات، tag، حزمة موقعة |

---

## 11) ملحق الأدلة

### 11.1 أوامر ونتائج

```
bun run typecheck        -> PASS (no output)
bun run test             -> 22 files / 135 tests / 8.02s
bun run services:check   -> exit 0
bun run build            -> built in 30.23s
                            dist/assets/index-BQD0SoN1.js  1,074.77 kB (gzip 258.48)
                            dist/assets/index-*.css          127.08 kB (gzip 20.49)
cargo fmt --check        -> FAIL (projects/diagnostics formatting)
cargo check --all-targets --all-features
                         -> FAIL: linker `link.exe` not found
bun audit                -> 1 high (source-map-js 1.2.1)
```

### 11.2 سلسلة الخدمات

```
services=190 implemented=115 implementedWithHandler=115
uniqueHandlers=114 duplicate=m15.ports.manage
registryEntries=143 handlersMissingFromRegistry=0
distinctMappedCommands=114 mappedCommandsNotRegisteredInRust=0
implementedServicesWithBrokenChain=0
rustRegisteredCommands=165
```

### 11.3 ملفات مرجعية

- `src/App.tsx` — الراوتر والاستيرادات الثابتة.
- `src/shell/workspaceRegistry.ts` — تعريف مساحات العمل وخلل `support`.
- `src/components/layout/Sidebar.tsx`، `Header.tsx` — التنقل والإصدار.
- `src/context/KnouxContext.tsx` — اللغة/الثيم/`t()`.
- `src/components/common/UniversalServiceWorkspace.tsx` — قلب شاشة الخدمات.
- `src/components/views/PrivacyTelemetryView.tsx` — الخصوصية الحالية.
- `src/data/officialBrand.ts`، `public/brand/manifest.json` — الهوية.
- `src-tauri/tauri.conf.json` — CSP والنافذة والأيقونات.
- `scripts/generate-service-reality.ts` — مولّد الحقيقة.
- `docs/services/service-reality-baseline.json` — الأرقام الرسمية.
- `.github/workflows/ci.yml` — البوابات.

### 11.4 حكم نهائي

**الأساس الهندسي يستحق البناء عليه. لكن لا تبدأ بالتصميم قبل إغلاق P0.**  
الترتيب الصحيح: صدق البيانات → CI أخضر → دمج M16/M17 → الأداء → التنقل → الهوية → الداشبورد → الخدمات → الخصوصية → الإصدار.

