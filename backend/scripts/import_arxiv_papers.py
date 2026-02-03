#!/usr/bin/env python3
"""
Import arXiv math papers from papers/arxiv_math/ directory into PaperAnchor table.

Usage:
    python backend/scripts/import_arxiv_papers.py

The script:
1. Reads metadata from papers/arxiv_math/metadata_all.jsonl
2. Creates PaperAnchor records in database
3. Links PDFs from local filesystem
4. ArXiv papers have no review scores (null values)
"""

import asyncio
import json
from pathlib import Path
from typing import Optional

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.paper_anchor import PaperAnchor
from app.database import get_db


async def import_arxiv_papers(
    metadata_path: str,
    papers_base_dir: str,
    limit: Optional[int] = None,
    skip_existing: bool = True,
):
    """
    Import arXiv papers from metadata JSONL file.

    Args:
        metadata_path: Path to metadata_all.jsonl
        papers_base_dir: Base directory containing arxiv_math folder
        limit: Max number of papers to import (for testing)
        skip_existing: Skip papers already in database
    """
    metadata_file = Path(metadata_path)
    papers_dir = Path(papers_base_dir)

    if not metadata_file.exists():
        print(f"[ERROR] Metadata file not found: {metadata_file}")
        return

    # Count total papers
    total_count = sum(1 for _ in metadata_file.open())
    print(f"Found {total_count} papers in metadata")

    if limit:
        print(f"Limiting import to {limit} papers")

    # Get database session
    async for db in get_db():
        created_count = 0
        skipped_count = 0
        error_count = 0

        with metadata_file.open() as f:
            for idx, line in enumerate(f):
                if limit and idx >= limit:
                    break

                if idx % 10 == 0:
                    print(f"Progress: {idx}/{min(limit or total_count, total_count)} papers processed")

                try:
                    meta = json.loads(line)

                    # Extract fields
                    arxiv_id = meta.get("id", "")
                    title = meta.get("title", "")
                    authors = meta.get("authors", [])
                    summary = meta.get("summary", "")
                    categories = meta.get("categories", [])
                    published = meta.get("published")
                    pdf_url = meta.get("pdf_url", "")
                    local_pdf = meta.get("local_pdf", "")

                    # Generate unique identifier from arxiv_id
                    # Format: "2601.23247v1" -> "arxiv_2601_23247v1"
                    paper_id = f"arxiv_{arxiv_id.replace('.', '_').replace('-', '_')}"

                    # Check if already exists
                    if skip_existing:
                        existing = await db.execute(
                            select(PaperAnchor).where(PaperAnchor.paper_id == paper_id)
                        )
                        if existing.scalar_one_or_none():
                            skipped_count += 1
                            continue

                    # Extract year from published date
                    year = None
                    if published:
                        try:
                            year = int(published[:4])
                        except (ValueError, TypeError):
                            pass

                    # Resolve local PDF path
                    pdf_path = None
                    if local_pdf:
                        # local_pdf is relative like "arxiv_math/math.AC/pdf/2601.23247v1__..."
                        full_path = papers_dir / local_pdf
                        if full_path.exists():
                            pdf_path = str(full_path)
                        else:
                            # Try alternative path structure
                            alt_path = papers_dir / local_pdf.split("/", 1)[1] if "/" in local_pdf else Path(local_pdf).name
                            if alt_path.exists():
                                pdf_path = str(alt_path)

                    # Create PaperAnchor
                    # ArXiv papers have no review scores - use default values
                    paper = PaperAnchor(
                        paper_id=paper_id,
                        title=title,
                        abstract=summary,
                        venue=f"arXiv {categories[0]}" if categories else "arXiv",
                        year=year,
                        # Use categories as tags
                        tags=categories,
                        # No review scores for arXiv papers
                        avg_score=0.0,
                        review_count=0,
                        highest_score=0.0,
                        lowest_score=0.0,
                        score10=5.0,
                        dispersion10=0.0,
                        weight=1.0,
                        # Store extra metadata
                        extra_data={
                            "authors": authors,
                            "arxiv_id": arxiv_id,
                            "pdf_url": pdf_url,
                            "pdf_path": pdf_path,
                            "categories": categories,
                            "published": published,
                            "doi": meta.get("doi"),
                            "journal_ref": meta.get("journal_ref"),
                            "entry_id": meta.get("entry_id"),
                        }
                    )

                    db.add(paper)
                    created_count += 1

                    # Commit every 50 papers to avoid large transactions
                    if created_count % 50 == 0:
                        await db.commit()

                except json.JSONDecodeError as e:
                    print(f"[ERROR] JSON decode error at line {idx}: {e}")
                    error_count += 1
                    await db.rollback()
                except Exception as e:
                    print(f"[ERROR] Error processing paper at line {idx}: {e}")
                    error_count += 1
                    await db.rollback()

        # Final commit
        await db.commit()

        print(f"\n=== Import Complete ===")
        print(f"Created: {created_count} papers")
        print(f"Skipped: {skipped_count} papers (already exists)")
        print(f"Errors:  {error_count} papers")


async def check_existing_stats():
    """Show statistics of existing PaperAnchors in database."""
    async for db in get_db():
        result = await db.execute(select(PaperAnchor))
        papers = result.scalars().all()

        print(f"\n=== Existing PaperAnchors ===")
        print(f"Total: {len(papers)}")

        if papers:
            # Count by venue
            venues = {}
            for p in papers:
                v = p.venue or "Unknown"
                venues[v] = venues.get(v, 0) + 1

            print(f"\nBy venue:")
            for venue, count in sorted(venues.items(), key=lambda x: -x[1])[:10]:
                print(f"  {venue}: {count}")

            # Count with review scores (review_count > 0 means has reviews)
            with_scores = sum(1 for p in papers if p.review_count > 0)
            print(f"\nWith review scores: {with_scores}")
            print(f"Without review scores: {len(papers) - with_scores}")


async def main():
    import argparse

    parser = argparse.ArgumentParser(description="Import arXiv papers into PaperAnchor table")
    parser.add_argument(
        "--metadata",
        type=str,
        default="papers/arxiv_math/metadata_all.jsonl",
        help="Path to metadata JSONL file"
    )
    parser.add_argument(
        "--papers-dir",
        type=str,
        default="papers",
        help="Base directory containing papers folder"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit import to N papers (for testing)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Import all papers including duplicates"
    )
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Show existing statistics only"
    )

    args = parser.parse_args()

    # Resolve paths relative to project root
    project_root = Path(__file__).parent.parent.parent
    metadata_path = project_root / args.metadata
    papers_dir = project_root / args.papers_dir

    if args.stats:
        await check_existing_stats()
        return

    print(f"Importing from: {metadata_path}")
    print(f"Papers directory: {papers_dir}")

    await import_arxiv_papers(
        metadata_path=str(metadata_path),
        papers_base_dir=str(papers_dir),
        limit=args.limit,
        skip_existing=not args.force,
    )

    # Show stats after import
    await check_existing_stats()


if __name__ == "__main__":
    asyncio.run(main())
