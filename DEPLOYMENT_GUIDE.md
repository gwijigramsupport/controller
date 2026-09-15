# Deployment Guide: Supabase + Vercel

This project is optimized for **Supabase (PostgreSQL Backend)** + **Vercel (Frontend & API Server)** deployment.

## 📋 Prerequisites

- [Supabase Account](https://supabase.com)
- [Vercel Account](https://vercel.com)
- [pnpm](https://pnpm.io) installed locally
- Git repository connected to Vercel

---

## 🗄️ Step 1: Set Up Supabase Backend

### 1.1 Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"** and fill in the details:
   - **Project name**: `whatsapp-saas` (or your preferred name)
   - **Database password**: Create a strong password (save this!)
   - **Region**: Choose closest to your users
3. Wait for the project to be ready

### 1.2 Get Your Database Connection String
1. Go to **Settings → Database → Connection String**
2. Copy the **Connection pooler** string (NOT the "Session pooler")
   - It looks like: `postgresql://postgres.XXXXX:password@aws-0-region.pooler.supabase.com:6543/postgres`
3. Replace `[YOUR-PASSWORD]` in the string with your actual database password
4. **Save this string securely** — you'll need it for Vercel

### 1.3 Push Your Database Schema
Before deploying, ensure your schema is created:

```bash
# Set your Supabase connection string locally
export DATABASE_URL="postgresql://postgres.XXXXX:password@aws-0-region.pooler.supabase.com:6543/postgres"

# Push the schema to Supabase
pnpm --filter @workspace/db run push
```

This creates the tables:
- `whatsapp_sessions` — WhatsApp account data
- `activity_events` — Session activity logs

---

## 🚀 Step 2: Deploy Backend (API Server) to Vercel

### 2.1 Create a Vercel Project for the Backend

**Option A: From Vercel Dashboard**
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Select **Framework Preset**: `Other`
4. In **Root Directory**, set to: `artifacts/api-server`
5. Click **Deploy**

**Option B: Using Vercel CLI**
```bash
vercel --prod
```

### 2.2 Set Environment Variables on Vercel
1. Go to your Vercel project **Settings → Environment Variables**
2. Add these variables:

| Variable | Value | Source |
|----------|-------|--------|
| `DATABASE_URL` | Your Supabase connection string | From Step 1.2 |
| `CLERK_PUBLISHABLE_KEY` | Your Clerk key | [Clerk Dashboard](https://clerk.com) |
| `CLERK_SECRET_KEY` | Your Clerk secret | Clerk Dashboard |
| `NODE_ENV` | `production` | Manual |
| `PORT` | `3001` | Manual (Vercel uses this internally) |

### 2.3 Redeploy
1. Commit your `.env.example` changes to GitHub
2. Vercel automatically redeploys on push
3. Check deployment at: `https://your-project.vercel.app/api/health`

---

## 🎨 Step 3: Deploy Frontend to Vercel (Separate Project)

### 3.1 Create a Separate Vercel Project for Frontend

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository again
3. Select **Framework Preset**: `Vite`
4. In **Root Directory**, set to: `artifacts/whatsapp-saas`
5. Click **Deploy**

### 3.2 Set Frontend Environment Variables
1. Go to Vercel **Settings → Environment Variables**
2. Add:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://your-api-project.vercel.app` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Your Clerk publishable key |

### 3.3 Update API Connection in Code
Ensure `artifacts/whatsapp-saas/src` uses the environment variable:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
```

---

## 📊 Step 4: Verify Everything Works

### Test the Backend
```bash
curl https://your-api-project.vercel.app/api/health
```

### Test the Frontend
Visit: `https://your-frontend-project.vercel.app`

### Check Logs
- **Vercel Backend Logs**: Vercel Dashboard → Deployments → Runtime Logs
- **Supabase Logs**: Supabase Dashboard → Database → Query Performance

---

## 🔧 Local Development (Before Pushing)

```bash
# Set your local Supabase connection
export DATABASE_URL="postgresql://..."

# Start the API server (port 5000)
pnpm --filter @workspace/api-server run dev

# In a new terminal, start the frontend (port 5173)
pnpm --filter @workspace/whatsapp-saas run dev
```

---

## 🚨 Troubleshooting

### "DATABASE_URL is not set" Error
- Verify the environment variable is set in Vercel
- Check that the connection string format is correct (must have password)

### "Cannot reach API from Frontend"
- Verify `VITE_API_URL` is set correctly in frontend env vars
- Check CORS settings in backend (`artifacts/api-server/src/app.ts`)
- Ensure backend is deployed and healthy

### Supabase Connection Timeout
- Use **Connection pooler** (NOT Session pooler)
- Verify your database password is correct
- Check firewall rules in Supabase

---

## 📝 Summary

| Component | Platform | Root Directory |
|-----------|----------|-----------------|
| **Database** | Supabase (PostgreSQL) | N/A |
| **API Server** | Vercel | `artifacts/api-server` |
| **Frontend** | Vercel | `artifacts/whatsapp-saas` |

Once deployed, your architecture looks like:
```
Vercel Frontend → Vercel API Server → Supabase Database
```

---

## 🔐 Security Notes

- **Never commit `.env`** to GitHub (it's in `.gitignore`)
- Use `.env.example` to document required variables
- Rotate your Supabase password periodically
- Use environment variables for all secrets in Vercel

---

## 🆘 Need Help?

- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Clerk Docs](https://clerk.com/docs)
