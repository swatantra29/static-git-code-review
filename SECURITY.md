# Security Documentation

## ⚠️ CRITICAL SECURITY WARNINGS

### Current Security Status

This application has **significant security limitations** due to its client-side-only architecture. Please read and understand the following before deploying to production.

---

## 🚨 Known Security Issues

### 1. **Client-Side Authentication (INSECURE)**

**Issue:** Username and password are hardcoded in `constants.ts` and checked entirely in the browser.

```typescript
// constants.ts
export const ADMIN_USER = "iic_admin";
export const ADMIN_PASS = "iicbicepadminpassword";
```

**Risk Level:** 🔴 **CRITICAL**

**Impact:**
- Anyone can view the source code and find the credentials
- JWT is simulated (not cryptographically signed)
- No server-side validation
- Cookie can be manipulated by users

**Why It Exists:**
This is a static frontend-only app with no backend. Real authentication requires a server.

**Mitigation Options:**

1. **Deploy behind authentication proxy** (Recommended for production)
   - Use Vercel Authentication
   - Use Cloudflare Access
   - Use Auth0 or similar service

2. **Add a backend API** (Best practice)
   - Create Express/Next.js API routes
   - Store credentials in environment variables
   - Use real JWT with secret signing
   - Validate tokens server-side

3. **Accept the risk** (Only for internal/demo use)
   - This is acceptable for internal tools where source code access = authorized access
   - Not suitable for public-facing production apps

---

### 2. **API Keys in LocalStorage**

**Issue:** Gemini and GitHub API keys are stored in browser LocalStorage with basic obfuscation.

**Risk Level:** 🟡 **MEDIUM**

**Impact:**
- Keys visible via browser DevTools
- Vulnerable to XSS attacks
- Basic base64 obfuscation provides minimal protection

**Best Practice Solution:**
```
DO NOT store API keys in the frontend!

✅ Correct Architecture:
   User → Frontend → Your Backend API → External APIs (with keys)
   
❌ Current Architecture:
   User → Frontend (with keys) → External APIs
```

**Recommended Changes:**
1. Create backend proxy endpoints:
   ```
   POST /api/review → calls Gemini API with server-side key
   GET /api/github/:owner/:repo → calls GitHub API with server-side key
   ```
2. Frontend only sends requests to your backend
3. Backend validates auth tokens before proxying to external APIs

---

### 3. **GitHub Token Exposure**

**Current Implementation:**
- `VITE_GITHUB_TOKEN` is exposed to the client bundle
- This is somewhat acceptable for **read-only public repo access**
- GitHub allows this for client-side apps

**Risk Level:** 🟢 **LOW** (if token has minimal permissions)

**GitHub Token Permissions (Safe Configuration):**
```
✅ ONLY enable: public_repo (read-only)
❌ NEVER enable: Full repo access, write permissions, admin rights
```

**Rate Limits:**
- Without token: 60 requests/hour
- With token: 5,000 requests/hour
- Token allows identification if rate limit issues occur

---

### 4. **Gemini API Key Exposure**

**Current Implementation:**
- Users manually add Gemini API keys via UI
- Keys stored in LocalStorage

**Risk Level:** 🔴 **CRITICAL** (if deployed publicly)

**Problems:**
- Anyone using the app can inject a malicious key
- Your keys can be stolen by users with DevTools access
- No usage tracking or rate limiting

**Solution:** Backend proxy is MANDATORY for production:

```typescript
// backend/api/review.ts (Next.js API route example)
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // Validate auth token first
  const token = req.cookies.auth_token;
  if (!validateToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Use server-side API key (never exposed to client)
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // ... proxy the request
}
```

---

## ✅ Security Improvements Implemented

### 1. **Removed Exposed API Keys from Build**
- ❌ Old: `vite.config.ts` had `define: { 'process.env.API_KEY': ... }`
- ✅ New: Removed - only `VITE_` prefixed vars are exposed

### 2. **Updated Credentials**
- Username: `iic_admin`
- Password: `iicbicepadminpassword`
- Note: Still client-side, see warnings above

### 3. **Added Security Headers (Vercel)**
```json
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
```

### 4. **Proper .gitignore**
- ✅ `.env.local` is ignored
- ✅ `node_modules` ignored
- ✅ `dist` directory ignored

---

## 🔐 Environment Variables

### Development (.env.local)
```bash
# GitHub token (safe to expose with VITE_ prefix - read-only public repos)
VITE_GITHUB_TOKEN=ghp_your_github_token_here

# GEMINI KEY - DO NOT USE VITE_ PREFIX (keeps it server-side only)
# For now, users add via UI, but ideally move to backend
GEMINI_API_KEY=your_gemini_key_here
```

### Production (Vercel Environment Variables)

**Required:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `VITE_GITHUB_TOKEN` = your GitHub token
3. **DO NOT ADD** `GEMINI_API_KEY` until you implement backend proxy

**Why separate instructions?**
- `VITE_*` vars are bundled into client code
- Non-prefixed vars are only available server-side
- Since this is static, there is no server-side yet

---

## 📋 Pre-Deployment Checklist

### Before Pushing to GitHub
- [x] `.env.local` in `.gitignore`
- [x] No hardcoded API keys in code
- [x] Updated credentials
- [x] Review all files for sensitive data
- [x] Test build: `npm run build`

### Before Deploying to Vercel
- [ ] Add `VITE_GITHUB_TOKEN` to Vercel environment variables
- [ ] Set authentication proxy if needed (Vercel Auth, Cloudflare Access)
- [ ] Understand that client-side auth is not secure
- [ ] Consider implementing backend API routes
- [ ] Test production build locally: `npm run preview`

### For Production Use
- [ ] Implement backend API proxy for Gemini
- [ ] Implement real JWT authentication with server validation
- [ ] Move credentials to server-side environment variables
- [ ] Add rate limiting
- [ ] Add request logging/monitoring
- [ ] Set up CSP (Content Security Policy)

---

## 🛡️ Recommended Architecture (Future)

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React)                       │
│  - No API keys                                           │
│  - Sends auth token with requests                       │
│  - Displays data only                                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Backend API (Next.js/Express)               │
│  - Validates JWT tokens                                  │
│  - Stores API keys in environment variables              │
│  - Proxies requests to external APIs                     │
│  - Rate limits users                                     │
│  - Logs usage                                            │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────┐          ┌──────────────┐
│ Gemini API   │          │ GitHub API   │
└──────────────┘          └──────────────┘
```

---

## 📞 Questions?

**Q: Can I use this in production as-is?**
A: Only if:
- It's behind an authentication proxy/firewall
- Users are trusted (internal team)
- You understand and accept the security risks

**Q: How do I implement backend proxy?**
A: 
1. Convert to Next.js (add `pages/api/` directory)
2. Or add Express backend
3. Move API calls to backend routes
4. Frontend calls your API, not external APIs directly

**Q: Is the GitHub token safe to expose?**
A: If it has ONLY `public_repo` read access, and you accept the rate limit risk, yes. But backend proxy is still better.

**Q: What about the hardcoded password?**
A: It's visible in source code. For real security, you need server-side authentication with hashed passwords in a database.

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Vercel Security Best Practices](https://vercel.com/docs/security/secure-by-design)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Client-Side Storage Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)

---

**Last Updated:** 2024
**Status:** ⚠️ Development/Internal Use Only - Not Production Ready for Public Use