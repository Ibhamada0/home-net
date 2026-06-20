# Home Net - Local MikroTik Proxy

بروكسي محلي صغير يخلي تطبيق Home Net يكلم الراوتر من المتصفح مباشرة
(يضيف CORS ويمرر طلبات REST API).

## المتطلبات
- Node.js 18+
- جهازك على نفس شبكة الراوتر
- تفعيل REST API على الراوتر:
  ```
  /ip service enable www       (HTTP بورت 80)
  أو
  /ip service enable www-ssl   (HTTPS بورت 443)
  ```

## التشغيل (Windows / Mac / Linux)

```bash
cd local-proxy

# عيّن بيانات الراوتر (مرة واحدة لكل جلسة)
# Windows PowerShell:
$env:ROUTER_HOST="10.0.0.1"; $env:ROUTER_PORT="80"; $env:ROUTER_USER="admin"; $env:ROUTER_PASS="YOUR_PASSWORD"

# Linux/Mac:
export ROUTER_HOST=10.0.0.1 ROUTER_PORT=80 ROUTER_USER=admin ROUTER_PASS=YOUR_PASSWORD

node proxy.mjs
```

سوف ترى:
```
Home Net proxy → http://localhost:8080
Forwarding to  → http://10.0.0.1:80
```

## تشغيل التطبيق محلياً (مهم — لتفادي Mixed Content)

```bash
# من جذر المشروع
npm install
npm run dev
```
ثم افتح http://localhost:5173

## اختبار سريع
```bash
curl http://localhost:8080/rest/system/resource
```
