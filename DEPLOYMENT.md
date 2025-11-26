# Deployment Guide - Static Code Reviewer

## 🚀 Quick Deploy to Vercel

Your code has been successfully pushed to GitHub! Now let's deploy it to Vercel.

**Repository URL:** https://github.com/srisha6505/static-git-code-review

---

## Step 1: Deploy to Vercel

### Option A: Vercel Dashboard (Recommended)

1. **Go to Vercel:**
   - Visit: https://vercel.com/new
   - Sign in with your GitHub account

2. **Import Repository:**
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Authorize Vercel to access your GitHub account if needed
   - Find and select: `srisha6505/static-git-code-review`
   - Click "Import"

3. **Configure Project:**
   ```
   Framework Preset: Vite (should auto-detect)
   Root Directory: ./
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **Add Environment Variables:**
   Click "Environment Variables" section:
   
   | Name | Value | Environments |
   |------|-------|--------------|
   | `VITE_GITHUB_TOKEN` | `ghp_your_token_here` | Production, Preview, Development |

5. **Deploy:**
   - Click "Deploy"
   - Wait 2-3 minutes
   - Your app will be live! 🎉

### Option B: Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Navigate to project directory
cd static_code_reviewer

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? [Your account]
# - Link to existing project? No
# - Project name? static-git-code-review
# - Directory? ./
# - Override settings? No

# Add environment variable
vercel env add VITE_GITHUB_TOKEN
# Paste your GitHub token when prompted

# Deploy to production
vercel --prod
```

---

## Step 2: Set Up GitHub API Token

### Create GitHub Personal Access Token

1. **Navigate to GitHub Settings:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"

2. **Configure Token:**
   ```
   Note: Static Code Reviewer - Read Only Access
   Expiration: 90 days (or custom)
   
   Scopes to select:
   ✅ public_repo (Access public repositories)
   ❌ DO NOT select full "repo" access
   ```

3. **Generate and Copy:**
   - Click "Generate token"
   - **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)
   - Format: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Add Token to Vercel

**Via Dashboard:**
1. Go to your Vercel project
2. Click "Settings" → "Environment Variables"
3. Click "Add New"
4. Name: `VITE_GITHUB_TOKEN`
5. Value: Paste your GitHub token
6. Select all environments: Production, Preview, Development
7. Click "Save"
8. Go to "Deployments" → Latest → "..." → "Redeploy" (uncheck cache)

**Via CLI:**
```bash
vercel env add VITE_GITHUB_TOKEN production
# Paste token when prompted

vercel env add VITE_GITHUB_TOKEN preview
# Paste token when prompted

vercel env add VITE_GITHUB_TOKEN development
# Paste token when prompted

# Redeploy
vercel --prod
```

---

## Step 3: Configure Gemini API Keys

⚠️ **Important:** Gemini API keys should NOT be in environment variables for security reasons.

### Add Keys After Deployment:

1. **Visit Your Live Site**
2. **Login:**
   - Username: `iic_admin`
   - Password: `iicbicepadminpassword`
3. **Add Gemini Keys via UI:**
   - Click the key/settings icon (🔑) in the left sidebar
   - Click "+ Add Key" button
   - Select Type: "Gemini"
   - Enter Name: "My Gemini Key"
   - Paste your Gemini API key (from https://aistudio.google.com/apikey)
   - Click "Add"

**Why this approach?**
- Keys stored in browser LocalStorage (obfuscated)
- Not exposed in source code or build artifacts
- Each user can use their own API keys
- More secure than hardcoding

---

## Step 4: Test Your Deployment

### Complete Testing Checklist:

#### 1. Test Login
- [ ] Visit your Vercel URL: `https://your-project.vercel.app`
- [ ] Enter username: `iic_admin`
- [ ] Enter password: `iicbicepadminpassword`
- [ ] Should redirect to dashboard

#### 2. Test GitHub Integration
- [ ] Enter a public repo URL (e.g., `https://github.com/facebook/react`)
- [ ] Click "Analyze" button
- [ ] Should fetch repo info, commits, files
- [ ] Check for rate limit errors (if present, token not configured)

#### 3. Test Gemini Integration
- [ ] Click key icon in sidebar
- [ ] Add your Gemini API key
- [ ] Return to dashboard
- [ ] Load a repository
- [ ] Click "Generate Review"
- [ ] Should stream AI-generated code review

#### 4. Test All Features
- [ ] Repository analysis loads
- [ ] Commits display with stats
- [ ] Files show in tree view
- [ ] README renders properly
- [ ] Contributors list appears
- [ ] Languages chart displays
- [ ] Review generation works
- [ ] Key management works

---

## Step 5: Custom Domain (Optional)

### Add Custom Domain:

1. **In Vercel Dashboard:**
   - Go to Project → Settings → Domains
   - Click "Add"
   - Enter domain: `code-review.yourdomain.com`

2. **Configure DNS:**
   - Add CNAME record in your DNS provider:
     ```
     Type: CNAME
     Name: code-review
     Value: cname.vercel-dns.com
     TTL: 3600
     ```

3. **Wait for SSL:**
   - Vercel automatically provisions SSL certificate
   - Usually takes 5-30 minutes
   - HTTPS enforced by default

---

## 🐛 Troubleshooting

### Build Fails

**Error:** `Command "npm run build" exited with 1`

**Solution:**
```bash
# Test locally first
cd static_code_reviewer
npm install
npm run build

# Check for errors
# If successful, commit any fixes and push
git add .
git commit -m "Fix build issues"
git push
```

### GitHub Rate Limit Errors

**Error:** "GitHub API rate limit exceeded"

**Cause:** `VITE_GITHUB_TOKEN` not configured properly

**Solution:**
1. Check Vercel → Settings → Environment Variables
2. Ensure `VITE_GITHUB_TOKEN` exists and has your token
3. Redeploy without cache
4. Test token validity:
   ```bash
   curl -H "Authorization: Bearer ghp_your_token" https://api.github.com/user
   ```

### Login Not Working

**Issue:** Can't authenticate

**Solutions:**
- Clear browser cache and cookies
- Verify credentials: `iic_admin` / `iicbicepadminpassword`
- Check browser console (F12) for errors
- Ensure JavaScript is enabled
- Try incognito/private browsing mode

### Gemini API Errors

**Error:** "Rate limit exceeded on all available keys"

**Solutions:**
- Add multiple Gemini API keys via UI
- Wait 1 minute for rate limit reset
- Check key validity at https://aistudio.google.com/apikey
- Verify key has Gemini API enabled

### Environment Variables Not Loading

**Issue:** Token not available in app

**Check:**
1. Variable name must start with `VITE_` prefix
2. Redeploy after adding environment variables
3. Clear build cache during redeploy
4. Check browser console for `import.meta.env.VITE_GITHUB_TOKEN`

---

## 🔄 Continuous Deployment

Vercel automatically deploys when you push to GitHub:

```bash
# Make changes locally
cd static_code_reviewer
# ... edit files ...

# Commit and push
git add .
git commit -m "feat: add new feature"
git push origin main

# Vercel automatically:
# 1. Detects push to main branch
# 2. Runs build
# 3. Deploys to production
# 4. Updates your live site
```

### Branch Previews

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and push
git add .
git commit -m "work in progress"
git push origin feature/new-feature

# Vercel creates preview deployment
# Get unique URL for testing before merging
```

---

## 🔒 Security Best Practices

### ⚠️ Critical Warnings:

1. **Client-Side Authentication:**
   - Current auth is NOT secure for public production
   - Credentials visible in source code
   - Suitable for internal/demo use only
   - See SECURITY.md for details

2. **API Keys:**
   - GitHub token exposed to client (acceptable for read-only)
   - Gemini keys in LocalStorage (not ideal)
   - For production, implement backend API proxy

3. **Rate Limits:**
   - GitHub: 5,000 requests/hour (with token)
   - Gemini: Check your quota
   - Add multiple keys for higher limits

### Production Recommendations:

```
For production deployment, implement:

1. Backend API Proxy
   ├─ Next.js API routes
   ├─ Server-side API keys
   └─ Request validation

2. Real Authentication
   ├─ Database-backed users
   ├─ Hashed passwords
   └─ Server-validated JWT

3. Security Headers
   ├─ CSP (Content Security Policy)
   ├─ CORS configuration
   └─ Rate limiting

4. Monitoring
   ├─ Error tracking (Sentry)
   ├─ Performance monitoring
   └─ Usage analytics
```

See **SECURITY.md** for comprehensive security documentation.

---

## 📊 Monitoring & Analytics

### Vercel Analytics

Enable in dashboard:
- Go to Project → Analytics
- Free tier: 2,500 events/month
- Tracks: Page views, performance, errors

### Check Logs

```bash
# View deployment logs
vercel logs

# View function logs (if using API routes)
vercel logs --follow
```

### Monitor Usage

- **GitHub API:** Check rate limit: https://api.github.com/rate_limit
- **Gemini API:** Check quota: https://aistudio.google.com/

---

## 🚀 Post-Deployment

### Your App is Live! 🎉

**Access URL:** `https://your-project-name.vercel.app`

### Share with Team:

```
App URL: https://your-project-name.vercel.app

Login Credentials:
- Username: iic_admin
- Password: iicbicepadminpassword

Instructions:
1. Visit the URL
2. Login with credentials above
3. Add your Gemini API key (click key icon in sidebar)
4. Paste a GitHub repository URL
5. Click "Analyze" to review the code
```

### Update Process:

```bash
# Make changes
git add .
git commit -m "update: description"
git push

# Vercel auto-deploys
# Check deployment status in dashboard
```

---

## 📞 Support & Resources

- **Repository:** https://github.com/srisha6505/static-git-code-review
- **Issues:** https://github.com/srisha6505/static-git-code-review/issues
- **Vercel Docs:** https://vercel.com/docs
- **Vite Docs:** https://vitejs.dev/guide/

### Documentation:
- `README.md` - Project overview and local setup
- `SECURITY.md` - Security warnings and best practices
- `DEPLOYMENT.md` - This file

---

## ✅ Deployment Complete!

Your Static Code Reviewer is now live and ready to use! 🚀

### Next Steps:
1. ✅ Share URL with your team
2. ✅ Add Gemini API keys
3. ✅ Test all functionality
4. ✅ Monitor usage and errors
5. 📖 Review SECURITY.md before public use
6. 🔐 Consider adding authentication proxy for production

Enjoy reviewing code with AI! 🎯