import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ccykgmqpyqyojuhiuztw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeWtnbXFweXF5b2p1aGl1enR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYzOTU1MCwiZXhwIjoyMDg3MjE1NTUwfQ.nKHZhnjao4SeQpma0gRfPPJX-1wC10Xv-5JjA0rKoF4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const FAKE_DOMAIN = '@fsc-system.local';
const NEW_PASSWORD = '123456';

async function fixEmailsAndPasswords() {
    console.log('📋 جاري جلب قائمة المستخدمين...\n');

    let allUsers = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) { console.error('❌', error.message); return; }
        allUsers = allUsers.concat(users);
        hasMore = users.length >= 1000;
        page++;
    }

    // Fetch profiles to get employee_code
    const { data: profiles } = await supabase.from('profiles').select('id, employee_code, full_name, role');
    const profileMap = {};
    if (profiles) profiles.forEach(p => { profileMap[p.id] = p; });

    console.log(`✅ ${allUsers.length} مستخدم | ${profiles?.length || 0} ملف تعريفي`);
    console.log('─'.repeat(70));

    let fixedCount = 0;
    let alreadyOk = 0;
    let failCount = 0;

    for (const user of allUsers) {
        const profile = profileMap[user.id];
        const empCode = profile?.employee_code || '';
        const name = profile?.full_name || user.user_metadata?.full_name || '-';
        const currentEmail = user.email || '';

        // The correct email should be: employee_code@fsc-system.local (no space!)
        const correctEmail = empCode ? `${empCode.trim()}${FAKE_DOMAIN}` : null;

        if (!correctEmail) {
            console.log(`   ⚠️  تخطي: ${name} — لا يوجد كود موظف`);
            continue;
        }

        const needsEmailFix = currentEmail !== correctEmail;

        try {
            const updatePayload = { password: NEW_PASSWORD };
            if (needsEmailFix) {
                updatePayload.email = correctEmail;
                updatePayload.email_confirm = true;
            }

            const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, updatePayload);

            if (updateError) {
                console.error(`   ❌ فشل | ${empCode} | ${name} — ${updateError.message}`);
                failCount++;
            } else {
                if (needsEmailFix) {
                    console.log(`   🔧 تم إصلاح البريد + كلمة المرور | كود: ${empCode} | ${name}`);
                    console.log(`      📧 قديم: ${currentEmail}`);
                    console.log(`      📧 جديد: ${correctEmail}`);
                    fixedCount++;
                } else {
                    alreadyOk++;
                }
            }
        } catch (e) {
            console.error(`   ❌ خطأ | ${empCode} — ${e.message}`);
            failCount++;
        }
    }

    console.log('─'.repeat(70));
    console.log(`\n🏁 الملخص:`);
    console.log(`   🔧 تم إصلاح البريد الإلكتروني: ${fixedCount}`);
    console.log(`   ✅ سليم بالفعل: ${alreadyOk}`);
    console.log(`   ❌ فشل: ${failCount}`);
    console.log(`   🔑 كلمة المرور: ${NEW_PASSWORD}`);
    console.log(`   � صيغة تسجيل الدخول: [كود الموظف] + كلمة المرور ${NEW_PASSWORD}`);
}

fixEmailsAndPasswords();
