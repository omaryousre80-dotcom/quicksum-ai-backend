// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/auth');
const invoiceRoutes = require('./routes/invoices');
const joinRequestRoutes = require('./routes/joinRequests');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security headers. `crossOriginResourcePolicy` relaxed so uploaded invoice
// images can still be fetched by the frontend across origins if needed.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // the plain HTML/CSS/JS frontend doesn't need a strict CSP here; tighten if you add one
  })
);

// CORS: wide open by default (fine for local dev). Set ALLOWED_ORIGIN in
// production to lock this down to your real frontend domain.
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors(allowedOrigin ? { origin: allowedOrigin, credentials: true } : {}));

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// These paths are referenced in verification/reset emails. Serve the same
// single-page app shell; the frontend JS inspects the URL to show the right view.
app.get(['/verify-email', '/reset-password'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    ai_configured: !!process.env.ANTHROPIC_API_KEY,
    email_configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    invite_only: process.env.INVITE_ONLY === 'true',
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api', joinRequestRoutes);

app.get(['/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Multer / generic error handler (keeps error responses in JSON, not HTML)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'حصل خطأ غير متوقع في السيرفر' });
});

if (NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16)) {
  console.warn(
    '⚠️  تحذير أمان: JWT_SECRET غير مضبوط أو قصير جدًا في بيئة إنتاج. حط قيمة عشوائية طويلة في متغيرات البيئة قبل النشر الحقيقي.'
  );
}

app.listen(PORT, () => {
  console.log(`✅ QuickSum AI backend running on http://localhost:${PORT}`);
  console.log(
    process.env.ANTHROPIC_API_KEY
      ? '✅ ANTHROPIC_API_KEY مضبوط — القراءة بالذكاء الاصطناعي شغالة فعليًا.'
      : '⚠️  ANTHROPIC_API_KEY مش مضبوط — القراءة هترجع بيانات تجريبية بس. شوف .env.example'
  );
  console.log(
    process.env.SMTP_HOST
      ? '✅ SMTP مضبوط — إيميلات التأكيد وإعادة تعيين كلمة المرور هتتبعت فعليًا.'
      : '⚠️  SMTP مش مضبوط — روابط التأكيد/إعادة التعيين هتظهر في الاستجابة والـ console بدل ما تتبعت بريد فعلي.'
  );
});
