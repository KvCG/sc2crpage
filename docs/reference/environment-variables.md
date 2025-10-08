# Environment Variables Reference

> **Complete configuration guide** for SC2CR server environment variables

## 🎯 Quick Reference

### Essential Variables
```bash
# Minimal setup for local development
PORT=3000
LOG_LEVEL=info
```

### Full Configuration
```bash
# Copy this template to your .env file and customize
# Server Configuration
PORT=3000
LOG_LEVEL=info
LOG_HTTP_SUCCESS=false

# External API Keys
CHALLONGE_API_KEY=your_challonge_key_here
CURRENT_TOURNAMENT=your_tournament_id
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
REPLAY_ANALYZER_URL=https://your-replay-analyzer.com

# Feature Flags
ENABLE_PLAYER_ANALYTICS=true
ENABLE_DATA_SNAPSHOTS=true
ENABLE_PLAYER_SNAPSHOTS=true
ENABLE_BARCODE_HELPER=false

# Game Configuration  
MMR_RANGE_FOR_PREMIER_MATCH=200
MMR_RANGE_FOR_CLOSE_MATCH=100
RANKING_MIN_GAMES=10

# Analytics Configuration
DATA_SNAPSHOT_INTERVAL_HOURS=24
PLAYER_SNAPSHOT_INTERVAL_HOURS=24
PLAYER_ACTIVITY_INTERVAL_HOURS=2
PLAYER_MOVERS_INTERVAL_HOURS=6
ANALYTICS_CACHE_TTL_MS=300000
DEFAULT_MINIMUM_CONFIDENCE=75
MAX_DATA_AGE_HOURS=48

# Performance & Rate Limiting
SC2PULSE_RPS=10
ONLINE_THRESHOLD_MINUTES=30

# Custom Match Ingestion (H2H System)
H2H_CUSTOM_CUTOFF=2024-01-01
H2H_CUSTOM_MIN_CONFIDENCE=low
H2H_CUSTOM_POLL_INTERVAL_SEC=900
H2H_BATCH_SIZE=50
H2H_LOOKBACK_DAYS=7
H2H_DEDUPE_RETENTION_HOURS=48
H2H_MAX_MATCHES_PER_FILE=1000
H2H_MAX_CONCURRENT=5
H2H_DEDUPE_CACHE_LIMIT=10000
ONLINE_THRESHOLD_HOURS=24
```

---

## 📋 Variable Categories

### 🖥️ Server Configuration

#### `PORT`
- **Purpose**: HTTP server listening port
- **Default**: `3000`
- **Example**: `PORT=3000`
- **Notes**: Must match frontend proxy configuration

#### `LOG_LEVEL`
- **Purpose**: Logging verbosity level
- **Default**: `info`
- **Options**: `debug`, `info`, `warn`, `error`
- **Example**: `LOG_LEVEL=debug`
- **Notes**: Use `debug` for development, `info` for production

#### `LOG_HTTP_SUCCESS`
- **Purpose**: Log successful HTTP requests (2xx/3xx status codes)
- **Default**: `false`
- **Type**: Boolean
- **Example**: `LOG_HTTP_SUCCESS=true`
- **Notes**: Reduces log noise in production when `false`

---

### 🔑 External API Configuration

#### `CHALLONGE_API_KEY`
- **Purpose**: Challonge tournament API authentication
- **Required**: For tournament features
- **Format**: API key string
- **Example**: `CHALLONGE_API_KEY=abc123xyz789`
- **Obtain**: [Challonge Developer Settings](https://challonge.com/settings/developer)

#### `CURRENT_TOURNAMENT`
- **Purpose**: Active tournament ID for current season
- **Required**: For tournament integration
- **Format**: Challonge tournament ID
- **Example**: `CURRENT_TOURNAMENT=sc2cr2024`
- **Notes**: Changes per tournament season

#### `GOOGLE_SERVICE_ACCOUNT_KEY`
- **Purpose**: Google Drive API service account credentials
- **Required**: For data auto-download and replay storage
- **Format**: JSON string (entire service account key file)
- **Example**: `GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}`
- **Security**: Keep this secure and never commit to version control
- **Setup**: 
  1. Create Google Cloud Project
  2. Enable Google Drive API  
  3. Create Service Account
  4. Generate and download JSON key
  5. Share Google Drive folders with service account email

#### `REPLAY_ANALYZER_URL`
- **Purpose**: External replay analysis service endpoint
- **Required**: For replay analysis features
- **Format**: Full URL to replay analyzer API
- **Example**: `REPLAY_ANALYZER_URL=https://replay-analyzer.example.com`
- **Notes**: Must support SC2CR replay format expectations

---

### 🚩 Feature Flags

#### `ENABLE_PLAYER_ANALYTICS`
- **Purpose**: Enable advanced player analytics and statistics
- **Default**: `false`
- **Type**: Boolean
- **Example**: `ENABLE_PLAYER_ANALYTICS=true`
- **Features**: Historical player performance, trend analysis, predictions
- **Dependencies**: Requires `GOOGLE_SERVICE_ACCOUNT_KEY` for analytics storage

#### `ENABLE_DATA_SNAPSHOTS`
- **Purpose**: Enable background data collection and snapshots
- **Default**: `false`  
- **Type**: Boolean
- **Example**: `ENABLE_DATA_SNAPSHOTS=true`
- **Features**: Daily ranking snapshots, position change tracking
- **Dependencies**: Works with analytics for historical data

#### `ENABLE_BARCODE_HELPER`
- **Purpose**: Enable barcode generation utilities
- **Default**: `false`
- **Type**: Boolean  
- **Example**: `ENABLE_BARCODE_HELPER=false`
- **Features**: QR codes for tournament check-ins, player identification
- **Status**: Experimental feature

---

### 🎮 Game Configuration

#### `MMR_RANGE_FOR_PREMIER_MATCH`
- **Purpose**: MMR difference threshold for "premier" match classification
- **Default**: `200`
- **Type**: Integer (MMR points)
- **Example**: `MMR_RANGE_FOR_PREMIER_MATCH=200`
- **Usage**: Matches with MMR difference ≤ this value are marked as premier matches

#### `MMR_RANGE_FOR_CLOSE_MATCH`
- **Purpose**: MMR difference threshold for "close" match classification  
- **Default**: `100`
- **Type**: Integer (MMR points)
- **Example**: `MMR_RANGE_FOR_CLOSE_MATCH=100`
- **Usage**: Matches with MMR difference ≤ this value are marked as close matches

#### `RANKING_MIN_GAMES`
- **Purpose**: Minimum games required to appear in public rankings
- **Default**: `10`
- **Type**: Integer (number of games)
- **Example**: `RANKING_MIN_GAMES=10`
- **Usage**: Players with fewer games are filtered from ranking displays

---

### 📊 Analytics Configuration

These variables only apply when `ENABLE_PLAYER_ANALYTICS=true`:

#### `DATA_SNAPSHOT_INTERVAL_HOURS`
- **Purpose**: Interval between automatic data snapshots
- **Default**: `24`
- **Type**: Integer (hours)
- **Example**: `DATA_SNAPSHOT_INTERVAL_HOURS=24`
- **Usage**: Background job creates snapshots every N hours
- **Notes**: Shorter intervals provide more data points but increase storage

#### `ANALYTICS_CACHE_TTL_MS`
- **Purpose**: Cache TTL for analytics calculations
- **Default**: `300000` (5 minutes)
- **Type**: Integer (milliseconds)
- **Example**: `ANALYTICS_CACHE_TTL_MS=300000`
- **Usage**: How long analytics results stay cached
- **Performance**: Longer TTL improves performance, shorter TTL provides fresher data

#### `DEFAULT_MINIMUM_CONFIDENCE`
- **Purpose**: Minimum confidence threshold for analytics results
- **Default**: `75`
- **Type**: Integer (percentage 0-100)
- **Example**: `DEFAULT_MINIMUM_CONFIDENCE=75`
- **Usage**: Analytics with confidence below this threshold are not displayed
- **Quality**: Higher values show only high-confidence predictions

#### `MAX_DATA_AGE_HOURS`
- **Purpose**: Maximum age of data used in analytics calculations
- **Default**: `48`
- **Type**: Integer (hours)
- **Example**: `MAX_DATA_AGE_HOURS=48`
- **Usage**: Data older than this is excluded from analytics
- **Relevance**: Shorter periods focus on recent performance trends

### 🎮 Custom Match Ingestion (H2H)

Custom Head-to-Head match discovery and processing system configuration.

#### `H2H_CUSTOM_CUTOFF`
- **Purpose**: Earliest date for custom match processing
- **Default**: `2024-01-01`
- **Type**: String (YYYY-MM-DD format)
- **Example**: `H2H_CUSTOM_CUTOFF=2024-01-01`
- **Usage**: Only matches after this date are processed
- **Performance**: Later cutoff dates reduce processing load

#### `H2H_CUSTOM_MIN_CONFIDENCE`
- **Purpose**: Minimum confidence level for storing matches
- **Default**: `low`
- **Type**: String (`low`, `medium`, `high`)
- **Example**: `H2H_CUSTOM_MIN_CONFIDENCE=medium`
- **Usage**: Filters out low-quality matches
- **Quality**: Higher thresholds ensure better match quality

#### `H2H_CUSTOM_POLL_INTERVAL_SEC`
- **Purpose**: Automatic ingestion polling interval
- **Default**: `900` (15 minutes)
- **Type**: Integer (seconds)
- **Example**: `H2H_CUSTOM_POLL_INTERVAL_SEC=1800`
- **Usage**: How often the system checks for new matches
- **Performance**: Longer intervals reduce API load

#### `H2H_BATCH_SIZE`
- **Purpose**: Maximum matches processed per batch
- **Default**: `50`
- **Type**: Integer
- **Example**: `H2H_BATCH_SIZE=100`
- **Usage**: Controls memory usage and processing speed
- **Performance**: Larger batches are faster but use more memory

#### `H2H_LOOKBACK_DAYS`
- **Purpose**: Days to search back for new matches
- **Default**: `7`
- **Type**: Integer
- **Example**: `H2H_LOOKBACK_DAYS=3`
- **Usage**: How far back to search for matches each cycle
- **Performance**: Shorter lookback reduces API calls

#### `H2H_DEDUPE_RETENTION_HOURS`
- **Purpose**: Hours to retain de-duplication tracking files
- **Default**: `48`
- **Type**: Integer
- **Example**: `H2H_DEDUPE_RETENTION_HOURS=72`
- **Usage**: Prevents reprocessing the same matches
- **Storage**: Longer retention uses more disk space

#### `H2H_MAX_MATCHES_PER_FILE`
- **Purpose**: Maximum matches per storage file
- **Default**: `1000`
- **Type**: Integer
- **Example**: `H2H_MAX_MATCHES_PER_FILE=500`
- **Usage**: Controls individual file size
- **Performance**: Smaller files are easier to process

---

## 🌍 Environment-Specific Configuration

### Local Development
```bash
# .env (local development)
PORT=3000
LOG_LEVEL=debug
LOG_HTTP_SUCCESS=true

# Optional - add API keys only if testing related features
# CHALLONGE_API_KEY=your_key_here
# GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### Development Environment (Fly.io)
```bash
# Environment variables set via Fly.io dashboard or CLI
PORT=3000
LOG_LEVEL=info
LOG_HTTP_SUCCESS=false

CHALLONGE_API_KEY=${CHALLONGE_API_KEY}
CURRENT_TOURNAMENT=${CURRENT_TOURNAMENT_DEV}
GOOGLE_SERVICE_ACCOUNT_KEY=${GOOGLE_SERVICE_ACCOUNT_KEY}

ENABLE_PLAYER_ANALYTICS=true
ENABLE_DATA_SNAPSHOTS=true
```

### Production Environment (Render)
```bash
# Environment variables set via Render dashboard
PORT=3000
LOG_LEVEL=info
LOG_HTTP_SUCCESS=false

CHALLONGE_API_KEY=${CHALLONGE_API_KEY}
CURRENT_TOURNAMENT=${CURRENT_TOURNAMENT_PROD}
GOOGLE_SERVICE_ACCOUNT_KEY=${GOOGLE_SERVICE_ACCOUNT_KEY}
REPLAY_ANALYZER_URL=${REPLAY_ANALYZER_URL}

ENABLE_PLAYER_ANALYTICS=true
ENABLE_DATA_SNAPSHOTS=true
ENABLE_BARCODE_HELPER=false

MMR_RANGE_FOR_PREMIER_MATCH=200
MMR_RANGE_FOR_CLOSE_MATCH=100
RANKING_MIN_GAMES=10

DATA_SNAPSHOT_INTERVAL_HOURS=24
ANALYTICS_CACHE_TTL_MS=300000
DEFAULT_MINIMUM_CONFIDENCE=80
MAX_DATA_AGE_HOURS=48
```

---

## 🔧 Configuration Management

### Setting Environment Variables

#### Local Development (.env file)
```bash
# Create .env file in project root
cat > .env << 'EOF'
PORT=3000
LOG_LEVEL=debug
# Add other variables as needed
EOF
```

#### Fly.io (Development)
```bash
# Set via CLI
fly secrets set PORT=3000 LOG_LEVEL=info

# Set via fly.toml
[env]
  PORT = "3000"
  LOG_LEVEL = "info"
```

#### Render (Production)  
```bash
# Set via Render dashboard:
# Dashboard > Service > Environment tab > Add Environment Variable
```

### Validation and Defaults

The server validates environment variables on startup:

```typescript
// Server validates configuration
const config = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  logLevel: process.env.LOG_LEVEL || 'info',
  enableAnalytics: process.env.ENABLE_PLAYER_ANALYTICS === 'true',
  // ... other validations
}

// Startup validation
if (config.enableAnalytics && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  logger.warn('Analytics enabled but no Google service account configured')
}
```

### Security Best Practices

#### ✅ Do
- Use environment variables for all secrets and configuration
- Set different values per environment (dev/staging/prod)
- Use service account keys instead of personal credentials
- Rotate API keys regularly
- Validate configuration on startup

#### ❌ Don't
- Commit API keys or secrets to version control
- Use the same API keys across environments
- Put sensitive data in client-side code
- Share service account keys via insecure channels
- Use default passwords or keys in production

---

## 🔍 Debugging Configuration

### Check Current Configuration
```bash
# Debug endpoint shows non-sensitive config
curl http://localhost:3000/api/debug?type=config

# Response includes:
{
  "environment": "development",
  "features": {
    "analytics": true,
    "snapshots": true,
    "barcodeHelper": false
  },
  "limits": {
    "mmrPremier": 200,
    "mmrClose": 100,
    "minGames": 10
  }
}
```

### Environment Variable Checklist
```bash
# Verify variables are loaded
node -e "console.log('PORT:', process.env.PORT)"
node -e "console.log('LOG_LEVEL:', process.env.LOG_LEVEL)"

# Check server startup logs for configuration warnings
npm run dev
# Look for: "Configuration loaded" or warning messages
```

### Common Configuration Issues

1. **Variables not loading**: Ensure `.env` file is in project root
2. **Boolean values**: Use `"true"`/`"false"` strings, not actual booleans  
3. **JSON formatting**: Ensure `GOOGLE_SERVICE_ACCOUNT_KEY` is valid JSON string
4. **Port conflicts**: Ensure `PORT` doesn't conflict with other services
5. **API key format**: Verify API keys match expected format for each service

---

## 🔗 Related Documentation

- [**Development Setup**](../development/setup.md) - Local environment configuration
- [**External APIs**](external-apis.md) - API key setup and integration details  
- [**Configuration Guide**](configuration.md) - Advanced configuration options
- [**Architecture Overview**](../architecture/README.md) - System design and data flow

---

*Last updated: October 2025 | [Improve this reference](https://github.com/KvCG/sc2crpage/edit/dev/docs/reference/environment-variables.md)*