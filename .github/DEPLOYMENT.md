# SC2CR Deployment Integration

## Overview

This document details how our branching strategy integrates with our deployment process across Vercel (frontend) and Render (backend).

## Environment Structure

### Development Environments
- **Local**: Running locally for development
- **Preview**: Per-PR deployments (Vercel + Render)
- **Staging**: Integration environment (develop branch)
- **Production**: Live environment (main branch)

## Deployment Process

### Preview Deployments

1. **Backend (Render)**
   - Triggered by PR creation
   - Deploys to unique preview URL
   - Environment variables from Render preview context
   - Useful for testing API changes in isolation

2. **Frontend (Vercel)**
   - Automatic preview deployment per PR
   - Uses preview backend URL
   - Perfect for UI review and testing

### Staging Deployments

1. **Backend (Render)**
   - Deploys from `develop` branch
   - Staging environment configuration
   - Used for integration testing

2. **Frontend (Vercel)**
   - Deploys from `develop` branch
   - Points to staging backend
   - Used for QA and feature validation

### Production Deployment

#### Normal Releases

1. **Prepare Release**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/1.x.x
   # Final testing and fixes
   ```

2. **Server Deployment**
   - Merge to main
   - Automatic deployment to Render
   - Run health checks
   - Verify API endpoints

3. **Client Deployment**
   - After server verification
   - Deploy to Vercel production
   - Monitor error rates
   - Verify key user flows

#### Hotfix Deployments

1. **Server Hotfix**
   ```bash
   git checkout main
   git checkout -b hotfix/api-fix
   # Make server fixes
   ```
   - Emergency deploy to Render
   - Verify fix in production

2. **Client Hotfix**
   ```bash
   git checkout main
   git checkout -b hotfix/client-fix
   # Make client fixes
   ```
   - Deploy to Vercel after server fix
   - Monitor for issues

## Deployment Verification

### Server Deployment Checks
- Health endpoint monitoring
- API response times
- Error rates
- Database connections
- Cache operation

### Client Deployment Checks
- Build success
- Asset delivery
- API connectivity
- User flows
- Error tracking

## Rollback Procedures

### Server Rollback
```bash
# Identify last stable version
git tag -l
git checkout v1.2.3
# Deploy previous version
```

### Client Rollback
- Use Vercel dashboard
- Instant revert to previous deployment
- Verify client-server compatibility

## Monitoring & Alerts

### Server Monitoring
- Render dashboard metrics
- Custom health checks
- Error tracking
- Performance monitoring

### Client Monitoring
- Vercel Analytics
- Error tracking
- User session monitoring
- Performance metrics

## Deployment Commands

### Development
```bash
# Start local development
npm run dev  # Runs both client and server

# Build for deployment
npm run build  # Builds both client and server
```

### Production
```bash
# Build server
npm run build:server

# Build client
npm run build:client

# Start production server
npm run start
```