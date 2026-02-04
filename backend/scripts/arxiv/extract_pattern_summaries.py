#!/usr/bin/env python3
"""
Extract pattern summaries using LLM from clustered math papers.

This script:
1. Reads pattern_clusters.jsonl (from cluster_math_papers.py)
2. For each pattern, selects exemplar papers (high score)
3. Uses LLM to extract: representative_ideas, common_problems, solution_approaches, story
4. Outputs math_patterns_full.jsonl

Usage:
    python backend/scripts/extract_pattern_summaries.py --input output_math/pattern_clusters.jsonl
"""

import asyncio
import json
import argparse
import os
from pathlib import Path
from typing import List, Dict, Optional
from collections import Counter, defaultdict

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import Google Gemini
try:
    from google import genai
    from google.genai import types
    HAS_GEMINI = True
except ImportError:
    print("[WARNING] google-genai not installed")
    HAS_GEMINI = False


def load_clustered_papers(clusters_path: Path) -> Dict[int, List[Dict]]:
    """
    Load papers grouped by cluster/pattern.
    
    Returns:
        Dictionary mapping cluster_id -> list of papers
    """
    clusters = defaultdict(list)
    
    with clusters_path.open() as f:
        for line in f:
            paper = json.loads(line)
            cluster_id = paper.get("cluster_id", -1)
            if cluster_id >= 0:
                clusters[cluster_id].append(paper)
    
    return dict(clusters)


def select_exemplar_papers(papers: List[Dict], max_exemplars: int = 10, min_score: float = 70.0) -> List[Dict]:
    """
    Select top-scored papers as exemplars for pattern extraction.
    
    Args:
        papers: List of papers in cluster
        max_exemplars: Maximum number of exemplars to select
        min_score: Minimum score threshold
        
    Returns:
        List of exemplar papers sorted by score
    """
    # Filter by score and sort descending
    exemplars = [p for p in papers if p.get("score", 0) >= min_score]
    exemplars.sort(key=lambda p: p.get("score", 0), reverse=True)
    
    # Take top N
    return exemplars[:max_exemplars]


async def extract_pattern_summary_llm(
    cluster_id: int,
    papers: List[Dict],
    exemplars: List[Dict],
    client: 'genai.Client',
    max_retries: int = 3,
    retry_delay: float = 5.0
) -> Dict:
    """
    Use LLM to extract pattern summary from exemplar papers with retry logic.
    
    Returns:
        {
            "representative_ideas": [...],
            "common_problems": [...],
            "solution_approaches": [...],
            "story": [...]
        }
    """
    # Prepare exemplar abstracts
    exemplar_texts = []
    for i, paper in enumerate(exemplars[:5], 1):  # Use top 5 for prompt
        title = paper.get("title", "")
        abstract = paper.get("summary", "")
        exemplar_texts.append(f"Paper {i}: {title}\nAbstract: {abstract}\n")
    
    exemplar_block = "\n".join(exemplar_texts)
    
    # Categories in this cluster
    categories = [cat for p in papers for cat in p.get("categories", [])]
    top_categories = Counter(categories).most_common(3)
    category_str = ", ".join([f"{cat} ({count})" for cat, count in top_categories])
    
    prompt = f"""Analyze these {len(exemplars)} high-quality mathematics papers from the same research pattern cluster.

CLUSTER INFO:
- Cluster ID: math_pattern_{cluster_id}
- Total papers: {len(papers)}
- Top categories: {category_str}

EXEMPLAR PAPERS:
{exemplar_block}

TASK: Extract the common research pattern across these papers. Output a JSON object with:

1. "representative_ideas": List 3-5 core mathematical innovations/contributions that exemplify this pattern
2. "common_problems": List 3-5 types of mathematical problems these papers address
3. "solution_approaches": List 3-5 common proof techniques, methods, or theoretical frameworks used
4. "story": List 3-5 narrative strategies for how these papers frame their contributions (e.g., "Generalizing classical theorems to broader settings", "Introducing new algebraic invariants")

Focus on MATHEMATICAL CONTENT and PROOF STRATEGIES, not generic research patterns.

Output ONLY valid JSON, no markdown formatting:"""

    for attempt in range(max_retries):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model='gemini-3-flash-preview',
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=2048,
                )
            )
            
            response_text = response.text.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                response_text = "\n".join(lines[1:-1])  # Remove first and last line
            if response_text.startswith("json"):
                response_text = response_text[4:].strip()
            
            summary = json.loads(response_text)
            
            # Validate structure
            required_keys = ["representative_ideas", "common_problems", "solution_approaches", "story"]
            for key in required_keys:
                if key not in summary:
                    summary[key] = []
            
            return summary
            
        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON decode error for cluster {cluster_id} (attempt {attempt+1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                print(f"  Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
            continue
            
        except Exception as e:
            error_str = str(e)
            # Check if it's a rate limit or overload error
            if "503" in error_str or "overloaded" in error_str.lower() or "UNAVAILABLE" in error_str:
                if attempt < max_retries - 1:
                    backoff_delay = retry_delay * (2 ** attempt)  # Exponential backoff
                    print(f"[WARNING] API overloaded for cluster {cluster_id} (attempt {attempt+1}/{max_retries})")
                    print(f"  Retrying in {backoff_delay}s...")
                    await asyncio.sleep(backoff_delay)
                    continue
            
            print(f"[ERROR] LLM extraction failed for cluster {cluster_id}: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
                continue
            break
    
    # Return default structure after all retries exhausted
    return {
        "representative_ideas": [],
        "common_problems": [],
        "solution_approaches": [],
        "story": []
    }


def generate_pattern_name(cluster_id: int, papers: List[Dict], summary: Dict) -> str:
    """
    Generate a descriptive name for the pattern.
    """
    # Try to use first representative idea
    if summary.get("representative_ideas"):
        idea = summary["representative_ideas"][0]
        # Truncate to reasonable length
        if len(idea) > 60:
            idea = idea[:57] + "..."
        return idea
    
    # Fall back to category-based name
    categories = [cat for p in papers for cat in p.get("categories", [])]
    top_cat = Counter(categories).most_common(1)[0][0] if categories else "Unknown"
    
    # Map category codes to readable names
    category_names = {
        "math.AG": "Algebraic Geometry",
        "math.NT": "Number Theory",
        "math.CO": "Combinatorics",
        "math.AC": "Commutative Algebra",
        "math.AT": "Algebraic Topology",
        "math.RT": "Representation Theory",
        "math.GR": "Group Theory",
        "math.DG": "Differential Geometry",
        "math.AP": "Analysis of PDEs",
        "math.CA": "Classical Analysis",
        "math.DS": "Dynamical Systems",
        "math.FA": "Functional Analysis",
        "math.GT": "Geometric Topology",
        "math.LO": "Logic",
        "math.OA": "Operator Algebras",
        "math.PR": "Probability",
        "math.QA": "Quantum Algebra",
        "math.RA": "Rings and Algebras",
        "math.SG": "Symplectic Geometry",
        "math.ST": "Statistics Theory",
    }
    
    readable_name = category_names.get(top_cat, top_cat)
    return f"{readable_name} Pattern {cluster_id}"


async def process_all_patterns(
    clusters: Dict[int, List[Dict]],
    output_path: Path,
    use_llm: bool = True,
    checkpoint_interval: int = 5
) -> List[Dict]:
    """
    Process all patterns and extract summaries with checkpoint support.
    
    Args:
        clusters: Dictionary mapping cluster_id -> list of papers
        output_path: Path to save final output
        use_llm: Whether to use LLM for extraction
        checkpoint_interval: Save checkpoint every N clusters
        
    Returns:
        List of pattern dictionaries
    """
    patterns = []
    checkpoint_path = output_path.parent / f"{output_path.stem}_checkpoint.jsonl"
    
    # Load existing checkpoint if available
    completed_clusters = set()
    if checkpoint_path.exists():
        print(f"📂 Found checkpoint: {checkpoint_path}")
        with checkpoint_path.open() as f:
            for line in f:
                if line.strip():
                    pattern = json.loads(line)
                    patterns.append(pattern)
                    completed_clusters.add(pattern["cluster_id"])
        print(f"✅ Loaded {len(patterns)} completed patterns from checkpoint")
    
    # Initialize Gemini client if using LLM
    client = None
    if use_llm:
        if not HAS_GEMINI:
            print("[ERROR] google-genai not installed. Install with: pip install google-genai")
            return patterns
        
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY")
        if not api_key:
            print("[ERROR] GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY not set")
            return patterns
        
        client = genai.Client(api_key=api_key)
    
    # Process each cluster
    sorted_cluster_ids = sorted(clusters.keys())
    total_clusters = len(sorted_cluster_ids)
    
    for idx, cluster_id in enumerate(sorted_cluster_ids, 1):
        # Skip if already processed
        if cluster_id in completed_clusters:
            print(f"[{idx}/{total_clusters}] ⏭️  Skipping cluster {cluster_id} (already completed)")
            continue
        
        papers = clusters[cluster_id]
        print(f"\n[{idx}/{total_clusters}] Processing cluster {cluster_id} ({len(papers)} papers)...")
        
        # Select exemplars
        exemplars = select_exemplar_papers(papers, max_exemplars=10, min_score=70.0)
        print(f"  Selected {len(exemplars)} exemplars")
        
        # Extract summary
        if use_llm and client and exemplars:
            summary = await extract_pattern_summary_llm(cluster_id, papers, exemplars, client)
        else:
            # Default summary without LLM
            summary = {
                "representative_ideas": [],
                "common_problems": [],
                "solution_approaches": [],
                "story": []
            }
        
        # Generate pattern name
        pattern_name = generate_pattern_name(cluster_id, papers, summary)
        
        # Get domain info
        categories = [cat for p in papers for cat in p.get("categories", [])]
        category_counts = Counter(categories)
        primary_domain = category_counts.most_common(1)[0][0] if categories else "math"
        sub_domains = [cat for cat, _ in category_counts.most_common(5)]
        
        # Calculate scores
        scores = [p.get("score", 50.0) for p in papers]
        
        pattern = {
            "pattern_id": f"math_pattern_{cluster_id}",
            "cluster_id": cluster_id,
            "name": pattern_name,
            "size": len(papers),
            "domain": primary_domain,
            "sub_domains": sub_domains,
            "avg_score": float(sum(scores) / len(scores)) if scores else 50.0,
            "summary": summary,
            "exemplar_paper_ids": [p["id"] for p in exemplars],
            "all_paper_ids": [p["id"] for p in papers],
        }
        
        patterns.append(pattern)
        
        print(f"  Pattern: {pattern_name}")
        print(f"  Ideas: {len(summary.get('representative_ideas', []))}")
        print(f"  Problems: {len(summary.get('common_problems', []))}")
        print(f"  Approaches: {len(summary.get('solution_approaches', []))}")
        
        # Save checkpoint every N clusters
        if len(patterns) % checkpoint_interval == 0:
            print(f"  💾 Saving checkpoint ({len(patterns)} patterns)...")
            with checkpoint_path.open('w') as f:
                for p in patterns:
                    f.write(json.dumps(p) + "\n")
    
    # Save final output
    print(f"\n\n💾 Saving {len(patterns)} patterns to {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with output_path.open('w') as f:
        for pattern in patterns:
            f.write(json.dumps(pattern) + "\n")
    
    print(f"✅ Saved patterns to {output_path}")
    
    # Remove checkpoint file after successful completion
    if checkpoint_path.exists():
        checkpoint_path.unlink()
        print(f"🗑️  Removed checkpoint file")
    
    return patterns


async def main():
    parser = argparse.ArgumentParser(description="Extract pattern summaries from clustered papers")
    parser.add_argument(
        "--input",
        type=str,
        default="output_math/pattern_clusters.jsonl",
        help="Input path to cluster assignments"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="output_math/math_patterns_full.jsonl",
        help="Output path for pattern summaries"
    )
    parser.add_argument(
        "--no-llm",
        action="store_true",
        help="Skip LLM extraction (create empty summaries)"
    )
    parser.add_argument(
        "--checkpoint-interval",
        type=int,
        default=5,
        help="Save checkpoint every N clusters (default: 5)"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from checkpoint if available"
    )
    
    args = parser.parse_args()
    
    # Resolve paths
    project_root = Path(__file__).parent.parent.parent
    input_path = project_root / args.input
    output_path = project_root / args.output
    
    if not input_path.exists():
        print(f"[ERROR] Input file not found: {input_path}")
        print("Run cluster_math_papers.py first to generate cluster assignments")
        return
    
    # Load clustered papers
    print(f"Loading clustered papers from {input_path}")
    clusters = load_clustered_papers(input_path)
    print(f"Loaded {len(clusters)} clusters")
    
    # Process patterns
    patterns = await process_all_patterns(
        clusters,
        output_path,
        use_llm=not args.no_llm,
        checkpoint_interval=args.checkpoint_interval
    )
    
    print(f"\n✅ Pattern extraction complete!")
    print(f"Generated {len(patterns)} math patterns")


if __name__ == "__main__":
    asyncio.run(main())
