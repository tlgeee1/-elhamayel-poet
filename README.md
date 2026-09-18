# موقع الشاعر محمد الحمايل — خطوات التفعيل

الموقع جاهز بالكامل (التصميم، الصفحة الرئيسية، لوحة التحكم). محتاج بس خطوة واحدة
تقنية عشان لوحة التحكم (تسجيل الدخول وحفظ القصائد/الصور) تشتغل، لأنها محتاجة
قاعدة بيانات حقيقية (Firebase) مش مجرد ملفات.

## الخطوة 1: اعمل مشروع Firebase (5 دقايق، مجاني بالكامل)

1. روح على https://console.firebase.google.com وسجّل دخول بحساب Google.
2. دوس "Add project" وسمّي المشروع (مثلاً `elhamayel-poet`).
3. من القائمة الجانبية: **Build → Authentication → Get started**.
   - فعّل **Email/Password** كطريقة دخول.
   - من تبويب **Users**، دوس **Add user** وحط إيميل وباسورد والدك — ده اللي هيدخل بيه على لوحة التحكم.
4. من القائمة الجانبية: **Build → Firestore Database → Create database**.
   - اختار **Start in production mode**.
   - اختار أقرب Location (مثلاً `eur3` لو في أوروبا/الشرق الأوسط).
5. روح على **Project settings** (أيقونة الترس) → نزّل تحت لحد **Your apps** → دوس أيقونة الويب `</>`.
   - سمّي التطبيق أي اسم ودوس **Register app**.
   - هيديك كود فيه قيم زي `apiKey`, `authDomain`, إلخ.

## الخطوة 2: حط القيم في الموقع

افتح ملف `js/firebase-config.js` واستبدل القيم دي بالقيم اللي جبتها:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## الخطوة 3: قواعد الحماية في Firestore

من **Firestore Database → Rules**، استبدل القواعد الموجودة بده:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

ده معناه: أي حد يقدر يقرأ القصائد (عشان الموقع يظهر للناس)، لكن الكتابة/الحذف
محصورة على اللي عامل تسجيل دخول بس (يعني والدك من لوحة التحكم).

## الخطوة 4: ارفع الملفات على GitHub وفعّل Pages

1. اعمل ريبو جديد على GitHub وارفعله كل الملفات (`index.html`, `admin.html`, `css/`, `js/`).
2. من **Settings → Pages**، اختار الـ branch (`main`) وفولدر `/root`.
3. هيديك رابط زي `https://username.github.io/repo-name/`.

## بعد كده

- الموقع الرئيسي: `index.html`
- لوحة التحكم: `admin.html` — والدك يدخل بالإيميل والباسورد اللي عملته في الخطوة 1.
- الصور: لحد ما نضيف رفع ملفات مباشر، والدك بيحط رابط الصورة (ممكن يرفعها مجانًا على
  https://imgbb.com وياخد الرابط من هناك).
- الفيديوهات: بياخد رابط "تضمين" (Embed) من يوتيوب.

لما تشتري الدومين، تقدر تربطه بنفس طريقة إيجي دنت (ملف CNAME في الريبو).
