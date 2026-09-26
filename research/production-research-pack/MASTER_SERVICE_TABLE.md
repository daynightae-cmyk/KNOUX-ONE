# Master Service Table

Full machine-readable detail is in `contracts/services.json` and CSV.

| Module | Service | Name | State | Readiness | Phase |
|---|---|---|---|---|---|
| M01 | M01-S01 | Windows & hardware discovery | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M01 | M01-S02 | Winget availability verification | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M01 | M01-S03 | Winget repair guidance | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M01 | M01-S04 | Essential software catalog | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M01 | M01-S05 | Bulk essential software installation | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M01 | M01-S06 | Import an installation list | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M01 | M01-S07 | Export installed application inventory | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M01 | M01-S08 | Create post-format profiles | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M01 | M01-S09 | Resumable installation queue | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M01 | M01-S10 | Restore point before setup changes | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M02 | M02-S01 | User temporary files | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M02 | M02-S02 | Windows temporary files | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M02 | M02-S03 | Browser cache | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M02 | M02-S04 | Thumbnail cache | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M02 | M02-S05 | Crash dumps | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M02 | M02-S06 | Delivery Optimization cache | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M02 | M02-S07 | Application & Windows logs | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M02 | M02-S08 | Recycle Bin review | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M02 | M02-S09 | Old Downloads review | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M02 | M02-S10 | Scheduled cleanup profiles | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M03 | M03-S01 | Exact duplicate detection | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M03 | M03-S02 | Fast partial-hash scan | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M03 | M03-S03 | Similar-image detection | PARTIAL | READY_TO_IMPLEMENT | P0_partial_closure |
| M03 | M03-S04 | Duplicate-video detection | PARTIAL | NEEDS_PROTOTYPE | P0_partial_closure |
| M03 | M03-S05 | Duplicate-audio detection | PARTIAL | NEEDS_PROTOTYPE | P0_partial_closure |
| M03 | M03-S06 | Duplicate-document detection | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M03 | M03-S07 | Duplicate-archive detection | PARTIAL | READY_TO_IMPLEMENT | P0_partial_closure |
| M03 | M03-S08 | Duplicate-folder detection | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M03 | M03-S09 | Keeper recommendations | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M03 | M03-S10 | Quarantine and restore | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M04 | M04-S01 | Storage treemap | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M04 | M04-S02 | Largest files | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M04 | M04-S03 | Largest folders | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M04 | M04-S04 | File-type distribution | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M04 | M04-S05 | Old files | PARTIAL | READY_TO_IMPLEMENT | P0_partial_closure |
| M04 | M04-S06 | Downloads analysis | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M04 | M04-S07 | Application-data analysis | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M04 | M04-S08 | External-drive analysis | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M04 | M04-S09 | Low-space alerts | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M04 | M04-S10 | Exportable storage reports | PARTIAL | READY_TO_IMPLEMENT | P0_partial_closure |
| M05 | M05-S01 | Registry startup entries | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M05 | M05-S02 | Startup folders | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M05 | M05-S03 | Scheduled startup tasks | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M05 | M05-S04 | Windows services | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M05 | M05-S05 | Startup impact score | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M05 | M05-S06 | Safe recommendations | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M05 | M05-S07 | Delayed startup | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M05 | M05-S08 | Startup profiles | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M05 | M05-S09 | Change restoration | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M05 | M05-S10 | Boot-performance history | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M06 | M06-S01 | CPU monitoring | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M06 | M06-S02 | RAM monitoring | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M06 | M06-S03 | Disk activity | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M06 | M06-S04 | Network activity | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M06 | M06-S05 | Process explorer | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M06 | M06-S06 | Resource-heavy processes | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M06 | M06-S07 | Process priority control | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M06 | M06-S08 | Power-plan management | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M06 | M06-S09 | Performance profiles | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M06 | M06-S10 | Benchmark report | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M07 | M07-S01 | SFC verification and repair | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M07 | M07-S02 | DISM CheckHealth | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M07 | M07-S03 | DISM ScanHealth | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M07 | M07-S04 | DISM RestoreHealth | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M07 | M07-S05 | Windows Update reset | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M07 | M07-S06 | Icon and thumbnail repair | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M07 | M07-S07 | WMI health and repair | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M07 | M07-S08 | Windows Installer repair | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M07 | M07-S09 | VSS repair | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M07 | M07-S10 | Microsoft Store repair | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M08 | M08-S01 | Adapter inventory | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M08 | M08-S02 | IP, gateway, and DNS information | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M08 | M08-S03 | Ping test | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M08 | M08-S04 | Traceroute | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M08 | M08-S05 | DNS tests | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M08 | M08-S06 | Flush DNS | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M08 | M08-S07 | Renew IP | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M08 | M08-S08 | Winsock and TCP/IP reset | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M08 | M08-S09 | Proxy and firewall status | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M08 | M08-S10 | Network diagnostic report | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M09 | M09-S01 | Windows permission dashboard | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M09 | M09-S02 | Camera permission review | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M09 | M09-S03 | Microphone permission review | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M09 | M09-S04 | Location permission review | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M09 | M09-S05 | Advertising ID | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M09 | M09-S06 | Clipboard history cleanup | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M09 | M09-S07 | Recent-file cleanup | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M09 | M09-S08 | Browser privacy cleanup | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M09 | M09-S09 | Hosts-file inspection | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M09 | M09-S10 | Reversible privacy profiles | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M10 | M10-S01 | Defender status | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M10 | M10-S02 | Defender quick scan | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M10 | M10-S03 | Defender full scan | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M10 | M10-S04 | Defender custom scan | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M10 | M10-S05 | Firewall status | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M10 | M10-S06 | UAC status | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M10 | M10-S07 | SmartScreen status | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M10 | M10-S08 | Secure Boot & TPM | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M10 | M10-S09 | Suspicious startup review | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M10 | M10-S10 | Optional hash reputation lookup | PLANNED | BLOCKED_BY_EXTERNAL_DEPENDENCY | P1_planned |
| M11 | M11-S01 | Restore point | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M11 | M11-S02 | Folder backup | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M11 | M11-S03 | Settings export | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M11 | M11-S04 | Driver export | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M11 | M11-S05 | Environment-variable export | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M11 | M11-S06 | Bookmark backup | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M11 | M11-S07 | Registry-key backup | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M11 | M11-S08 | Recovery bundle | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M11 | M11-S09 | Restore wizard | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M11 | M11-S10 | Scheduled backup | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M12 | M12-S01 | Installed applications | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M12 | M12-S02 | Safe uninstall | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M12 | M12-S03 | Winget update scan | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M12 | M12-S04 | Bulk application updates | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M12 | M12-S05 | Application installation | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M12 | M12-S06 | Driver inventory | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M12 | M12-S07 | Driver export | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M12 | M12-S08 | Missing-driver detection | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M12 | M12-S09 | Default application manager | PLANNED | NEEDS_PROTOTYPE | P1_planned |
| M12 | M12-S10 | Software report | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M13 | M13-S01 | Batch rename | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M13 | M13-S02 | Checksum generator | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M13 | M13-S03 | Archive creation | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M13 | M13-S04 | Archive extraction | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M13 | M13-S05 | Large-file split and join | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M13 | M13-S06 | Folder comparison | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M13 | M13-S07 | Locked-file detection | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M13 | M13-S08 | Metadata and permissions | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M13 | M13-S09 | Secure deletion | PLANNED | NEEDS_PROTOTYPE | P1_planned |
| M13 | M13-S10 | Encoding and line-ending conversion | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M14 | M14-S01 | One-click profiles | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M14 | M14-S02 | Multi-action workflows | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M14 | M14-S03 | Scheduled actions | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M14 | M14-S04 | Command palette | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M14 | M14-S05 | Application launcher | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M14 | M14-S06 | Text snippets | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M14 | M14-S07 | Local clipboard history | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M14 | M14-S08 | Workspace launcher | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M14 | M14-S09 | Folder sync jobs | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M14 | M14-S10 | Notifications and history | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M15 | M15-S01 | Development-environment detection | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M15 | M15-S02 | PATH editor | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M15 | M15-S03 | Git configuration | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M15 | M15-S04 | Node & package-manager status | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M15 | M15-S05 | Python & virtual environments | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M15 | M15-S06 | .NET SDK status | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M15 | M15-S07 | Java & Android tools | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M15 | M15-S08 | Local port viewer | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M15 | M15-S09 | Process & port termination | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M15 | M15-S10 | Developer health report | STATIC_VERIFIED | READY_TO_IMPLEMENT | P2_existing_reference |
| M16 | M16-S01 | Clone Git repository | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M16 | M16-S02 | Approved project templates | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M16 | M16-S03 | Initialize Git | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M16 | M16-S04 | GitHub publishing wizard | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M16 | M16-S05 | Dependency audit | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M16 | M16-S06 | Environment-variable validator | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M16 | M16-S07 | Build-artifact cleanup | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M16 | M16-S08 | Project-size analyzer | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M16 | M16-S09 | JSON & YAML tools | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M16 | M16-S10 | API testing workspace | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M17 | M17-S01 | Event Log summary | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M17 | M17-S02 | Application crash history | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M17 | M17-S03 | BSOD minidumps | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M17 | M17-S04 | Reliability history | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M17 | M17-S05 | Failed service diagnostics | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M17 | M17-S06 | Windows Update diagnostics | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M17 | M17-S07 | Hardware warnings | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M17 | M17-S08 | Network diagnostics | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M17 | M17-S09 | Support bundle | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M17 | M17-S10 | Redacted report | PLANNED | READY_TO_IMPLEMENT | P1_planned |
| M18 | M18-S01 | System summary | PLANNED | NEEDS_PROTOTYPE | P1_planned |
| M18 | M18-S02 | CPU information | PLANNED | NEEDS_PROTOTYPE | P1_planned |
| M18 | M18-S03 | GPU information | PLANNED | NEEDS_PROTOTYPE | P1_planned |
| M18 | M18-S04 | RAM information | PLANNED | NEEDS_PROTOTYPE | P1_planned |
| M18 | M18-S05 | Disk SMART health | PLANNED | NEEDS_PROTOTYPE | P1_planned |
| M18 | M18-S06 | Battery health | PLANNED | NEEDS_PROTOTYPE | P1_planned |
| M18 | M18-S07 | Sensors and temperature | PLANNED | NEEDS_PROTOTYPE | P1_planned |
| M18 | M18-S08 | Display & audio devices | PLANNED | NEEDS_PROTOTYPE | P1_planned |
| M18 | M18-S09 | BIOS & UEFI | PLANNED | NEEDS_PROTOTYPE | P1_planned |
| M18 | M18-S10 | Hardware health score | PLANNED | NEEDS_PROTOTYPE | P1_planned |
| M19 | M19-S01 | Secure sign-in | PLANNED | BLOCKED_BY_EXTERNAL_DEPENDENCY | P1_planned |
| M19 | M19-S02 | Device management | PLANNED | BLOCKED_BY_EXTERNAL_DEPENDENCY | P1_planned |
| M19 | M19-S03 | Settings synchronization | PLANNED | BLOCKED_BY_EXTERNAL_DEPENDENCY | P1_planned |
| M19 | M19-S04 | Encrypted report upload | PLANNED | BLOCKED_BY_EXTERNAL_DEPENDENCY | P1_planned |
| M19 | M19-S05 | Release center | PLANNED | READY_TO_IMPLEMENT | P3_cloud_release |
| M19 | M19-S06 | Preset synchronization | PLANNED | BLOCKED_BY_EXTERNAL_DEPENDENCY | P1_planned |
| M19 | M19-S07 | License center | PLANNED | BLOCKED_BY_EXTERNAL_DEPENDENCY | P1_planned |
| M19 | M19-S08 | Product feedback | PLANNED | BLOCKED_BY_EXTERNAL_DEPENDENCY | P1_planned |
| M19 | M19-S09 | Support tickets | PLANNED | BLOCKED_BY_EXTERNAL_DEPENDENCY | P1_planned |
| M19 | M19-S10 | KNOUX ecosystem downloads | PLANNED | BLOCKED_BY_EXTERNAL_DEPENDENCY | P1_planned |