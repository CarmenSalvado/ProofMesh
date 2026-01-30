import asyncio
import os
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.latex_ai import LatexAIRun
from app.config import get_settings

# Setup async DB connection
settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def reset_runs():
    async with AsyncSessionLocal() as db:
        # Update all pending runs to 'accepted' (or 'archived' - we use accepted so they are history)
        # We assume anything existing before this fix should be cleared
        print("Resetting all 'pending' runs to 'accepted'...")
        
        await db.execute(
            update(LatexAIRun)
            .where(LatexAIRun.status == 'pending')
            .values(status='accepted')
        )
        await db.commit()
        
        print("Done. Verifying...")
        
        # Count again
        result = await db.execute(select(LatexAIRun.status).group_by(LatexAIRun.status))
        # Note: group by usually needs aggregate
        from sqlalchemy import func
        result = await db.execute(select(LatexAIRun.status, func.count(LatexAIRun.id)).group_by(LatexAIRun.status))
        counts = result.all()
        for status, count in counts:
            print(f"Status '{status}': {count}")

if __name__ == "__main__":
    asyncio.run(reset_runs())
