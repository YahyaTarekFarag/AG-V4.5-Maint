import fs from 'fs';

const authProviderPath = 'c:\\AG V4.5\\src\\contexts\\AuthContext.tsx';
if (fs.existsSync(authProviderPath)) {
    let content = fs.readFileSync(authProviderPath, 'utf8');
    // Clean up imports and duplicate React import
    content = "import React, { useEffect, useState } from 'react';\n" +
        "import { supabase } from '../lib/supabase';\n" +
        "import { FAKE_DOMAIN } from '../lib/constants';\n" +
        "import { AuthContext } from './AuthContextObject';\n" +
        "\n" +
        content.substring(content.indexOf('export const AuthProvider'));
    fs.writeFileSync(authProviderPath, content);
}
