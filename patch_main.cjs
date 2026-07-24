const fs = require('fs');

let code = fs.readFileSync('src-tauri/src/main.rs', 'utf8');

code = code.replace("system::m01_system_discover,", `system::m01_system_discover,
            system::m01_winget_diagnose,
            system::m01_software_catalog,
            system::m01_software_import_list,
            system::m01_software_export_inventory,
            system::m01_profile_manage,
            system::m01_queue_manage,
            system::m01_restore_point_create,`);

fs.writeFileSync('src-tauri/src/main.rs', code);
