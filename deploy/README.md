# Deployment Guide / מדריך פריסה

[![English](https://img.shields.io/badge/language-English-blue.svg)](deploy/README.md) [![Hebrew](https://img.shields.io/badge/language-Hebrew-blue.svg)](deploy/README.md#hebrew-deployment-guide)

Deployment options for whatsai / אפשרויות פריסה ל-whatsai

## Table of Contents / תוכן עניינים

- [Cloudflare Pages (Recommended) / Cloudflare Pages (מומלץ)](#cloudflare-pages-recommended-cloudflare-pages-מומלץ)
- [Self-hosted Static Preview / פריסה עצמאית סטטית](#self-hosted-static-preview-פריסה-עצמאית-סטטית)
- [GitHub Pages / דפי GitHub](#github-pages-דפי-github)
- [Management and Administration / ניהול ומנהל](#management-and-administration-ניהול-ומנהל)
- [Monitoring and Maintenance / ניטור ותחזוקה](#monitoring-and-maintenance-ניטור-ותחזוקה)

## Cloudflare Pages (Recommended) / Cloudflare Pages (מומלץ)

- **Outcome / תוצאה:** Fully static hosting with global CDN, no server to keep running. Integrates with GitHub for automatic deploys on push. Easiest way to make it consistent and permanent.
- **תוצאה:** אירוח סטטי מלא עם CDN גלובלי, ללא צורך בניהול שרת. משתלב עם GitHub לפריסות אוטומטיות עם דחיפה. הדרך הקלה ביותר להפוך אותו לעקבי וקבוע.

### Steps / שלבים

1) **In Cloudflare Dashboard → Pages → Create project → Connect to GitHub**
   - Select repository: yishaik/whatsai
   - Framework preset: None
   - Build command: npm ci && npm run build
   - Build output directory: dist
   - Environment variables (optional):
     - NODE_VERSION=20

2) **After first deploy, add a custom domain:**
   - Custom domain: whatsai.yishaik.com
   - Cloudflare will create/verify the CNAME and configure TLS

3) **Done. Every push to master triggers a new deploy.**

### Notes / הערות

- The app is static. All OpenRouter calls are made client-side by the user’s browser.
- You can keep the same “Settings → API Key” behavior; no server secrets are required.
- האפליקציה היא סטטית. כל קריאות ה-OpenRouter מבוצעות בצד הלקוח על ידי דפדפן המשתמש.
- ניתן לשמור על התנהגות "הגדרות → מפתח API" זהה; אין צורך בסודות שרת.

## Self-hosted Static Preview / פריסה עצמאית סטטית

- **Outcome / תוצאה:** Your device serves the built app locally; Cloudflare Tunnel exposes it on whatsai.yishaik.com. Use systemd to keep it running.
- **תוצאה:** המכשיר שלך מגיש את האפליקציה הבנויה באופן מקומי; Cloudflare Tunnel חשוף אותה ב-whatsai.yishaik.com. השתמשו ב-systemd כדי לשמור על ריצה קבועה.

### Steps / שלבים

1) **Build once / בנייה חד פעמית**
   ```bash
   npm ci
   npm run build
   ```

2) **Run static preview as a service (port 8080) / הרצת תצוגה מקדימה סטטית כשרות (פורט 8080)**
   - Copy deploy/systemd/whatsai-preview.service to /etc/systemd/system/whatsai-preview.service
   - Edit WorkingDirectory and User to match your environment
   - sudo systemctl daemon-reload
   - sudo systemctl enable --now whatsai-preview

3) **Cloudflared service for this tunnel / שירות Cloudflared למנהרה זו**
   - Create a tunnel (one-time): cloudflared tunnel login; cloudflared tunnel create whatsai
   - Copy ~/.cloudflared/<TUNNEL_ID>.json path
   - Copy deploy/cloudflared/whatsai.yml.example to /etc/cloudflared/whatsai.yml and fill TUNNEL_ID and credentials-file path
   - Route DNS: cloudflared tunnel route dns whatsai whatsai.yishaik.com (add --overwrite-dns to replace existing)
   - Copy deploy/systemd/cloudflared-whatsai.service to /etc/systemd/system/cloudflared-whatsai.service
   - sudo systemctl daemon-reload
   - sudo systemctl enable --now cloudflared-whatsai

4) **Verify / אימות**
   - curl -I https://whatsai.yishaik.com
   - You should see 200/304 from the Vite preview static server

## GitHub Pages / דפי GitHub

- **Outcome / תוצאה:** Use GitHub Actions to deploy /dist to GitHub Pages, then set CNAME “whatsai.yishaik.com” in repo settings and Cloudflare DNS to point to <your-username>.github.io. Cloudflare Pages is typically simpler if your domain is on Cloudflare.
- **תוצאה:** השתמשו ב-GitHub Actions כדי לפרוס /dist ל-GitHub Pages, ואז הגדירו CNAME "whatsai.yishaik.com" בהגדרות הרפוזיטורי ו-DNS של Cloudflare כדי להצביע על <your-username>.github.io. Cloudflare Pages הוא בדרך כלל פשוט יותר אם הדומיין שלכם ב-Cloudflare.

## Management and Administration / ניהול ומנהל

### Deployment Management / ניהול פריסה

1. **Version Control / בקרת גרסאות**
   - Use semantic versioning (MAJOR.MINOR.PATCH)
   - Tag releases in Git
   - Maintain a changelog

2. **Environment Management / ניהול סביבות**
   - Separate development, staging, and production environments
   - Use environment variables for configuration
   - Implement proper secrets management

3. **Rollback Procedures / הליכי חזרה אחורה**
   - Maintain previous version backups
   - Document rollback steps
   - Test rollback procedures regularly

### User Management / ניהול משתמשים

1. **API Key Management / ניהול מפתחות API**
   - Rotate API keys periodically
   - Monitor API usage and quotas
   - Implement rate limiting if needed

2. **Access Control / בקרת גישה**
   - Implement proper authentication for admin functions
   - Use role-based access control
   - Audit access logs regularly

## Monitoring and Maintenance / ניטור ותחזוקה

### Monitoring / ניטור

1. **Performance Monitoring / ניטור ביצועים**
   - Track response times and latency
   - Monitor resource usage (CPU, memory)
   - Set up alerts for performance degradation

2. **Error Tracking / מעקב שגיאות**
   - Implement error logging and monitoring
   - Set up alerts for critical errors
   - Analyze error patterns for improvement

3. **Usage Analytics / אנליטיקת שימוש**
   - Track user engagement metrics
   - Monitor feature usage patterns
   - Analyze user feedback and behavior

### Maintenance / תחזוקה

1. **Regular Updates / עדכונים קבועים**
   - Update dependencies regularly
   - Apply security patches promptly
   - Test updates in staging before production

2. **Backup and Recovery / גיבוי ושחזור**
   - Implement regular backup procedures
   - Test recovery processes
   - Store backups securely offsite

3. **Documentation Updates / עדכוני תיעוד**
   - Keep deployment documentation current
   - Update troubleshooting guides
   - Document changes and new features

## Troubleshooting / פתרון בעיות

### Common Deployment Issues / בעיות פריסה נפוצות

1. **Build Failures / כישלונות בנייה**
   - Check Node.js and npm versions
   - Verify all dependencies are installed
   - Review build logs for errors

2. **DNS Configuration Issues / בעיות תצורת DNS**
   - Verify CNAME records are correct
   - Check TLS/SSL certificate status
   - Test DNS propagation

3. **Performance Issues / בעיות ביצועים**
   - Optimize static assets
   - Implement caching strategies
   - Review CDN configuration

### Debugging Tips / טיפים לדיבוג

- Use browser developer tools for client-side issues
- Check server logs for backend problems
- Test with different network conditions
- Monitor API response times and errors

---

# Hebrew Deployment Guide / מדריך פריסה בעברית

## תוכן עניינים

- [Cloudflare Pages (מומלץ)](#cloudflare-pages-מומלץ)
- [פריסה עצמאית סטטית](#פריסה-עצמאית-סטטית)
- [דפי GitHub](#דפי-github)
- [ניהול ומנהל](#ניהול-ומנהל)
- [ניטור ותחזוקה](#ניטור-ותחזוקה)

## Cloudflare Pages (מומלץ)

- **תוצאה:** אירוח סטטי מלא עם CDN גלובלי, ללא צורך בניהול שרת. משתלב עם GitHub לפריסות אוטומטיות עם דחיפה. הדרך הקלה ביותר להפוך אותו לעקבי וקבוע.

### שלבים

1) **בלוח הבקרה של Cloudflare → Pages → צור פרויקט → התחבר ל-GitHub**
   - בחר רפוזיטורי: yishaik/whatsai
   - הגדרת מסגרת: None
   - פקודת בנייה: npm ci && npm run build
   - תיקיית פלט בנייה: dist
   - משתני סביבה (אופציונלי):
     - NODE_VERSION=20

2) **לאחר הפריסה הראשונה, הוסף דומיין מותאם:**
   - דומיין מותאם: whatsai.yishaik.com
   - Cloudflare ייצור/יאמת את ה-CNAME ויתצור TLS

3) **סיום. כל דחיפה ל-master תפעיל פריסה חדשה.**

### הערות

- האפליקציה היא סטטית. כל קריאות ה-OpenRouter מבוצעות בצד הלקוח על ידי דפדפן המשתמש.
- ניתן לשמור על התנהגות "הגדרות → מפתח API" זהה; אין צורך בסודות שרת.

## פריסה עצמאית סטטית

- **תוצאה:** המכשיר שלך מגיש את האפליקציה הבנויה באופן מקומי; Cloudflare Tunnel חשוף אותה ב-whatsai.yishaik.com. השתמשו ב-systemd כדי לשמור על ריצה קבועה.

### שלבים

1) **בנייה חד פעמית**
   ```bash
   npm ci
   npm run build
   ```

2) **הרצת תצוגה מקדימה סטטית כשרות (פורט 8080)**
   - העתק deploy/systemd/whatsai-preview.service ל-/etc/systemd/system/whatsai-preview.service
   - ערוך WorkingDirectory ו-User כדי להתאים לסביבה שלך
   - sudo systemctl daemon-reload
   - sudo systemctl enable --now whatsai-preview

3) **שירות Cloudflared למנהרה זו**
   - צור מנהרה (חד פעמי): cloudflared tunnel login; cloudflared tunnel create whatsai
   - העתק ~/.cloudflared/<TUNNEL_ID>.json path
   - העתק deploy/cloudflared/whatsai.yml.example ל-/etc/cloudflared/whatsai.yml ומלא TUNNEL_ID ונתיב קובץ האישורים
   - נתב DNS: cloudflared tunnel route dns whatsai whatsai.yishaik.com (הוסף --overwrite-dns להחלפת קיים)
   - העתק deploy/systemd/cloudflared-whatsai.service ל-/etc/systemd/system/cloudflared-whatsai.service
   - sudo systemctl daemon-reload
   - sudo systemctl enable --now cloudflared-whatsai

4) **אימות**
   - curl -I https://whatsai.yishaik.com
   - אתה אמור לראות 200/304 משרת התצוגה המקדימה הסטטי של Vite

## דפי GitHub

- **תוצאה:** השתמש ב-GitHub Actions כדי לפרוס /dist ל-GitHub Pages, ואז הגדר CNAME "whatsai.yishaik.com" בהגדרות הרפוזיטורי ו-DNS של Cloudflare כדי להצביע על <your-username>.github.io. Cloudflare Pages הוא בדרך כלל פשוט יותר אם הדומיין שלך ב-Cloudflare.

## ניהול ומנהל

### ניהול פריסה

1. **בקרת גרסאות**
   - השתמש בגרסאות סמנטיות (MAJOR.MINOR.PATCH)
   - תייג גרסאות ב-Git
   - תחזק יומן שינויים

2. **ניהול סביבות**
   - הפרד בין סביבות פיתוח, בימוי ופרודקשן
   - השתמש במשתני סביבה לתצורה
   - יישם ניהול סודות תקין

3. **הליכי חזרה אחורה**
   - תחזק גיבויים של גרסאות קודמות
   - תעד שלבי חזרה אחורה
   - בדוק הליכי חזרה אחורה באופן קבוע

### ניהול משתמשים

1. **ניהול מפתחות API**
   - החלף מפתחות API באופן קבוע
   - עקוב אחר שימוש ב-API ומגבלות
   - יישם הגבלת קצב אם נדרש

2. **בקרת גישה**
   - יישם אימות תקין לפונקציות מנהל
   - השתמש בבקרת גישה מבוססת תפקידים
   - בדוק יומני גישה באופן קבוע

## ניטור ותחזוקה

### ניטור

1. **ניטור ביצועים**
   - עקוב אחר זמני תגובה וlatency
   - עקוב אחר שימוש במשאבים (CPU, זיכרון)
   - הגדר התראות להידרדרות ביצועים

2. **מעקב שגיאות**
   - יישם רישום ומעקב שגיאות
   - הגדר התראות לשגיאות קריטיות
   - נתח דפוסי שגיאות לשיפור

3. **אנליטיקת שימוש**
   - עקוב אחר מדדי מעורבות משתמשים
   - עקוב אחר דפוסי שימוש בתכונות
   - נתח משוב והתנהגות משתמשים

### תחזוקה

1. **עדכונים קבועים**
   - עדכן תלויות באופן קבוע
   - החל תיקוני אבטחה במהירות
   - בדוק עדכונים בבימוי לפני פרודקשן

2. **גיבוי ושחזור**
   - יישם הליכי גיבוי קבועים
   - בדוק תהליכי שחזור
   - אחסן גיבויים באופן מאובטח מחוץ לאתר

3. **עדכוני תיעוד**
   - שמר על תיעוד פריסה מעודכן
   - עדכן מדריכי פתרון בעיות
   - תעד שינויים ותכונות חדשות

## פתרון בעיות

### בעיות פריסה נפוצות

1. **כישלונות בנייה**
   - בדוק גרסאות Node.js ו-npm
   - ודא שכל התלויות מותקנות
   - סקור יומני בנייה עבור שגיאות

2. **בעיות תצורת DNS**
   - ודא שרכיבי CNAME נכונים
   - בדוק מצב תעודת TLS/SSL
   - בדוק הפצת DNS

3. **בעיות ביצועים**
   - אופטימיזציה של נכסים סטטיים
   - יישם אסטרטגיות מטמון
   - סקור תצורת CDN

### טיפים לדיבוג

- השתמש בכלי הפיתוח של הדפדפן עבור בעיות בצד הלקוח
- בדוק יומני שרת עבור בעיות בצד השרת
- בדוק עם תנאי רשת שונים
- עקוב אחר זמני תגובה ושגיאות של API

