# API and OS Interface Catalog

| Domain | Interface | Primary call | Production note | Source |
|---|---|---|---|---|
| Performance | PDH | `PdhOpenQuery/PdhAddEnglishCounter/PdhCollectQueryData` | Preferred general Win32 performance-counter consumer; rate counters need multiple samples. | https://learn.microsoft.com/en-us/windows/win32/perfctrs/collecting-performance-data |
| Scheduling | Task Scheduler 2.0 | `ITaskService/ITaskDefinition/triggers/actions` | Use for durable scheduled jobs; 1.0 is deprecated. | https://learn.microsoft.com/en-us/windows/win32/taskschd/about-the-task-scheduler |
| Devices | SetupAPI | `SetupDiGetClassDevs + enumeration` | Installed device information sets and device interfaces. | https://learn.microsoft.com/en-us/windows/win32/api/setupapi/nf-setupapi-setupdigetclassdevsa |
| Network | IP Helper | `GetAdaptersAddresses` | IPv4/IPv6 adapters, gateways/DNS with supported flags. | https://learn.microsoft.com/en-us/windows/win32/api/iphlpapi/nf-iphlpapi-getadaptersaddresses |
| Ports | IP Helper | `GetExtendedTcpTable/GetExtendedUdpTable` | Endpoint tables; PID-owner variants where required. | https://learn.microsoft.com/en-us/windows/win32/api/iphlpapi/nf-iphlpapi-getextendedtcptable |
| Locked files | Restart Manager | `RmRegisterResources + RmGetList` | Find apps/services using registered files without guesswork. | https://learn.microsoft.com/en-us/windows/win32/api/restartmanager/nf-restartmanager-rmgetlist |
| Signatures | WinTrust | `WinVerifyTrust` | Authenticode trust verification. | https://learn.microsoft.com/en-us/windows/win32/api/wintrust/nf-wintrust-winverifytrust |
| Files | Kernel32 file APIs | `GetFileInformationByHandle/Ex, GetFileTime, GetFinalPathNameByHandle` | Stable file identity/metadata and anti-TOCTOU support. | https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfileinformationbyhandle |
| Incremental file index | NTFS USN journal | `FSCTL_QUERY_USN_JOURNAL + read journal` | Optimization only; NTFS/version/permission aware. | https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/ni-ntifs-fsctl_query_usn_journal |
| Recycle Bin | Shell API | `SHQueryRecycleBin / SHEmptyRecycleBin` | Measure before emptying; mutation needs explicit confirmation. | https://learn.microsoft.com/en-us/windows/win32/api/shellapi/ |
| Power plans | PowrProf | `PowerEnumerate/PowerGetActiveScheme/PowerSetActiveScheme` | Prefer modern power scheme APIs. | https://learn.microsoft.com/en-us/windows/win32/power/managing-power-schemes |
| System Restore | SystemRestore/SR | `CreateRestorePoint` | Requires policy/support checks; do not promise if disabled. | https://learn.microsoft.com/en-us/windows/win32/sr/createrestorepoint-systemrestore |
| Firewall | Windows Firewall COM | `INetFwPolicy2` | Profile status and rules/groups through documented interface. | https://learn.microsoft.com/en-us/windows/win32/api/netfw/nn-netfw-inetfwpolicy2 |
| Defender | Defender PowerShell | `Get-MpComputerStatus / Start-MpScan` | Typed bridge, fixed scan type/path only. | https://learn.microsoft.com/en-us/powershell/module/defender/start-mpscan |
| Privacy policy | Policy CSP | `Privacy policies` | Distinguish policy state from per-user app consent UX. | https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-privacy |
| Storage health | Storage module/CIM | `Get-StorageReliabilityCounter / MSFT_PhysicalDisk` | Device/driver dependent; surface missing counters explicitly. | https://learn.microsoft.com/en-us/powershell/module/storage/get-storagereliabilitycounter |