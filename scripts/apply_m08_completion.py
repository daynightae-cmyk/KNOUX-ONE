from pathlib import Path

root = Path(__file__).resolve().parents[1]

catalog_path = root / "src/data/capabilitiesCatalog.ts"
catalog = catalog_path.read_text(encoding="utf-8")
marker = "for (const [number, handler, en, ar, options] of m07) implemented('m07', number, handler, en, ar, options);\n\nsetModule('m15'"
block = """for (const [number, handler, en, ar, options] of m07) implemented('m07', number, handler, en, ar, options);

setModule('m08', 'Network Diagnostics', 'إصلاح وتحسين الإنترنت',
  'Inspect real Windows adapters, IP, DNS, latency, routes, proxy and firewall evidence, then run explicit bounded repair commands only after user confirmation.',
  'فحص محولات ويندوز وعناوين IP وDNS وزمن الاستجابة والمسارات والبروكسي وجدار الحماية، ثم تشغيل إصلاحات محددة ومحدودة بعد تأكيد المستخدم.');
const m08: Array<[number, string, string, string, Partial<KnouxCapability>?]> = [
  [1, 'm08.adapters.inspect', 'Windows CIM adapter, MAC, speed, state and signed driver metadata are read without changing adapter state.', 'تتم قراءة محولات الشبكة وعنوان MAC والسرعة والحالة وبيانات التعريف الموقعة دون تغيير حالة المحول.'],
  [2, 'm08.ip.inspect', 'Local IPv4/IPv6, gateways, routes, DHCP and configured DNS servers are read from Windows without contacting a public-IP service.', 'تتم قراءة IPv4 وIPv6 والبوابات والمسارات وDHCP وخوادم DNS من ويندوز دون الاتصال بخدمة خارجية لمعرفة العنوان العام.'],
  [3, 'm08.ping.test', 'Validated targets are measured through bounded .NET Ping requests with real latency and packet-loss evidence.', 'يتم قياس الهدف بعد التحقق منه عبر طلبات Ping محدودة مع زمن الاستجابة وفقدان الحزم الحقيقي.'],
  [4, 'm08.traceroute.run', 'Validated targets use bounded tracert hop and timeout limits while preserving original command output.', 'يستخدم الهدف المتحقق منه أمر tracert بحدود واضحة لعدد القفزات والمهلة مع حفظ الخرج الأصلي.'],
  [5, 'm08.dns.benchmark', 'Cloudflare, Google and Quad9 resolution times are measured read-only without changing the configured DNS server.', 'يتم قياس استجابة Cloudflare وGoogle وQuad9 للقراءة فقط دون تغيير خادم DNS المضبوط.'],
  [6, 'm08.dns.flush', 'The official ipconfig DNS-cache flush is executed without modifying DNS server configuration.', 'يتم تشغيل تنظيف ذاكرة DNS الرسمي عبر ipconfig دون تعديل إعدادات خادم DNS.'],
  [7, 'm08.ip.renew', 'A typed-confirmed administrator operation records pre/post evidence around bounded DHCP release and renew commands.', 'تسجل عملية بصلاحية المسؤول وبعد تأكيد مكتوب أدلة قبل وبعد أوامر تحرير وتجديد DHCP المحدودة.', { requiresAdmin: true }],
  [8, 'm08.stack.reset', 'Typed-confirmed official Winsock and TCP/IP reset commands preserve their reset log and report the required restart.', 'تشغل أوامر Winsock وTCP/IP الرسمية بعد تأكيد مكتوب وتحفظ سجل الإعادة وتوضح ضرورة إعادة التشغيل.', { requiresAdmin: true }],
  [9, 'm08.proxy_firewall.inspect', 'WinHTTP, current-user proxy and Windows Defender Firewall profiles and rule counts are inspected read-only.', 'يتم فحص WinHTTP وبروكسي المستخدم وملفات جدار حماية Windows Defender وأعداد القواعد للقراءة فقط.'],
  [10, 'm08.report.export', 'A local JSON report exports measured adapter, IP, proxy, firewall, TCP/UDP and bounded ping evidence.', 'يتم تصدير تقرير JSON محلي يضم أدلة المحولات وIP والبروكسي والجدار وإحصاءات TCP/UDP وعينة Ping محدودة.'],
];
for (const [number, handler, en, ar, options] of m08) implemented('m08', number, handler, en, ar, options);

setModule('m15'"""
if "const m08: Array" not in catalog:
    if marker not in catalog:
        raise SystemExit("catalog insertion marker not found")
    catalog = catalog.replace(marker, block, 1)
catalog_path.write_text(catalog, encoding="utf-8")

for test_path in (root / "src/tests").glob("*.test.ts"):
    text = test_path.read_text(encoding="utf-8")
    text = text.replace("toHaveLength(70)", "toHaveLength(80)")
    text = text.replace("toHaveLength(120)", "toHaveLength(110)")
    test_path.write_text(text, encoding="utf-8")

matrix_path = root / "REAL_IMPLEMENTATION_MATRIX.md"
matrix = matrix_path.read_text(encoding="utf-8")
matrix = matrix.replace("| Implemented services | 60 |", "| Implemented services | 80 |")
matrix = matrix.replace("| Planned services | 130 |", "| Planned services | 110 |")
matrix = matrix.replace("The 130 planned services remain non-executable", "The 110 planned services remain non-executable")
matrix = matrix.replace(
    "| M07–M14 | Remaining user modules | 0 | 0 | 80 | Planned; no executable handlers |",
    "| M07 | إصلاح مشاكل Windows | 10 | 0 | 0 | Official SFC/DISM, reversible Windows Update reset, cache, WMI, MSI, VSS and Store repair evidence |\n"
    "| M08 | إصلاح وتحسين الإنترنت | 10 | 0 | 0 | Adapter/IP/DNS/latency/route/proxy/firewall evidence plus confirmed bounded Windows repair commands |\n"
    "| M09–M14 | Remaining user modules | 0 | 0 | 60 | Planned; no executable handlers |",
)
if "- M08 has a dedicated network workspace" not in matrix:
    matrix = matrix.replace(
        "- M06 has a dedicated performance workspace for live native measurements, process evidence, reversible controls, power plans, profiles and benchmark reports.\n",
        "- M06 has a dedicated performance workspace for live native measurements, process evidence, reversible controls, power plans, profiles and benchmark reports.\n"
        "- M07 has a dedicated Windows repair workspace with typed confirmation and original command evidence.\n"
        "- M08 has a dedicated network workspace for adapters, IP, ping, traceroute, DNS, cache flush, DHCP renewal, stack reset, proxy/firewall review and report export.\n",
    )
if "## Module 08 — Network & Internet" not in matrix:
    matrix += """

## Module 08 — Network & Internet

- Catalog state after this phase: 80 implemented, 0 partial, 110 planned.
- Dedicated UI: `src/features/network/NetworkOptimizerWorkspace.tsx`.
- Typed bridge: `src/features/network/networkClient.ts` and `networkContracts.ts`.
- Native engine: `src-tauri/src/network_optimizer/mod.rs`.
- Explicit allowlist mappings: `src/services/nativeCommandRegistry.ts`.
- Registered Tauri commands: `src-tauri/src/main.rs`.
- Safety: hostname/IP validation, bounded counts/timeouts/hops, typed confirmation for DHCP renewal and stack reset, administrator checks, read-only DNS/proxy/firewall inspection, original stdout/stderr evidence and JSON report files.
- Integrity gate: `src/tests/m08Integrity.test.ts`.
"""
matrix_path.write_text(matrix, encoding="utf-8")
