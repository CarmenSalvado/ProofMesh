#!/bin/bash
set -e

echo "🔄 Running database migrations..."

# Wait for database to be ready (extra safety beyond healthcheck)
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check():
    engine = create_async_engine('$DATABASE_URL')
    async with engine.connect() as conn:
        await conn.execute(text('SELECT 1'))
    await engine.dispose()

asyncio.run(check())
" 2>/dev/null; then
        echo "✅ Database is ready"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "⏳ Waiting for database... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Database not ready after $MAX_RETRIES retries"
    exit 1
fi

# Run migrations
echo "🚀 Applying migrations..."
alembic upgrade head

echo "✅ Migrations complete!"

# Setup Lean Project dependencies in background (non-blocking)
# Skip if Lean is delegated to external runner
if [ -z "${LEAN_RUNNER_URL}" ] && [ -d "/app/mesh/mesh_project" ]; then
    echo "🔧 Setting up Lean project in background..."
    (
        cd /app/mesh/mesh_project
        echo "📦 Fetching Mathlib cache (this may take a while)..."
        lake exe cache get || echo "⚠️ Warning: Failed to fetch cache"
    ) &
    echo "✅ Lean setup initiated (running in background)"
else
    echo "⏭️ Skipping Lean setup in backend (LEAN_RUNNER_URL is set)"
fi

# Start the application
echo "🌐 Starting FastAPI server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
