# BlackCoffe Deployment Guide

## Overview
This is a full-stack application with:
- **Backend**: Express.js server (serves API + static frontend)
- **Frontend**: React + Vite (built and served by backend in production)
- **Database**: MySQL on DigitalOcean

## Deployment Configuration

### 1. Backend Deployment (Render.com)

**Service Type**: Web Service

**Build Command**:
```bash
npm install && npm run build
```

**Start Command**:
```bash
npm start
```

**Environment Variables** (Set in Render dashboard):
```
PORT=25060
```
*Note: The database credentials are already in `server/db.js`. For better security, consider moving them to environment variables.*

**Important Settings**:
- **Auto-Deploy**: Enable (deploys on git push)
- **Branch**: main
- **Root Directory**: Leave empty (uses repository root)

### 2. Frontend Configuration

The frontend is already configured to connect to your deployed backend:
- Production API: `https://coffeserver.onrender.com`
- Local development: `http://localhost:25060`

**No separate frontend deployment needed** - the backend serves the built frontend from `client/dist`.

### 3. Build Process

When you deploy, Render will:
1. Run `npm install` (installs backend dependencies)
2. Run `npm run build` (installs frontend dependencies and builds React app)
3. Run `npm start` (starts Express server on PORT 25060)
4. Express serves built frontend from `client/dist` + API routes

## Local Development

### Start Backend:
```bash
npm run dev
```
Backend runs on: http://localhost:25060

### Start Frontend (separate terminal):
```bash
cd client
npm run dev
```
Frontend runs on: http://localhost:5173

## Deployment Checklist

- [x] Backend `PORT` uses environment variable
- [x] Frontend API URL configured correctly (no `localhost` in production)
- [x] `package.json` has `start` and `build` scripts
- [x] `.gitignore` excludes `node_modules` and `dist`
- [ ] Database credentials moved to environment variables (recommended for security)

## Common Issues

### Issue: Frontend shows "ERR_CONNECTION_REFUSED"
**Cause**: Frontend trying to connect to `localhost` instead of deployed backend
**Solution**: Already fixed - `config.js` now uses `https://coffeserver.onrender.com`

### Issue: "Cannot GET /api/..." errors
**Cause**: Frontend not built or backend not serving static files
**Solution**: Run `npm run build` before deploying

### Issue: Database connection errors
**Cause**: Database credentials incorrect or database not accessible
**Solution**: Verify credentials in `server/db.js` or environment variables

## Render Deployment URL
Your backend should be deployed at: **https://coffeserver.onrender.com**

This URL serves both:
- API routes: `/orders`, `/clients`, `/products`, etc.
- Built React frontend: All other routes serve `index.html`

## Next Steps (Optional Security Improvements)

1. **Move database credentials to environment variables**:
   - Create `.env` file (already in `.gitignore`)
   - Update `server/db.js` to use `process.env` variables
   - Set environment variables in Render dashboard

2. **Add CORS configuration**:
   - Restrict CORS to only allow your frontend domain

3. **Enable HTTPS redirect** (Render does this automatically)
