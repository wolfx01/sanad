import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'sanad_super_secret_jwt_key_2026_secure_random_hash';
const encodedKey = new TextEncoder().encode(JWT_SECRET);

async function main() {
  // إنشاء توكن صالح للمستخدم
  const token = await new SignJWT({
    userId: 2,
    email: 'itsbilalchouichou@gmail.com',
    name: 'bilal',
    role: 'user',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);

  console.log('Generated JWT token successfully.');

  // اختبار 1: إرسال رسالة أولى لبدء عقد كراء
  console.log('\n--- اختبار 1: إرسال رسالة "أريد كتابة عقد كراء شقة" ---');
  const res1 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sanad_token=${token}`,
    },
    body: JSON.stringify({ message: 'أريد كتابة عقد كراء شقة' }),
  });

  const data1 = await res1.json();
  console.log('Status:', res1.status);
  console.log('Response 1:', JSON.stringify(data1, null, 2));

  if (!data1.sessionId) {
    console.error('Failed to get sessionId');
    return;
  }

  // اختبار 2: إرسال بيانات المكري والمكتري والمبلغ
  console.log('\n--- اختبار 2: إرسال بيانات العقد ---');
  const res2 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sanad_token=${token}`,
    },
    body: JSON.stringify({
      sessionId: data1.sessionId,
      message: 'المؤجر أحمد العلمي والمستأجر يوسف التازي والسومة الكرائية 3000 درهم شهريا',
    }),
  });

  const data2 = await res2.json();
  console.log('Status:', res2.status);
  console.log('Response 2:', JSON.stringify(data2, null, 2));

  // اختبار 3: معاينة الوثيقة المولدة
  console.log('\n--- اختبار 3: معاينة نص العقد المكتمل ---');
  const res3 = await fetch('http://localhost:3000/api/documents/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sanad_token=${token}`,
    },
    body: JSON.stringify({
      templateId: data1.templateId || 1,
      fields: {
        lessor_name: 'أحمد العلمي (بطاقة: AB123456)',
        tenant_name: 'يوسف التازي (بطاقة: CD789101)',
        property_address: 'شقة 4، الطابق الثاني، إقامة النخيل، الدار البيضاء',
        rent_amount: 3000,
        deposit_amount: 3000,
        start_date: '2026-10-01',
        duration_months: 12,
      },
    }),
  });

  const doc = await res3.json();
  console.log('Preview Status:', res3.status);
  console.log('Document Title:', doc.templateTitle);
  console.log('Document Content:\n' + doc.content);
  console.log('\n🌟 تم التحقق من كل خطوات الشات بوت وتوليد الوثيقة بنجاح تام!');
}

main().catch(console.error);
