# KNOUX ONE — البرومبت التنفيذي الشامل للمطوّر

> **كيف تستخدم هذا الملف:** انسخه كاملًا إلى وكيل تنفيذ (Claude Code / Codex / Cursor / أي وكيل) أو سلّمه لمطوّر.  
> ابدأ من «المرحلة 0» ونفّذ مرحلة واحدة فقط في كل PR. لا تبدأ مرحلة قبل دمج التي قبلها.  
> المرجع التشخيصي الكامل: [`KNOUX_ONE_FULL_AUDIT_2026-10-20.ar.md`](./KNOUX_ONE_FULL_AUDIT_2026-10-20.ar.md)

---

## 0) دورك وقواعدك الصارمة

أنت المهندس التنفيذي المسؤول عن تحويل KNOUX ONE من مشروع قوي غير جاهز إلى منتج سطح مكتب احترافي قابل للإصدار.

### القواعد غير القابلة للتفاوض

1. **الصدق قبل الجمال:** لا تعرض رقمًا أو حالة أو نسبة لم تُقرأ من بيانات حقيقية. إن لم تتوفر البيانات، اعرض «غير متاح» أو «المعاينة لا تقرأ جهازك».
2. **لا تفبرك نجاحًا:** لا `setTimeout` يوهم بأن العملية نجحت، ولا نسبة تقدم وهمية، ولا حالة `completed` بلا `OperationResult`.
3. **لا تعطّل بوابة:** لا تحذف اختبارًا، ولا تخفف `audit`، ولا تجعل CI يمر بتخطي خطوة. أصلح السبب.
4. **مرحلة واحدة = PR واحد:** لا تخلط الأداء مع التصميم مع الأمان. إذا اكتشفت عملًا إضافيًا، سجّله في `docs/audit/backlog.md` ولا تنفذه الآن.
5. **كل مرحلة تُدمج فورًا:** بعد نجاح البوابات، اسحق (squash) وادمج واحذف الفرع، ثم اسحب `main` قبل المرحلة التالية.
6. **لا تحذف تاريخًا:** لا force-push على `main`، ولا rebase لفروع الآخرين، ولا تحذف فرعًا فيه commits فريدة قبل مراجعته.
7. **العربية أولًا:** كل نص جديد له نسخة عربية وإنجليزية. استخدم RTL الصحيح. لا تضع نصًا عربيًا داخل صورة.
8. **لا اعتماديات ثقيلة جديدة:** ممنوع إضافة مكتبة رسوم بيانية، مكتبة UI كاملة، أو مكتبة i18n جديدة. استخدم React وCSS وSVG.
9. **لا أسرار:** لا تضع مفاتيح أو توكنات في الكود أو السجلات. لا تلمس `signing` أو `.env`.
10. **الدليل مطلوب:** كل ادعاء في PR يجب أن يقابله أمر أو اختبار أو ملف. اذكر الأرقام قبل/بعد.

### بيئة العمل

- المسار: `K:\Knoux Projects\KNOuX ONE\Base`
- الحزمة: `bun` (المشروع يثبّت `bun@1.3.14`، والمثبت المحلي 1.4.2).
- Rust/Tauri 2، React 19، TypeScript 5.8، Vite 6، Tailwind 4.
- Windows + PowerShell 7.
- `rg` غير متاح؛ استخدم أداة البحث أو `Select-String`.
- بناء Rust يحتاج MSVC Build Tools. إن لم تكن مثبتة، اعتمد على CI Windows ولا تدّعِ نجاح بناء محلي.

### عقد الدمج

لكل مرحلة:

```powershell
git switch main
git pull --ff-only
git switch -c <branch-name>

# ... التنفيذ ...

bun run typecheck
bun run test
bun run services:check
bun run build

git add -A
git commit -m "<type>(<scope>): <message>"
git push -u origin HEAD

# إن كان gh متاحًا ومصادقًا:
gh pr create --base main --fill
gh pr merge --squash --delete-branch

# وإلا: افتح PR من GitHub وادمجه squash ثم احذف الفرع.
```

**بوابة الدمج:** كل jobs CI خضراء + مراجعة diff + لا ملفات غير مقصودة + لا `TODO` جديد + تحديث الوثائق إن تغيّر السلوك. إن كان job أحمر، أصلحه في نفس PR؛ لا تدمج ثم تصلح.

---

## 1) حالة البداية الإلزامية

قبل أي تعديل، نفّذ وسجّل:

```powershell
git status --short
git branch -vv
git log --oneline -5
bun --version; node --version; rustc --version; cargo --version
bun run typecheck
bun run test
bun run services:check
bun run build
cargo fmt --check
cargo check --all-targets --all-features
bun audit
```

اعرف هذه الحقائق:

- الفرع الحالي `feat/production-closure-20261018` متقدم 1 عن `main` وغير مدموج.
- 8 ملفات معدّلة غير ملتزمة.
- `main` عند `f76b801`.
- 115 خدمة implemented، 29 runtime، 75 planned.
- CI على `main` أحمر بسبب `source-map-js`.
- `cargo fmt --check` فاشل.
- `cargo check` محليًا قد يفشل بسبب `link.exe`.

---

## 2) المراحل

### المرحلة 0 — تثبيت خط الأساس وحوكمة الفروع

**الفرع:** `chore/baseline-freeze`

**الهدف:** شجرة عمل نظيفة، فرع M16/M17 جاهز للمراجعة، وrepo مهيأ للعمل المرحلي.

**المهام:**

1. راجع diff الملفات الثمانية. صنّفها:
   - إصلاحات M16/M17 الحقيقية (Rust + `generate-service-reality.ts`): اذهب بها إلى المرحلة 3/2.
   - `BrandGalleryView.tsx`: إن كانت WIP غير مكتملة، `git stash push` واتركها للمرحلة 6. لا تدمج تغييرًا بصريًا غير مكتمل.
2. أنشئ فرعًا للعمل الحالي إن لم يكن موجودًا، ثم:
   ```powershell
   cargo fmt --all
   bun run typecheck
   bun run test
   bun run services:check
   ```
3. اعمل commits منطقية:
   - `chore(m16,m17): format native engines`
   - `fix(services): require evidence host machine`
   - `chore(baseline): record 2026-10-20 metrics` (إن أضفت ملف baseline)
4. ادفع الفرع وافتح **Draft PR** إلى `main`. لا تدمجه بعد.
5. احذف الفروع البعيدة المدموجة بالكامل (0 commits فريدة):
   ```
   feat/premium-workspace-rebuild
   feat/m03-real-duplicate-engine
   feat/m15-developer-studio
   feat/m02-real-cleanup-engine
   feat/m04-real-storage-analyzer
   feat/complete-14-partial-services
   feat/m05-startup-services-complete
   feat/m06-performance-center-complete
   feat/m07-windows-repair-complete
   feat/m08-network-internet-complete
   feat/knoux-one-unified-workspace-shell-20260925
   ```
   تحقق أولًا: `git rev-list --count main..origin/<branch>` يجب أن يكون 0.
6. على GitHub:
   - فعّل حماية `main`: Require PR، Require status checks (`web`, `windows`)، Require linear history، منع force-push، منع الحذف.
   - فعّل `delete branch on merge`.
   - فعّل Dependabot (npm + cargo + GitHub Actions) أسبوعيًا.
   - اسمح بـ squash merge فقط.
   - عطّل/احذف workflows المؤقتة غير المستخدمة بعد مراجعة قائمة Actions.
7. احذف الفرع المحلي `fix/readme-runtime-honesty-and-deploy-provenance` بعد التأكد أن محتواه في `main` عبر squash (قارن المحتوى لا الـ hash).
8. أضف `docs/audit/backlog.md` باكتشافات مؤجلة (لا تنفذها).

**معايير القبول:**

- `git status` نظيف.
- `cargo fmt --check` يمر على الفرع.
- PR draft موجود مع وصف يذكر 115/29/75.
- 11 فرعًا محذوفة على الأقل.
- حماية main وDependabot مفعّلان (لقطات/تأكيد في PR).

**الدمج:** ادمج PR الحوكمة/التوثيق فقط. اترك PR M16/M17 مفتوحًا للمرحلة 3.

**ممنوع:** دمج M16/M17 هنا؛ حذف فروع فيها commits فريدة؛ تعديل تاريخ main.

---

### المرحلة 1 — سلسلة التوريد والأصول المحلية وCSP

**الفرع:** `fix/security-local-assets`

**الهدف:** إغلاق P0 الأمني: `bun audit` = 0، لا أصول خارجية، أيقونات صحيحة، CSP إنتاجي.

**المهام:**

1. **إصلاح الثغرة:**
   - أضف إلى `package.json` داخل `overrides`:
     ```json
     "source-map-js": "1.2.2"
     ```
   - `bun install` ثم `bun audit`. يجب أن تكون النتيجة `0 vulnerabilities`.
   - لا ترفع `vite` أو `tailwind` major في هذه المرحلة.

2. **الشعار والـ favicon:**
   - استخدم الشعار الرسمي الموجود (لا تعد تصميمه). أنشئ نسخة نظيفة 1024×1024 PNG بخلفية شفافة إن أمكن.
   - احفظ المصدر في `public/brand/source/knoux-mark-1024.png` (أو `src/assets/brand/` إن أردت hashing).
   - أنشئ WebP للواجهة (256px و64px) وSVG favicon مبسط إن أمكن دون تغيير الهوية.
   - استبدل روابط `postimg.cc` في:
     - `index.html` (favicon)
     - `src/data/officialBrand.ts` (`nightLogo`, `dayLogo`)
   - أزل `withLogoRevision` إن لم يعد له معنى، أو أبقِه للمسار المحلي.
   - أزل ملفات `.jpg` التالفة (286 bytes) من `public/brand/logos` و`gallery` أو استبدلها بأصول حقيقية. لا تترك صورة مكسورة في المعرض.

3. **أيقونات Tauri:**
   ```powershell
   bun run tauri icon public/brand/source/knoux-mark-1024.png
   ```
   تحقق أن `src-tauri/icons/32x32.png` و`128x128.png` و`icon.ico` و`icon.icns` أحجامها منطقية (ليست 77/86 bytes).

4. **manifest:**
   - أعد توليد `public/brand/manifest.json` من الملفات الفعلية: `path`, `mimeType`, `sizeBytes`, `sha256`.
   - أضف سكربت `scripts/generate-brand-manifest.ts` و`brand:check` لمنع الانحراف.

5. **الخطوط:**
   - نزّل WOFF2 من Google Fonts (رخصة OFL) إلى `public/fonts/`: Cairo (600/800)، Inter (400/600/700)، JetBrains Mono (500/600).
   - احذف `<link>` الخارجية من `index.html`.
   - أضف `@font-face` في `src/index.css` مع `font-display: swap`.
   - لا تضف Tajawal إن لم يُستخدم فعليًا. افحص `font-family` أولًا.
   - أضف `<link rel="preload" as="font" type="font/woff2" crossorigin>` للأوزان الحرجة فقط.

6. **CSP في Tauri:**
   - في `src-tauri/tauri.conf.json`:
     ```json
     "security": {
       "csp": "default-src 'self'; img-src 'self' asset: http://asset.localhost data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src ipc: http://ipc.localhost; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
       "devCsp": "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src ipc: http://ipc.localhost http://localhost:3000 ws://localhost:3000"
     }
     ```
   - إن رفض Tauri مفتاحًا، راجع schema الإصدار المثبت ولا تعطّل CSP.
   - أضف `minWidth: 1100` و`minHeight: 720` إلى النافذة.
   - أضف `backgroundColor` داكنًا للنافذة إن كان مدعومًا لمنع وميض أبيض.

7. **التحقق:**
   ```powershell
   bun audit
   bun run build
   Select-String -Path index.html,src\data\officialBrand.ts -Pattern "postimg|fonts.googleapis|fonts.gstatic"
   ```
   يجب ألا يظهر أي رابط خارجي.

**معايير القبول:**

- `bun audit` = 0.
- لا `postimg` ولا Google Fonts في `index.html` أو `officialBrand.ts`.
- الأيقونات بأحجام صحيحة.
- manifest يطابق الملفات.
- CSP مفعّل وليس `null`.
- `bun run typecheck` و`test` و`build` خضراء.

**الدمج:** squash merge. هذه المرحلة أساس لكل ما بعدها.

**ممنوع:** تعطيل `bun audit`؛ السماح بـ `https://i.postimg.cc` في CSP؛ استخدام أيقونة placeholder.

---

### المرحلة 2 — مصدر الحقيقة الواحد: التوثيق والإصدار وحارس الأدلة

**الفرع:** `fix/truth-single-source`

**الهدف:** إزالة تناقض README، توحيد الإصدار، وتقوية مولّد الخدمات ليفشل عند أي كسر في السلسلة.

**المهام:**

1. **README:**
   - أضف علامات توليد:
     ```
     <!-- REALITY:START -->
     ...
     <!-- REALITY:END -->
     ```
   - اجعل `scripts/generate-service-reality.ts` يكتب الكتلة (115، 86، 29، 75، النسبة 25.22%، وتوزيع الوحدات) داخل العلامات.
   - احذف من النثر كل رقم ثابت قديم: `101`, `72`, `28.71`, `M09-M14 and M16-M19 remain planned`.
   - اكتب فقرة صادقة عن الحالة: 115 implemented، 29 runtime، 75 planned، والبوابة BLOCKED.
   - أضف في `--check` مقارنة الكتلة، وفشلًا إن وُجد رقم قديم.

2. **حارس السلسلة في المولّد:**
   - بعد بناء الخدمات:
     - تأكد أن كل `implemented` له `handlerId`.
     - تأكد أن `handlerId` موجود في `NATIVE_COMMANDS`.
     - تأكد أن الأمر الناتج موجود في `generate_handler![...]` داخل `src-tauri/src/main.rs`.
     - اسمح بازدواج handler فقط عبر قائمة صريحة `ALLOWED_SHARED_HANDLERS` (حاليًا `m15.ports.manage`).
     - ارمِ خطأً واضحًا يذكر الخدمة والـ handler والأمر.
   - أضف اختبارًا `src/tests/nativeChainIntegrity.test.ts` يغطي المنطق نفسه إن أمكن.

3. **الإصدار:**
   - اختر رقمًا واحدًا. الأفضل `1.0.0` حتى الإصدار الأول، أو `3.0.0` إن كان 3.0 هو رقم المنتج التسويقي. لا تخلط.
   - في `vite.config.ts`:
     ```ts
     define: { __APP_VERSION__: JSON.stringify(pkg.version) }
     ```
   - استخدم `__APP_VERSION__` في `Header.tsx` بدل `v3.0`.
   - حدّث `tauri.conf.json` و`Cargo.toml` إن لزم، وشغّل `bun run release:verify-version`.
   - لا تعدل أدلة runtime التاريخية؛ إن تغير الإصدار، وثّق ذلك في baseline.

4. **الوثائق:**
   - حدّث `docs/services/service-reality-baseline.md` عبر المولّد.
   - أضف `docs/audit/backlog.md` إن لم يكن.
   - أزل/ادمج التقارير المكررة في الجذر إن كانت مكررة فعليًا (اختياري، دون فقدان معلومة).

**معايير القبول:**

- `bun run services:check` يمر ويقارن README.
- `Select-String README.md -Pattern "101 implemented|28.71|M09-M14 and M16-M19"` لا يعيد شيئًا.
- `Header` يعرض نفس نسخة `package.json`.
- اختبار السلسلة يمر.
- `bun run typecheck && bun run test && bun run build` خضراء.

**الدمج:** squash merge.

**ممنوع:** رفع البوابة يدويًا؛ كتابة أرقام يدوية في README؛ تغيير تعريف `RUNTIME_VERIFIED`.

---

### المرحلة 3 — دمج M16/M17

**الفرع:** `feat/m16-m17-merge` (أو نفس فرع المرحلة 0 بعد rebase)

**الهدف:** نقل محركي المشاريع والتشخيص إلى `main` مع CI أخضر.

**المهام:**

1. Rebase على `main` بعد المرحلتين 1 و2:
   ```powershell
   git fetch origin
   git switch feat/production-closure-20261018
   git rebase origin/main
   ```
   حل التعارضات يدويًا. لا تستخدم `-X ours/theirs` بشكل أعمى.
2. `cargo fmt --all`؛ أصلح `clippy` إن ظهر.
3. تحقق من:
   - `src-tauri/src/main.rs` يسجل كل أوامر M16/M17.
   - migration `005_projects_and_diagnostics.sql` موجودة ومتصلة.
   - `Cargo.toml` و`Cargo.lock` متسقان.
   - `scripts/generate-service-reality.ts` يمر ويعطي 115.
4. أضف اختبارات Rust للحد الأدنى:
   - رفض المسارات خارج النطاق المسموح.
   - redaction للبيانات الحساسة.
   - عقد `OperationResult` للحالات الأساسية.
5. شغّل على CI Windows: `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`.
6. حدّث `README`/module docs لـ M16 (4 static/6 planned) وM17 (10 static/0 runtime) بصدق.
7. ادفع، أزل Draft، اطلب مراجعة، ادمج بعد الأخضر.

**معايير القبول:**

- CI: web + windows + dependency + secret scan كلها خضراء.
- 115 implemented على `main`.
- `cargo fmt --check` يمر.
- لا تغييرات غير ملتزمة.
- M16/M17 لهما وثائق حالة صادقة (0 runtime).

**الدمج:** squash merge، ثم احذف الفرع البعيد والفرع المحلي بعد التأكد.

**ممنوع:** دمج Rust غير منسق؛ تجاهل فشل Windows؛ إعلان runtime لم يُختبر.

---

### المرحلة 4 — الأداء والخفة

**الفرع:** `perf/bundle-diet`

**الهدف:** تقليل الحمولة الأولى والأصول والاعتماديات دون تغيير السلوك.

**المهام:**

1. **تقسيم المسارات:**
   - في `src/App.tsx`، حوّل كل الواجهات (عدا `DashboardView`) إلى `React.lazy`.
   - استخدم `Suspense` مع `RouteSkeleton` يحافظ على التخطيط.
   - تأكد أن التنقل لا يعيد تحميل الشل.
2. **Vite:**
   - أضف `manualChunks` لمجموعات: `react`, `tauri`, `icons`.
   - لا تضع `data/capabilitiesCatalog.ts` في chunk منفصل إلا إن كان له فائدة قياسية.
3. **تنظيف:**
   - احذف `motion` من `dependencies` بعد التأكد أنه غير مستورد.
   - احذف `DashboardHero.tsx` و`StatusCardsGrid.tsx` أو استخدمهما فعليًا.
   - انقل `@vitejs/plugin-react` و`@tailwindcss/vite` إلى `devDependencies`؛ احذف `autoprefixer` إن لم يلزم؛ حدّث `@types/node` إلى 24.
4. **الصور:**
   - حوّل الشعارات إلى WebP/AVIF بأحجام 64/256/512.
   - المعرض: WebP بعرض أقصى 1200، `loading="lazy"`, `decoding="async"`, `width/height` صريحة.
   - لا تحمّل المعرض إلا عند فتح مساره (lazy route).
   - استهدف ≤1.5 MB لكل `public/brand`.
5. **الخطوط:**
   - قلّل الأوزان إلى 3–4 أوزان أساسية.
   - أضف `preload` للوزنين الحرجين فقط.
   - استخدم `font-display: swap` و`size-adjust` إن لزم لتقليل CLS.
6. **Rust:**
   - أضف في `src-tauri/Cargo.toml`:
     ```toml
     [profile.release]
     lto = "thin"
     codegen-units = 1
     strip = true
     ```
   - قِس حجم المثبت قبل/بعد. لا تضف `panic = "abort"` إن كان يكسر الاختبارات أو السلوك.
7. **ميزانية الحزمة:**
   - أضف `scripts/check-bundle-budget.ts` يقرأ `dist/index.html` لمعرفة entry، ويقيس gzip، ويفشل إذا تجاوز:
     - initial JS ≤ 300 kB gzip
     - إجمالي JS ≤ 900 kB gzip
     - CSS ≤ 40 kB gzip
   - أضفه إلى CI.
8. **القياس:**
   - سجّل قبل/بعد في PR: حجم entry، عدد chunks، زمن build، حجم `public/brand`.

**معايير القبول:**

- entry JS ≤ 300 kB gzip (الهدف المفضل ≤250).
- عدد chunks ≥ 6.
- لا `motion` في `package.json`.
- الصور محسّنة وlazy.
- `check-bundle-budget` يمر في CI.
- لا تغيير في السلوك أو النصوص.

**الدمج:** squash merge.

**ممنوع:** تحسين مبكر معطّل (مثل `React.memo` عشوائي)؛ إزالة صور المعرض؛ كسر RTL.

---

### المرحلة 5 — المعلومات والتنقل

**الفرع:** `fix/ia-navigation`

**الهدف:** كل شاشة لها مدخل صحيح، وسجل العمليات موجود، والتفضيلات تُحفظ.

**المهام:**

1. **Operations History:**
   - أنشئ `src/components/views/OperationsHistoryView.tsx`.
   - يعرض `actionLogs` مع فلترة (الكل/ناجح/فاشل/ملغى)، وقتًا محليًا، تفاصيل، وزر «نسخ الدليل».
   - يعرض `supportTickets` كمسودات دعم إن كانت موجودة.
   - اربط `route: 'support'` به في `App.tsx`.
   - احذف `SupportPortalView.tsx` أو أبقِه كإعادة تصدير واضحة إن كان مستخدمًا في مكان آخر. الأفضل حذفه.
   - أبقِ `cloud` → `CloudSupportView` (m19).
2. **مداخل السايدبار:**
   - أضف `catalog` و`brand-gallery` إلى `SHELL_WORKSPACES` أو مجموعة «المزيد».
   - `web-landing`: إما رابط خارجي في About/Settings، أو إزالته من شل سطح المكتب. لا تتركه route يتيمًا.
   - تأكد أن كل route في `App.tsx` له مدخل واحد على الأقل.
3. **First Run:**
   - غيّر `isFirstRunWizardCompleted` ليقرأ من `localStorage` (`knoux.firstRun.completed`).
   - اعرض `FirstRunView` عند أول تشغيل فقط، مع «تخطي».
   - لا تعرضه للمستخدمين الحاليين إن كان المفتاح موجودًا.
4. **التفضيلات:**
   - احفظ `theme` و`language` في `localStorage` (`knoux.theme`, `knoux.language`).
   - اقرأ القيمة عند الإقلاع، واستخدم `system` إن كان مدعومًا.
   - اجعل العربية متاحة كخيار أول، ويفضل أن تكون الافتراضي `ar` أو «حسب النظام» لمنتج عربي.
5. **الإصدار:**
   - استخدم `__APP_VERSION__` في Header؛ أزل `v3.0`.
6. **CSS:**
   - أصلح `src/index.css:233` من `shrink: 0` إلى `flex-shrink: 0`.
7. **اختبارات:**
   - حدّث `shellIntegrity.test.ts` ليتحقق أن كل route له مدخل.
   - أضف اختبارًا لحفظ اللغة/الثيم إن أمكن.

**معايير القبول:**

- «Operations & history» يفتح سجل العمليات، وليس m19.
- catalog/gallery/landing قابلة للوصول أو محذوفة رسميًا.
- تغيير اللغة والثيم يبقى بعد إعادة التشغيل.
- أول تشغيل يعرض onboarding مرة واحدة.
- كل الاختبارات خضراء.

**الدمج:** squash merge.

**ممنوع:** إبقاء route `support` مكررًا؛ حذف `CloudSupportView` (ما زال m19)؛ كسر الروابط القديمة دون redirect.

---

### المرحلة 6 — نظام التصميم والهوية وSplash

**الفرع:** `feat/design-system-identity`

**الهدف:** هوية بصرية متماسكة واحترافية، لا قالب داشبورد AI.

**المهام:**

1. **توحيد CSS:**
   - اجعل `src/index.css` مصدر المتغيرات الدلالية.
   - انقل مكوّنات `workspace.css` إلى `@layer components` أو أبقِهما مع ترتيب import واضح. لا تكرر نفس القاعدة في الملفين.
2. **الرموز (tokens):**
   - أضف/حدّث:
     - خلفيات: `--bg`, `--surface-1..3`, `--surface-overlay`
     - حدود: `--border-subtle`, `--border-strong`
     - نصوص: `--text`, `--text-secondary`, `--text-muted`, `--text-inverse`
     - دلالات: `--accent`, `--success`, `--warning`, `--danger`, `--info`
     - تركيز: `--focus-ring`
     - حركة: `--motion-fast: 120ms`, `--motion-base: 180ms`, `--motion-slow: 240ms`
   - اجعل الوضع الفاتح متسقًا، لا مجرد عكس الألوان.
3. **الخطوط:**
   - اعتمد ثلاث عائلات كحد أقصى:
     - عناوين: `Alexandria` (أو Cairo 800/900 إن تعذر).
     - نص: `IBM Plex Sans Arabic` (أو Cairo 400/600).
     - كود: `JetBrains Mono`.
   - حمّلها محليًا (المرحلة 1) واستخدم أوزانًا محدودة.
   - مقياس: 11 label صغير جدًا ممنوع؛ 12 أدنى label، 13–14 body، 16 lead، 20 h3، 24 h2، 32 h1، 44 display.
4. **الشعار:**
   - إن أمكن، أنشئ SVG master نظيف من الشعار الرسمي (بدون إعادة تصميم).
   - أنشئ variants: أفقي، رمزي، أحادي اللون، فاتح/داكن.
   - حدّد clear space وmin size في `docs/brand/identity.md`.
   - استخدمه في Sidebar/Header/About/Gallery. أزل أي CSS قص/hack متبقٍ.
5. **Splash / BootGate:**
   - مكوّن `BootGate` يظهر حتى:
     - تحميل الخطوط (`document.fonts.ready`)
     - تحديد `runtimeMode`
     - أول إطار من التطبيق
   - مدة 900–1600ms، قابلة للتخطي بالنقر/المفتاح.
   - تسلسل: خلفية → رسم مدار الشعار (SVG stroke) → wordmark → سطر حالة → تلاشي.
   - لا نسبة تقدم وهمية. استخدم «تهيئة…» فقط.
   - احترم `prefers-reduced-motion` (إظهار فوري).
   - امنع وميض النافذة عبر `backgroundColor` أو `visible:false` + `show()` مع صلاحية النافذة.
6. **الحركة:**
   - 120ms للـ hover/chips، 180ms للبطاقات/التنقل، 240ms للـ panels/modals.
   - easing: `cubic-bezier(.2,.8,.2,1)`.
   - لا تحرك كل بطاقة عند التمرير. استخدم حركة واحدة عند دخول الصفحة.
7. **المكوّنات الأساسية:**
   - `Button` (primary/secondary/ghost/danger)، `Chip`, `Panel`, `Field`, `Modal`, `Tabs`, `EmptyState`, `Skeleton`, `Tooltip`.
   - استخدمها تدريجيًا في الشاشات الجديدة. لا تعِد كتابة كل الشاشات في هذه المرحلة.
8. **تقليل الزجاج:**
   - اقتصر الزجاج على الشل/overlays. الأسطح النصية صلبة لضمان التباين.

**معايير القبول:**

- لا أصول خارجية.
- كل النصوص ≥12px للـ labels و≥13px body.
- تباين AA للنصوص الأساسية والثانوية (أضف `scripts/check-contrast.ts` إن أمكن).
- Splash يعمل ويُتخطى ويحترم reduced motion.
- الهوية موثقة في `docs/brand/identity.md`.
- `bun run build` و`test` خضراء.

**الدمج:** squash merge.

**ممنوع:** إعادة تصميم الشعار؛ استخدام 4 خطوط؛ gradient بنفسجي على كل سطح؛ حركة على كل عنصر.

---

### المرحلة 7 — الداشبورد: Mission Control

**الفرع:** `feat/dashboard-mission-control`

**الهدف:** تحويل الداشبورد من شبكة بطاقات عامة إلى لوحة قرار واضحة.

**المهام:**

1. **البنية:**
   - الصف الأول: Hero «نبض الجهاز» (8 أعمدة) + بطاقة إجراء سريع/حالة (4 أعمدة).
   - الصف الثاني: قرص التخزين (4)، أثر بدء التشغيل (4)، تعرض الخصوصية (4).
   - الصف الثالث: «ما تغيّر» Timeline (8) + «التوصيات» (4).
2. **البيانات:**
   - استخدم `systemSpecs`, `cleanupCategories`, `actionLogs`, وبيانات m05/m09/m17 إن كانت متاحة.
   - في المتصفح: اعرض «المعاينة لا تقرأ جهازك» بدل أرقام وهمية.
   - لا تعرض نسبة health عامة إن لم تكن محسوبة من عوامل حقيقية. إن أضفتها، اعرض العوامل ووزنها.
3. **الإجراءات:**
   - «فحص سريع» → خدمة موجودة.
   - «تنظيف آمن» → dry-run/معاينة أثر.
   - «خطة إصلاح» → triage أو m07.
   - كل إجراء يفتح تفاصيل الخدمة أو يبدأ عملية مع receipt.
4. **الحالات:**
   - Skeleton لكل ودجة.
   - Error boundary لكل ودجة.
   - Empty state واضح.
5. **الرسوم:**
   - SVG يدوي (ring/bar/sparkline) بألوان tokens. لا مكتبة.
6. **العربية/RTL:**
   - كل النصوص بمفاتيح مزدوجة.
   - الأرقام والوحدات LTR داخل النص العربي.
   - الرسوم تقرأ من اليمين عند RTL.

**معايير القبول:**

- لا رقم مخترع في وضع المتصفح.
- كل ودجة لها loading/error/empty.
- الداشبورد لا تستورد كل الواجهات (lazy route).
- اختبار render أساسي يمر.
- لقطة/وصف قبل-بعد في PR.

**الدمج:** squash merge.

**ممنوع:** health score بلا عوامل؛ sparkline ببيانات عشوائية؛ بطاقات بلا إجراء.

---

### المرحلة 8 — Service Studio

**الفرع:** `feat/service-studio`

**الهدف:** جعل الـ 190 خدمة مفهومة وقابلة للتنفيذ بأمان، مع عقد خدمة واضح.

**المهام:**

1. **البنية:**
   - شريط فلاتر (280px): بحث، module، state (runtime/static/planned)، risk، admin.
   - قائمة خدمات مضغوطة: أيقونة، اسم، سطر نتيجة، chip حالة، risk.
   - لوحة تفاصيل (380px) أو صفحة تفاصيل كاملة على الشاشات الصغيرة.
2. **عقد الخدمة:**
   - ماذا تفعل، ماذا تقرأ، ماذا تكتب، هل هي قابلة للتراجع، هل تحتاج admin، حدود معروفة، حالة الدليل، الأمر native (اختياري للمطور).
   - أزرار: «معاينة» و«تشغيل» و«نسخ الأمر» (إن كان آمنًا).
3. **Dry-run:**
   - إن وُجد أمر dry-run حقيقي، استخدمه.
   - وإلا اعرض «المعاينة غير مدعومة لهذه الخدمة» بصدق. لا تحاكي.
4. **Receipt:**
   - بعد التنفيذ، اعرض `OperationReceipt` (الحالة، المدة، الملخص، التحذيرات، الوقت).
   - أضف «نسخ JSON» و«إضافة إلى سجل الأدلة».
5. **Planned:**
   - اعرض سبب الخطة، وما ينقص، ورابط الخريطة. لا زر تشغيل معطّل بلا تفسير.
6. **التوافق:**
   - طوّر `UniversalServiceWorkspace` بدل استبداله، حتى لا تنكسر 15 شاشة module.
   - أبقِ tabs الحالية أو أضف «العقد» و«الأدلة».
7. **الاختبارات:**
   - فلترة الحالات.
   - عرض planned بلا CTA.
   - receipt من `OperationResult`.

**معايير القبول:**

- كل الوحدات ما زالت تعمل.
- لا تغيير في مسار التنفيذ native.
- لا ادعاء dry-run غير موجود.
- RTL سليم.
- اختبارات جديدة تمر.

**الدمج:** squash merge.

**ممنوع:** كسر `OperationService`؛ إخفاء الحالة الحقيقية؛ تنفيذ تلقائي بلا تأكيد.

---

### المرحلة 9 — Privacy Center

**الفرع:** `feat/privacy-center`

**الهدف:** شاشة خصوصية مستقلة تُثبت أن التطبيق محلي، لا شاشة خدمات إضافية.

**المهام:**

1. **البنية:**
   - Hero «وضع الخصوصية» مع عوامل حقيقية (كاميرا/ميكروفون/موقع/telemetry/hosts/ad ID) من m09.
   - مصفوفة: capability × state (مسموح/ممنوع/غير معروف). «غير معروف» ليست «آمن».
   - لوحة «اتصالات التطبيق»: اذكر فقط ما يستخدمه التطبيق فعلًا (updater GitHub، الموقع). لا تدّعِ صفر اتصالات إن كان updater يعمل.
   - لوحة «البيانات المحلية»: مفاتيح localStorage، عدد سجلات العمليات، مسار الأدلة، أزرار تصدير/مسح.
   - وضع «بدون اتصال»: يوقف فحص التحديثات وأي طلب شبكي من التطبيق، مع مؤشر حالة.
2. **البيانات:**
   - استخدم خدمات m09 الحقيقية عند توفر Tauri.
   - في المتصفح، اعرض حالة غير متاحة بوضوح.
3. **التقرير:**
   - «تصدير تقرير خصوصية» JSON/MD.
4. **النسخ:**
   - لغة دقيقة بلا تهويل. اشرح معنى كل حالة.
5. **الاختبارات:**
   - حالات unavailable.
   - عدم ظهور «آمن» عند بيانات ناقصة.

**معايير القبول:**

- شاشة `privacy` تعرض مركز الخصوصية الجديد.
- لا حالة أمنية fabricated.
- offline mode يعمل ويظهر حالته.
- تصدير التقرير يعمل.
- RTL وa11y أساسيان.

**الدمج:** squash merge.

**ممنوع:** «درجة خصوصية 100%» بلا قياس؛ إخفاء اتصال updater؛ مسح بيانات المستخدم بلا تأكيد.

---

### المرحلة 10 — الجودة والإصدار

**الفرع:** `chore/release-hardening`

**الهدف:** بوابات جودة حقيقية وإصدار موقّع موسوم.

**المهام:**

1. **Lint/Format:**
   - أضف Biome أو ESLint + Prettier.
   - `lint` يجب ألا يظل `tsc` فقط.
   - طبّق تدريجيًا: أخطاء أولًا، ثم تحذيرات. لا تكسر الكود بسبب `any` في مرحلة واحدة.
2. **الوصول:**
   - أضف `@axe-core/playwright` أو `vitest-axe`.
   - افحص: الداشبورد، الخدمات، الخصوصية، الإعدادات.
   - أصلح: contrast، labels، focus، keyboard traps.
3. **E2E:**
   - أضف Playwright smoke (web preview):
     - تحميل الداشبورد.
     - فتح command palette.
     - التنقل إلى catalog.
     - فتح خدمة والتأكد من الحالة.
     - تبديل اللغة والثيم والتأكد من الحفظ بعد reload.
     - فتح privacy.
   - شغّلها في CI مع `bun run build && bun run preview`.
4. **الأداء:**
   - ثبّت `check-bundle-budget` في CI.
   - سجّل أرقام الإقلاع في `docs/audit/performance.md`.
5. **الأمان:**
   - `bun audit` = 0.
   - CSP مفعّل.
   - لا أصول خارجية.
   - `cargo fmt --check` و`clippy -D warnings`.
   - أضف `cargo audit` أو `cargo deny` إن أمكن.
6. **الإصدار:**
   - اختر `1.0.0` (أو الرقم المعتمد).
   - حدّث `CHANGELOG.md`.
   - أنشئ tag `v1.0.0`.
   - ابنِ موقّعًا، أنشئ `latest.json` عبر `release:create-update-manifest`.
   - اختبر التثبيت والتحديث على جهاز Windows نظيف.
   - أضف `LICENSE` بعد قرار المالك. لا تختر ترخيصًا من نفسك.
7. **التنظيف النهائي:**
   - احذف الفروع المتبقية التي لا قيمة لها.
   - راجع workflows المؤقتة.
   - حدّث README بالحالة النهائية الصادقة.

**معايير القبول:**

- كل CI أخضر بما فيه E2E وa11y.
- `bun audit` = 0.
- tag موجود وحزمة موقعة.
- README يطابق baseline.
- لا فروع مدموجة متروكة.
- تقرير إصدار يذكر ما تم التحقق منه runtime وما لم يتم.

**الدمج:** squash merge، ثم أنشئ tag من `main`. لا تدمج بعد الوسم.

---

## 3) مواصفات التصميم التفصيلية

هذه المواصفات إلزامية للهوية الجديدة. يمكن تعديل الألوان الدقيقة بعد اختبار التباين، لكن المبادئ لا تتغير.

### 3.1 لوحة الألوان «Obsidian Instrument»

| الرمز | Dark | الاستخدام |
|---|---|---|
| `--bg` | `#06070C` | خلفية التطبيق |
| `--surface-1` | `#0B0D16` | أسطح أساسية |
| `--surface-2` | `#11141F` | بطاقات |
| `--surface-3` | `#171B2A` | عناصر مرتفعة |
| `--border-subtle` | `rgba(255,255,255,.07)` | فواصل |
| `--border-strong` | `rgba(255,255,255,.14)` | حدود تفاعلية |
| `--text` | `#F4F5FA` | نص أساسي |
| `--text-secondary` | `#B7BCCB` | نص ثانوي |
| `--text-muted` | `#8C92A6` | نص خافت (لا يقل عن 12px) |
| `--accent` | `#7C5CFF` | هوية/إجراء أساسي |
| `--accent-bright` | `#9B85FF` | hover/focus |
| `--success` | `#3DDC97` | verified/نجاح |
| `--warning` | `#F5A524` | تحذير/admin |
| `--danger` | `#F45B69` | خطر/فشل |
| `--info` | `#4FD1C5` | بيانات/قياس |

قواعد:

- لا تستخدم البنفسجي كخلفية كبيرة؛ هو لون إجراء وهوية.
- لا تستخدم الأحمر إلا للخطر الحقيقي.
- لا تعتمد على اللون وحده؛ أضف أيقونة/نصًا.

### 3.2 الخطوط والمقياس

- عناوين: Alexandria 700/800.
- نص: IBM Plex Sans Arabic 400/500/600.
- كود: JetBrains Mono 500.
- بديل مسموح: Cairo 400/600/800 + Inter 400/600 + JetBrains Mono.
- المقياس:
  - 12 label / 16 line
  - 13 body-sm / 20
  - 14 body / 22
  - 16 lead / 26
  - 20 h3 / 28
  - 24 h2 / 32
  - 32 h1 / 40
  - 44 display / 52

ممنوع: نص 9–10px لأي محتوى قابل للقراءة. الـ uppercase tracking للعناوين الصغيرة فقط.

### 3.3 المسافات والحواف

- مسافات: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- حواف: 8 (chip)، 12 (input)، 16 (card)، 20 (panel)، 999 (pill).
- ظل: طبقتان فقط، خفيفتان. لا ظل مع كل بطاقة.
- زجاج: فقط sidebar/header/overlay، وليس على نص طويل.

### 3.4 الحركة

- 120ms: hover/press/chip.
- 180ms: بطاقة/تبويب/سايدبار.
- 240ms: modal/panel/page.
- easing: `cubic-bezier(.2,.8,.2,1)`.
- `prefers-reduced-motion`: إيقاف كل الحركة غير الضرورية.
- لا تحرك أكثر من عنصرين في نفس الوقت.

### 3.5 Splash

- 0ms: خلفية `--bg`، شعار خافت.
- 120ms: رسم مدار الشعار (stroke) خلال 500ms.
- 400ms: ظهور wordmark «KNOUX ONE» خلال 300ms.
- 700ms: سطر الحالة «تهيئة جلسة محلية آمنة…».
- 1000ms: جاهز؛ تلاشي 180ms.
- الحد الأدنى 900ms، الأقصى 1800ms.
- تخطي بالنقر/Enter/Escape.
- لا شريط تقدم وهمي.
- بعد الإقلاع: انتقال هادئ إلى الداشبورد.

### 3.6 الداشبورد

- 12 عمودًا، gutter 16، حد أقصى 1600px.
- Hero: 8 أعمدة، ارتفاع ~220–260px.
- بطاقة جانبية: 4 أعمدة.
- الصف الثاني: 4/4/4.
- الصف الثالث: 8/4.
- كل بطاقة: عنوان + قيمة + سياق + إجراء واحد.
- «ما تغيّر»: خط زمني رأسي رفيع مع نقاط.
- «التوصيات»: 3 بطاقات كحد أقصى، كل واحدة أثر متوقع + خطر + زر.

### 3.7 Service Studio

- Filter rail 280px، list 1fr، inspector 380px.
- Row height 56–64px.
- State chips: `Runtime` (success)، `Static` (info)، `Planned` (muted)، `Partial` (warning).
- تفاصيل الخدمة: أقسام «ماذا تفعل»، «يقرأ»، «يكتب»، «التراجع»، «الحدود»، «الدليل».
- CTA واحد أساسي. «تشغيل» لا يكون primary إن كان خطرًا؛ اجعله danger مع تأكيد.

### 3.8 Privacy Center

- Hero: وضع + عوامل.
- مصفوفة 2×2: الصلاحيات، الخدمات، الشبكة، البيانات المحلية.
- كل خلية: حالة + تفسير + إجراء.
- «غير معروف» بلون warning، وليس success.
- وضع offline: مفتاح واضح + شريط حالة.

### 3.9 RTL

- استخدم `ms/me`, `ps/pe`, `start/end`, `text-start/end`.
- اعكس الأسهم/chevrons الاتجاهية فقط.
- الأرقام، الأكواد، الأوامر: `dir="ltr"`.
- الرسوم: محور قراءة من اليمين.
- لا تعكس الأيقونات غير الاتجاهية.

### 3.10 ممنوعات بصرية

- لا gradient بنفسجي على كل سطح.
- لا زجاج على نصوص طويلة.
- لا 9px labels.
- لا رسوم ببيانات عشوائية.
- لا بطاقات بلا إجراء أو معنى.
- لا أيقونات مجردة بلا tooltip/label.
- لا صور stock أو شخصيات.
- لا Lottie/فيديو في splash.

---

## 4) تعريف الإنجاز النهائي

يعتبر العمل منجزًا فقط عندما تتحقق كل هذه:

- [ ] `main` محمي، Dependabot مفعّل، لا فروع مدموجة متروكة.
- [ ] `bun audit` = 0.
- [ ] `bun run typecheck` = 0.
- [ ] `bun run test` أخضر، مع اختبارات جديدة للسلسلة والتنقل والخدمات والخصوصية.
- [ ] `bun run services:check` يتحقق من README ومن سلسلة Rust.
- [ ] `bun run build` يمر، والحمولة الأولى ≤ 300 kB gzip.
- [ ] `cargo fmt --check` و`clippy -D warnings` أخضران في CI.
- [ ] لا أصول خارجية، CSP مفعّل، أيقونات صحيحة.
- [ ] الداشبورد والخدمات والخصوصية تعمل بالعربية والإنجليزية وRTL.
- [ ] Splash يعمل ويُتخطى ويحترم reduced motion.
- [ ] E2E smoke وa11y أساسيان يمران في CI.
- [ ] README يطابق baseline، والإصدار موحد.
- [ ] tag `v1.0.0` وحزمة موقعة و`latest.json`.
- [ ] تقرير إصدار يذكر 29/115 runtime بصدق ولا يدّعي production-readiness الكامل.

---

## 5) ملحق: أوامر سريعة

```powershell
# حالة
git status --short
git branch -vv
git log --oneline -10

# بوابات
bun run typecheck
bun run test
bun run services:check
bun run build
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
bun audit

# فرع وPR
git switch -c <branch>
git add -A
git commit -m "<type>(<scope>): <message>"
git push -u origin HEAD
gh pr create --base main --fill

# دمج
gh pr merge --squash --delete-branch
git switch main
git pull --ff-only

# فحص سلسلة الفروع
git rev-list --left-right --count main...origin/<branch>
```

### ملاحظات تشغيلية

- `cargo check` المحلي قد يفشل بسبب `link.exe`. لا تعتبره فشل كود؛ اعتمد CI Windows.
- لا تشغّل `cargo fmt` على ملفات لم تلمسها إن كان ذلك سيخلق diff ضخمًا؛ نسّق الملفات المتغيرة فقط ثم أصلح الباقي في PR منفصل.
- عند تعارض rebase، أعد تشغيل البوابات كاملة. لا تدمج حل تعارض بلا اختبار.
- إذا تجاوز PR نطاق المرحلة، قسّمه. لا تدمج «كل شيء» في PR واحد.
- إذا اكتشفت خطأً خارج النطاق، سجّله في `docs/audit/backlog.md` مع دليل، ولا تصلحه الآن.

---

**النهاية.**  
الترتيب ليس اختياريًا: الصدق → CI → الدمج → الأداء → التنقل → الهوية → الداشبورد → الخدمات → الخصوصية → الإصدار.
