import asyncio
import os
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.latex_ai import LatexAIRun
from app.config import get_settings

# Setup async DB connection
settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def check_runs():
    async with AsyncSessionLocal() as db:
        # Count runs by status
        result = await db.execute(select(LatexAIRun.status, func.count(LatexAIRun.id)).group_by(LatexAIRun.status))
        counts = result.all()
        
        print("\n--- Run Status Counts ---")
        for status, count in counts:
            print(f"Status '{status}': {count}")
            
        # Show a few pending runs
        query = select(LatexAIRun).where(LatexAIRun.status == 'pending').limit(5)
        result = await db.execute(query)
        runs = result. scalars().all()
        
        print("\n--- Sample Pending Runs ---")
        for run in runs:
            print(f"ID: {run.id}, Created: {run.created_at}, Summary: {run.summary}")

if __name__ == "__main__":
    asyncio.run(check_runs())
