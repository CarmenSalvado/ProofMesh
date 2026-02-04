#!/usr/bin/env python3
"""
Generate math patterns from arXiv papers using embedding-based clustering.

This script:
1. Reads metadata_all.jsonl
2. Embeds abstracts using sentence-transformers or API
3. Clusters papers into patterns (50-100 clusters)
4. Assigns pattern_id to each paper
5. Outputs pattern_clusters.jsonl

Usage:
    python backend/scripts/cluster_math_papers.py --n-clusters 60 --output output_math/pattern_clusters.jsonl
"""

import asyncio
import json
import argparse
from pathlib import Path
from typing import List, Dict, Optional
from collections import Counter, defaultdict

import numpy as np
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import normalize
import sys
import os

# Load environment variables from .env file
from dotenv import load_dotenv
project_root = Path(__file__).parent.parent.parent
load_dotenv(project_root / ".env")

# Add parent directory for imports
sys.path.insert(0, str(project_root / "backend"))

# Try importing sentence-transformers (optional)
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    print("[WARNING] sentence-transformers not installed. Using OpenAI embeddings instead.")
    HAS_SENTENCE_TRANSFORMERS = False
    # Will need OpenAI API key


def load_papers(metadata_path: Path) -> List[Dict]:
    """Load papers from metadata JSONL file."""
    papers = []
    with metadata_path.open() as f:
        for line in f:
            papers.append(json.loads(line))
    return papers


def embed_abstracts_local(abstracts: List[str], model_name: str = "all-MiniLM-L6-v2") -> np.ndarray:
    """
    Embed abstracts using local sentence-transformers model.
    
    Args:
        abstracts: List of abstract texts
        model_name: HuggingFace model name
        
    Returns:
        Numpy array of shape (n_papers, embedding_dim)
    """
    print(f"Loading embedding model: {model_name}")
    model = SentenceTransformer(model_name)
    
    print(f"Embedding {len(abstracts)} abstracts...")
    embeddings = model.encode(
        abstracts,
        show_progress_bar=True,
        batch_size=32,
        convert_to_numpy=True
    )
    
    return embeddings


async def embed_abstracts_api(abstracts: List[str], provider: str = "auto") -> np.ndarray:
    """
    Embed abstracts using API (OpenAI, Google, etc.).
    
    Args:
        abstracts: List of abstract texts
        provider: API provider (openai, google, auto)
        
    Returns:
        Numpy array of shape (n_papers, embedding_dim)
    """
    import os
    
    # Auto-detect provider based on available API keys
    if provider == "auto":
        if os.environ.get("OPENAI_API_KEY"):
            provider = "openai"
        elif os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY"):
            provider = "google"
        else:
            raise ValueError(
                "No API key found. Set OPENAI_API_KEY or GEMINI_API_KEY/GOOGLE_GENERATIVE_AI_API_KEY"
            )
    
    if provider == "openai":
        import openai
        
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        client = openai.OpenAI(api_key=api_key)
        
        print(f"Embedding {len(abstracts)} abstracts via OpenAI API...")
        embeddings = []
        
        # Batch processing
        batch_size = 100
        for i in range(0, len(abstracts), batch_size):
            batch = abstracts[i:i+batch_size]
            print(f"  Batch {i//batch_size + 1}/{(len(abstracts) + batch_size - 1)//batch_size}")
            
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=batch
            )
            
            batch_embeddings = [item.embedding for item in response.data]
            embeddings.extend(batch_embeddings)
        
        return np.array(embeddings)
    
    elif provider == "google":
        from google import genai
        
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY environment variable not set")
        
        client = genai.Client(api_key=api_key)
        
        print(f"Embedding {len(abstracts)} abstracts via Google Gemini API...")
        embeddings = []
        
        # Batch processing (Gemini supports batch embeddings)
        batch_size = 100
        for i in range(0, len(abstracts), batch_size):
            batch = abstracts[i:i+batch_size]
            print(f"  Batch {i//batch_size + 1}/{(len(abstracts) + batch_size - 1)//batch_size}")
            
            # Use text-embedding-004 model
            response = client.models.embed_content(
                model='models/text-embedding-004',
                contents=batch
            )
            
            # Extract embeddings from response
            batch_embeddings = [embedding.values for embedding in response.embeddings]
            embeddings.extend(batch_embeddings)
        
        return np.array(embeddings)
    
    else:
        raise ValueError(f"Unsupported provider: {provider}")


def cluster_embeddings(
    embeddings: np.ndarray,
    n_clusters: int,
    method: str = "kmeans"
) -> np.ndarray:
    """
    Cluster embeddings into patterns.
    
    Args:
        embeddings: Embedding matrix (n_papers, embedding_dim)
        n_clusters: Number of clusters
        method: Clustering algorithm (kmeans, dbscan)
        
    Returns:
        Cluster labels array (n_papers,)
    """
    print(f"Clustering {len(embeddings)} papers into {n_clusters} patterns using {method}...")
    
    # Normalize embeddings for cosine similarity
    embeddings_norm = normalize(embeddings, norm='l2')
    
    if method == "kmeans":
        clusterer = KMeans(
            n_clusters=n_clusters,
            random_state=42,
            n_init=10,
            max_iter=300,
            verbose=1
        )
        labels = clusterer.fit_predict(embeddings_norm)
        
    elif method == "dbscan":
        # DBSCAN doesn't require n_clusters, but we use it as a guide for eps
        clusterer = DBSCAN(
            eps=0.5,
            min_samples=5,
            metric='cosine'
        )
        labels = clusterer.fit_predict(embeddings_norm)
        
        # Handle noise points (-1 label)
        n_clusters_actual = len(set(labels)) - (1 if -1 in labels else 0)
        print(f"  DBSCAN found {n_clusters_actual} clusters")
        
    else:
        raise ValueError(f"Unsupported clustering method: {method}")
    
    return labels


def analyze_clusters(papers: List[Dict], labels: np.ndarray) -> Dict:
    """
    Analyze cluster composition and statistics.
    
    Args:
        papers: List of paper metadata
        labels: Cluster labels
        
    Returns:
        Dictionary with cluster statistics
    """
    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    print(f"\n=== Cluster Analysis ===")
    print(f"Number of clusters: {n_clusters}")
    
    cluster_stats = {}
    
    for cluster_id in range(n_clusters):
        mask = labels == cluster_id
        cluster_papers = [p for p, m in zip(papers, mask) if m]
        
        if not cluster_papers:
            continue
        
        # Aggregate statistics
        categories = [cat for p in cluster_papers for cat in p.get("categories", [])]
        category_counts = Counter(categories)
        
        scores = [p.get("score", 50.0) for p in cluster_papers]
        
        cluster_stats[cluster_id] = {
            "size": len(cluster_papers),
            "avg_score": np.mean(scores),
            "median_score": np.median(scores),
            "top_categories": category_counts.most_common(3),
            "paper_ids": [p["id"] for p in cluster_papers],
            "exemplar_paper_ids": [p["id"] for p in cluster_papers if p.get("score", 0) >= 75.0]
        }
    
    # Print summary
    cluster_sizes = [stats["size"] for stats in cluster_stats.values()]
    print(f"Cluster size: min={min(cluster_sizes)}, max={max(cluster_sizes)}, "
          f"mean={np.mean(cluster_sizes):.1f}, median={np.median(cluster_sizes):.1f}")
    
    # Show top 5 largest clusters
    print(f"\nTop 5 largest clusters:")
    sorted_clusters = sorted(cluster_stats.items(), key=lambda x: x[1]["size"], reverse=True)
    for cluster_id, stats in sorted_clusters[:5]:
        top_cat = stats["top_categories"][0][0] if stats["top_categories"] else "unknown"
        print(f"  Cluster {cluster_id}: {stats['size']} papers, "
              f"top category: {top_cat}, "
              f"avg_score: {stats['avg_score']:.1f}")
    
    return cluster_stats


def save_clusters(
    papers: List[Dict],
    labels: np.ndarray,
    cluster_stats: Dict,
    output_path: Path
):
    """
    Save cluster assignments to JSONL file.
    
    Each line contains:
    {
        "paper_id": "2601.23247v1",
        "pattern_id": "math_pattern_42",
        "cluster_id": 42,
        "title": "...",
        "abstract": "...",
        "categories": [...],
        "score": 75.3,
        ...
    }
    """
    print(f"\nSaving cluster assignments to {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with output_path.open('w') as f:
        for paper, label in zip(papers, labels):
            if label == -1:  # Noise point in DBSCAN
                continue
            
            paper_with_pattern = {
                **paper,
                "pattern_id": f"math_pattern_{label}",
                "cluster_id": int(label),
            }
            
            f.write(json.dumps(paper_with_pattern) + "\n")
    
    # Also save cluster summary
    summary_path = output_path.parent / f"{output_path.stem}_summary.json"
    with summary_path.open('w') as f:
        json.dump(cluster_stats, f, indent=2)
    
    print(f"Saved {len(papers)} paper assignments")
    print(f"Saved cluster summary to {summary_path}")


async def main():
    parser = argparse.ArgumentParser(description="Cluster math papers into patterns")
    parser.add_argument(
        "--metadata",
        type=str,
        default="papers/arxiv_math/metadata_all.jsonl",
        help="Path to metadata JSONL file"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="output_math/pattern_clusters.jsonl",
        help="Output path for cluster assignments"
    )
    parser.add_argument(
        "--n-clusters",
        type=int,
        default=60,
        help="Number of clusters to create"
    )
    parser.add_argument(
        "--method",
        type=str,
        choices=["kmeans", "dbscan"],
        default="kmeans",
        help="Clustering algorithm"
    )
    parser.add_argument(
        "--embedding-model",
        type=str,
        default="all-MiniLM-L6-v2",
        help="Sentence transformer model name (if using local embeddings)"
    )
    parser.add_argument(
        "--use-api",
        action="store_true",
        help="Use API for embeddings instead of local model"
    )
    parser.add_argument(
        "--api-provider",
        type=str,
        choices=["auto", "openai", "google"],
        default="auto",
        help="API provider for embeddings (auto-detects by default)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit to first N papers (for testing)"
    )
    
    args = parser.parse_args()
    
    # Resolve paths
    project_root = Path(__file__).parent.parent.parent
    metadata_path = project_root / args.metadata
    output_path = project_root / args.output
    
    if not metadata_path.exists():
        print(f"[ERROR] Metadata file not found: {metadata_path}")
        return
    
    # Load papers
    print(f"Loading papers from {metadata_path}")
    papers = load_papers(metadata_path)
    
    if args.limit:
        papers = papers[:args.limit]
        print(f"Limited to {args.limit} papers")
    
    print(f"Loaded {len(papers)} papers")
    
    # Extract abstracts
    abstracts = [p.get("summary", "") for p in papers]
    
    # Embed abstracts
    if args.use_api or not HAS_SENTENCE_TRANSFORMERS:
        embeddings = await embed_abstracts_api(abstracts, provider=args.api_provider)
    else:
        embeddings = embed_abstracts_local(abstracts, model_name=args.embedding_model)
    
    print(f"Embedding shape: {embeddings.shape}")
    
    # Cluster
    labels = cluster_embeddings(embeddings, n_clusters=args.n_clusters, method=args.method)
    
    # Analyze
    cluster_stats = analyze_clusters(papers, labels)
    
    # Save
    save_clusters(papers, labels, cluster_stats, output_path)
    
    print("\n✅ Clustering complete!")
    print(f"Pattern assignments saved to: {output_path}")


if __name__ == "__main__":
    asyncio.run(main())
