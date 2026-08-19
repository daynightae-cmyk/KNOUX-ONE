# تقرير جاهزية إصدار KNOUX ONE على Windows

**تاريخ التحقق:** 19 أغسطس 2026
**المرجع المعتمد:** `88ce65e3a45674a11d7f27b41c2422387247d97a` على `main`
**الحكم:** **NOT RELEASEABLE YET — محكوم أمنياً بمتطلبات مالك موثقة.**

هذا حكم إنتاجي صادق. أصبح المستودع يملك مسار بناء وحزم وتحديث وإصدار قابل للمراجعة، ومفتاح Tauri محفوظاً خارج Git ومضمناً مفتاحه العام في العميل، وبيئة `beta` مقيدة بوسوم الإصدار. لكن لا توجد حتى الآن مادة توقيع Authenticode، ولا مراجعات بيئية مفوضة، ولا إصدار منشور أو اختبار runtime. لذلك لا يجوز وصف أي installer حالي بأنه صالح للتوزيع العام، ولا يجوز نشر `latest.json`، ولا يجوز رفع حالة مركز الإصدارات إلى تحقق runtime.

> يتحقق updater في Tauri من artifact باستخدام توقيع إلزامي ومفتاح عام مضمن، ولا يمكن تعطيل هذه الحماية. [1]

## الملخص التنفيذي

| مجال P1                   | الحالة                         | الدليل                                                                              | الحد المتبقي                                                                               |
| ------------------------- | ------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| البناء القابل للإعادة     | **PASS**                       | `bun.lock` و`src-tauri/Cargo.lock` مقفلان؛ CI بعيد ناجح على commit المرجع           | لا شيء لبناء smoke غير الموقّع.                                                            |
| حزم Windows               | **PASS، غير موقّعة عمداً**     | NSIS debug smoke-build محلي وبعيد ناجح                                              | إصدار release موقّع لم يُنفذ.                                                              |
| Authenticode              | **BLOCKED**                    | بوابة `verify-windows-signatures.ps1` موجودة وترفض غياب `signtool.exe`/هوية Windows | لا شهادة PFX/بيانات Azure ولا Windows SDK signer.                                          |
| توقيع Tauri updater       | **PASS — artifacts debug فقط** | مفتاح خاص خارج Git، مفتاح عام مضمّن، وملفا `.sig` فعليان لـNSIS وMSI                | لا يزال Authenticode وإصدار tag المنشور مطلوبين.                                           |
| عميل التحديث والصلاحيات   | **PASS — static فقط**          | Plugins مسجلة، capability مقيد، عميل وواجهة واختبارات ويب آمنة                      | لا اختبار تحديث فعلي على Windows مثبت.                                                     |
| قنوات `beta` و`stable`    | **PASS — تهيئة فقط**           | ملفات config منفصلة ومولّد `latest.json` حتمي وبيئتا النشر مقيدتان بوسم `v*`        | لا manifest منشور ولا مراجعون مفوضون للبيئات.                                              |
| SHA-256 وSBOM وprovenance | **PASS — مسار مبرمج فقط**      | workflow ينشئ `SHA256SUMS.txt` وSPDX وGitHub attestations                           | لم يُشغَّل workflow tag بسبب الحواجز المقصودة.                                             |
| rollback الآمن            | **PASS — سياسة static**        | workflow يرفض downgrade ويطلب patch أعلى و`beta.N` أعلى                             | لم يثبت التشغيل على قناة منشورة.                                                           |
| تحقق الخدمة M19-S05       | **PLANNED**                    | كتالوج الخدمات لا يعرّف handler مسموحاً لمركز الإصدارات                             | لا ترقية إلى `STATIC_VERIFIED` أو `RUNTIME_VERIFIED` قبل دمج خدمة الكتالوج وإثبات runtime. |

## أدلة التحقق المنفذة

### التحقق المحلي

نفذت البوابات التالية بنجاح على جهاز Windows المتصل بعد دمج التغييرات:

| البوابة                                                                                                  | النتيجة                               |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `bun install --frozen-lockfile`                                                                          | PASS؛ لم تتغير الاعتمادات.            |
| `bun run services:check`                                                                                 | PASS.                                 |
| `bun run release:verify-version`                                                                         | PASS؛ النسخة `1.0.0`.                 |
| `bun run typecheck`                                                                                      | PASS.                                 |
| `bun run test`                                                                                           | PASS؛ **15 ملف اختبار و58 اختباراً**. |
| `bun run build`                                                                                          | PASS؛ بناء Vite إنتاجي ناجح.          |
| `bun audit`                                                                                              | PASS؛ لا ثغرات مُبلغ عنها.            |
| `cargo fmt --check`                                                                                      | PASS.                                 |
| `cargo check --locked --all-targets --all-features`                                                      | PASS.                                 |
| `cargo clippy --locked --all-targets --all-features -- -D warnings`                                      | PASS.                                 |
| `cargo test --locked --all-features`                                                                     | PASS؛ **10 اختبارات Rust**.           |
| `bun run desktop:build -- --debug --bundles nsis --config '{"bundle":{"createUpdaterArtifacts":false}}'` | PASS؛ smoke-build غير موقّع مقصود.    |
| `actionlint` وPrettier لملفي workflow                                                                    | PASS.                                 |

بعد استكمال مفتاح Tauri، نجح بناء debug مع `createUpdaterArtifacts: true` وأنتج NSIS وMSI مع ملف `.sig` فعلي لكل منهما. اجتاز `bun run typecheck` و`bun run test` (**58 اختباراً**) و`bun run build` و`cargo check --locked --all-targets --all-features`. رفضت بوابة Authenticode artifacts كما هو متوقع، لكن سبب الرفض المحدد هو غياب `signtool.exe` ومواد هوية Windows، وليس توقيع updater.

### التحقق البعيد

تشغيل GitHub Actions [`32267787041`](https://github.com/daynightae-cmyk/KNOUX-ONE/actions/runs/32267787041) للـcommit المرجعي انتهى **success**. اجتازت وظائف **Web quality** و**Windows native quality** و**Dependency integrity and secret scan**؛ وتضمنت الأخيرة تدقيق Bun وفحص الأسرار، بينما تضمنت وظيفة Windows Rust format/check/Clippy/tests وsmoke-build للحزمة غير الموقعة.

## ما نُفذ فعلياً

| المكوّن                              | التنفيذ الملتزم                                                                                                 | commit رئيسي         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------- |
| إعادة إنتاج البناء وCI               | قفل Bun وCargo، بوابات web/native/dependency، فحص version                                                       | `61475bb`، `1f02347` |
| الحزم وبوابة Authenticode            | NSIS وMSI، بوابة ترفض installer غير صالح وتنتج SHA-256                                                          | `93905ec`            |
| عميل updater                         | Plugins Tauri، `UpdateCenter`، صلاحيات `updater:default` و`process:allow-restart` فقط، اختبارات fallback الآمنة | `ed4fff5`            |
| قنوات التحديث                        | `tauri.beta.conf.json` و`tauri.stable.conf.json` ومولّد manifest من `.sig` الفعلي                               | `c373f0a`            |
| workflow الإصدار                     | Tag فقط، بيئات، توقيع PFX/Azure مشروط، SBOM، attestation، نشر manifest أخيراً                                   | `49c8995`            |
| وثيقة الحواجز                        | خطوات المالك ومصدرها ومقياس الإغلاق                                                                             | `cac35e7`            |
| إصلاح CI بعد تفعيل updater artifacts | smoke-build غير موقّع منفصل؛ التوقيع يبقى لــrelease workflow                                                   | `88ce65e`            |

## حالة مواد الثقة وGitHub

تحقق الوصول والتنفيذ في 19 أغسطس 2026 من أسماء الإعدادات فقط، من دون قراءة أي قيمة سرية. أنشئت `beta` وتحققت مطابقة `production` للبيئة القائمة، وقيدت كلتاهما بسياسة deploy لوسم `v*` فقط. خُزن السر `TAURI_SIGNING_PRIVATE_KEY` في البيئتين من الملف المحلي خارج Git. لا توجد شهادة PFX أو بيانات Azure أو متغيرات توقيع Windows، ولا توجد قواعد مراجع مفوضين حالياً.

| المعرّف         | الحالة الحالية                                                            | الإجراء الإلزامي المتبقي                                                          |
| --------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **BLOCKED-001** | لا شهادة PFX/كلمة مرور ولا إعداد Azure Trusted Signing ولا `signtool.exe` | وفر مسار PFX كاملاً أو مسار Azure، وثبت Windows SDK signer على runner عند الحاجة. |
| **BLOCKED-002** | منفذ تقنياً؛ السر موجود في `beta` و`production`                           | احتفظ بنسخة احتياطية محكومة للمفتاح خارج الجهاز ولا تدوره بعد توزيع العميل الأول. |
| **BLOCKED-003** | أنشئت `beta` وقيدت `beta` و`production` بوسم `v*`                         | عين مراجعين مفوضين ومنع self-approval قبل أول إصدار عام.                          |
| **BLOCKED-004** | منفذ؛ `pubkey` الحقيقي مضمّن في `tauri.conf.json`                         | لا إجراء إضافي، عدا عدم تدوير المفتاح بلا خطة انتقال.                             |

## بوابات أول إصدار tag

لا يُغلق أي بند بكود فقط. قبل إنشاء أول tag، يجب أن تصبح جميع الخانات التالية **PASS**:

| بوابة الإصدار  | المطلوب القابل للمشاهدة                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------- |
| تعارض النسخ    | tag مثل `v1.0.0` يطابق `package.json` و`Cargo.toml` و`tauri.conf.json`.                             |
| توقيع Windows  | NSIS وMSI بحالة Authenticode `Valid`.                                                               |
| توقيع updater  | ملف `.sig` لكلا الحزمتين من build يحتوي المفتاح الخاص الحقيقي.                                      |
| سلامة artifact | `SHA256SUMS.txt` للحزمتين الموقعتين.                                                                |
| supply chain   | `KNOUX-ONE.spdx.json` وprovenance وSBOM attestations قابلة للتحقق. [2]                              |
| القنوات        | `latest.json` يشير إلى NSIS المنشور وتوقيع `.sig` الحقيقي؛ beta لا تتقدم أو تتراجع خارج السياسة.    |
| runtime        | تثبيت Windows فعلي والتحقق من: no update، update متاح، فشل signature، restart، وعدم حدوث downgrade. |

يجب أن يحدث توقيع Authenticode داخل bundling قبل أن يعتمد updater على توقيع artifact؛ لا يُسمح بتعديل installer بعد إنشاء `.sig`. يدعم Tauri `signCommand` المدمج لهذا الغرض، كما يوثق مسارات PFX وAzure. [3]

## حدود الحكم الحالية

لا تنطبق حالة **PASS** هنا على ما يلي: لا يوجد installer يحمل Authenticode `Valid`، ولا `latest.json` منشور، ولا SBOM أو attestation لإصدار tag حقيقي، ولا اختبار تحديث runtime. توجد ملفات `.sig` فعلية من مفتاح Tauri المولد، لكنها artifacts debug غير موقعة Authenticode وليست إصداراً عاماً. تلك عناصر **محجوبة** وليست فشلاً مخفياً أو إنجازاً متخيلاً.

استُبقي M19-S05 في سجل حقيقة الخدمات عند `PLANNED`، لأن قاعدة الكتالوج تشترط handler محلياً مسموحاً لكل خدمة قابلة للتنفيذ. واجهة الإعدادات وplugin updater وحدهما لا يكفيان لتغيير هذا الادعاء إلى خدمة كتالوج مُتحقق منها.

## القرار

المستودع الآن **مهيأ تقنياً لتوقيع updater وقناتي الإصدار، لكنه ليس بعد منتجاً قابلاً للتوزيع العام**. قبل أول tag عام، يلزم فقط استكمال هوية Authenticode حقيقية وتعيين مراجعين مفوضين للبيئات ثم تنفيذ إصدار tag والتحقق من artifacts والتحديث runtime. راجع [متطلبات المالك المحجوبة](./RELEASE_BLOCKED_REQUIREMENTS.md) لإغلاق البنود بالترتيب الصحيح.

## المراجع

[1]: https://v2.tauri.app/plugin/updater/ "Tauri v2 Updater Documentation"
[2]: https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds "GitHub: Artifact attestations and SBOM attestations"
[3]: https://v2.tauri.app/distribute/sign/windows/ "Tauri Windows Code Signing"
