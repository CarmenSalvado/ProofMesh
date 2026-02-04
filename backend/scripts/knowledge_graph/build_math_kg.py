#!/usr/bin/env python3
"""
Build knowledge graph from math papers with patterns.

This script adapts Idea2Paper's build_entity_v3.py for arXiv math papers.

Data sources:
  - output_math/pattern_clusters.jsonl: Paper→Pattern assignments
  - output_math/math_patterns_full.jsonl: Pattern details with summaries
  - papers/arxiv_math/metadata_all.jsonl: Full paper metadata

Node types:
  - Idea: Core innovations (from pattern summaries)
  - Pattern: Mathematical research patterns (from clusters)
  - Domain: Math categories (from arXiv categories)
  - Paper: Math papers (from metadata)

Output:
  - output_math/nodes_idea.json
  - output_math/nodes_pattern.json
  - output_math/nodes_domain.json
  - output_math/nodes_paper.json
  - output_math/knowledge_graph_stats.json
"""

import hashlib
import json
from collections import defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional
import sys

# Add parent for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


@dataclass
class GraphStats:
    """Knowledge graph statistics"""
    total_nodes: int = 0
    ideas: int = 0
    patterns: int = 0
    domains: int = 0
    papers: int = 0


class MathKnowledgeGraphBuilder:
    """Knowledge graph builder for math papers"""

    def __init__(self, project_root: Path, output_dir: Path):
        self.project_root = project_root
        self.output_dir = output_dir
        self.stats = GraphStats()

        # Node storage
        self.idea_nodes: List[Dict] = []
        self.pattern_nodes: List[Dict] = []
        self.domain_nodes: List[Dict] = []
        self.paper_nodes: List[Dict] = []

        # Deduplication maps
        self.idea_map: Dict[str, str] = {}        # idea_hash -> idea_id
        self.domain_map: Dict[str, str] = {}      # domain_name -> domain_id
        self.pattern_map: Dict[int, str] = {}     # cluster_id -> pattern_id
        self.paper_map: Dict[str, str] = {}       # paper_id -> paper_id

        # Intermediate data
        self.patterns_by_id: Dict[str, Dict] = {} # pattern_id -> pattern details
        self.papers_by_id: Dict[str, Dict] = {}   # paper_id -> full metadata

    def build(self):
        """Build complete knowledge graph"""
        print("=" * 60)
        print("🚀 Building Math Knowledge Graph")
        print("=" * 60)

        # Step 1: Load data
        print("\n【Step 1】Loading data")
        pattern_papers = self._load_pattern_papers()
        patterns = self._load_patterns()
        all_papers = self._load_all_papers()
        
        print(f"✅ Loaded {len(pattern_papers)} paper→pattern assignments")
        print(f"✅ Loaded {len(patterns)} patterns")
        print(f"✅ Loaded {len(all_papers)} total papers")

        # Step 2: Build nodes
        print("\n【Step 2】Building nodes")
        self._build_pattern_nodes(patterns)
        self._build_idea_nodes(patterns)
        self._build_domain_nodes(all_papers)
        self._build_paper_nodes(pattern_papers, all_papers)

        # Step 3: Link nodes
        print("\n【Step 3】Linking nodes")
        self._link_paper_to_pattern(pattern_papers)
        self._link_paper_to_idea(pattern_papers)
        self._link_paper_to_domain()
        self._link_idea_to_pattern()

        # Step 4: Save nodes
        print("\n【Step 4】Saving nodes")
        self._save_nodes()

        # Step 5: Statistics
        print("\n【Step 5】Statistics")
        self._update_stats()
        self._save_stats()
        self._print_stats()

        print("\n" + "=" * 60)
        print("✅ Knowledge graph build complete!")
        print("=" * 60)

    # ===================== Data Loading =====================

    def _load_pattern_papers(self) -> List[Dict]:
        """Load paper→pattern assignments (pattern_clusters.jsonl)"""
        pattern_file = self.output_dir / "pattern_clusters.jsonl"
        
        if not pattern_file.exists():
            print(f"⚠️  File not found: {pattern_file}")
            return []

        papers = []
        with pattern_file.open() as f:
            for line in f:
                if line.strip():
                    papers.append(json.loads(line))
        
        return papers

    def _load_patterns(self) -> List[Dict]:
        """Load pattern summaries (math_patterns_full.jsonl)"""
        pattern_file = self.output_dir / "math_patterns_full.jsonl"
        
        if not pattern_file.exists():
            print(f"⚠️  File not found: {pattern_file}")
            return []

        patterns = []
        with pattern_file.open() as f:
            for line in f:
                if line.strip():
                    pattern = json.loads(line)
                    patterns.append(pattern)
                    # Store for quick lookup
                    self.patterns_by_id[pattern["pattern_id"]] = pattern
        
        return patterns

    def _load_all_papers(self) -> List[Dict]:
        """Load all paper metadata (metadata_all.jsonl)"""
        metadata_file = self.project_root / "papers" / "arxiv_math" / "metadata_all.jsonl"
        
        if not metadata_file.exists():
            print(f"⚠️  File not found: {metadata_file}")
            return []

        papers = []
        with metadata_file.open() as f:
            for line in f:
                if line.strip():
                    paper = json.loads(line)
                    papers.append(paper)
                    # Store for quick lookup
                    self.papers_by_id[paper["id"]] = paper
        
        return papers

    # ===================== Node Building =====================

    def _build_pattern_nodes(self, patterns: List[Dict]):
        """Build Pattern nodes from pattern summaries"""
        print("  📌 Building Pattern nodes...")
        
        for pattern in patterns:
            pattern_id = pattern["pattern_id"]
            cluster_id = pattern["cluster_id"]
            
            # Create pattern node
            node = {
                "id": pattern_id,
                "type": "Pattern",
                "name": pattern["name"],
                "cluster_id": cluster_id,
                "size": pattern["size"],
                "domain": pattern["domain"],
                "sub_domains": pattern.get("sub_domains", []),
                "avg_score": pattern.get("avg_score", 50.0),
                "summary": pattern.get("summary", {}),
                "exemplar_paper_ids": pattern.get("exemplar_paper_ids", []),
                "papers": [],  # Will be populated in linking
            }
            
            self.pattern_nodes.append(node)
            self.pattern_map[cluster_id] = pattern_id
        
        print(f"    ✅ Created {len(self.pattern_nodes)} Pattern nodes")

    def _build_idea_nodes(self, patterns: List[Dict]):
        """Build Idea nodes from pattern representative_ideas"""
        print("  📌 Building Idea nodes...")
        
        idea_counter = 0
        
        for pattern in patterns:
            pattern_id = pattern["pattern_id"]
            summary = pattern.get("summary", {})
            representative_ideas = summary.get("representative_ideas", [])
            
            for idea_text in representative_ideas:
                if not idea_text or len(idea_text.strip()) < 10:
                    continue
                
                # Generate unique ID from idea text
                idea_hash = hashlib.md5(idea_text.encode()).hexdigest()[:12]
                
                # Check if already exists
                if idea_hash in self.idea_map:
                    continue
                
                idea_id = f"idea_{idea_counter}"
                idea_counter += 1
                
                node = {
                    "id": idea_id,
                    "type": "Idea",
                    "text": idea_text,
                    "pattern_id": pattern_id,
                    "papers": [],  # Will be populated in linking
                }
                
                self.idea_nodes.append(node)
                self.idea_map[idea_hash] = idea_id
        
        print(f"    ✅ Created {len(self.idea_nodes)} Idea nodes")

    def _build_domain_nodes(self, papers: List[Dict]):
        """Build Domain nodes from arXiv categories"""
        print("  📌 Building Domain nodes...")
        
        # Category name mapping
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
            "math.CV": "Complex Variables",
            "math.DS": "Dynamical Systems",
            "math.FA": "Functional Analysis",
            "math.GM": "General Mathematics",
            "math.GN": "General Topology",
            "math.GT": "Geometric Topology",
            "math.HO": "History and Overview",
            "math.LO": "Logic",
            "math.MG": "Metric Geometry",
            "math.MP": "Mathematical Physics",
            "math.NA": "Numerical Analysis",
            "math.OA": "Operator Algebras",
            "math.OC": "Optimization and Control",
            "math.PR": "Probability",
            "math.QA": "Quantum Algebra",
            "math.RA": "Rings and Algebras",
            "math.SG": "Symplectic Geometry",
            "math.SP": "Spectral Theory",
            "math.ST": "Statistics Theory",
        }
        
        # Collect all categories
        domain_counts = defaultdict(int)
        for paper in papers:
            for category in paper.get("categories", []):
                domain_counts[category] += 1
        
        # Create domain nodes
        for category, count in domain_counts.items():
            domain_id = f"domain_{category.replace('.', '_')}"
            readable_name = category_names.get(category, category)
            
            node = {
                "id": domain_id,
                "type": "Domain",
                "name": readable_name,
                "category": category,
                "paper_count": count,
                "papers": [],  # Will be populated in linking
            }
            
            self.domain_nodes.append(node)
            self.domain_map[category] = domain_id
        
        print(f"    ✅ Created {len(self.domain_nodes)} Domain nodes")

    def _build_paper_nodes(self, pattern_papers: List[Dict], all_papers: List[Dict]):
        """Build Paper nodes"""
        print("  📌 Building Paper nodes...")
        
        for pattern_paper in pattern_papers:
            paper_id = pattern_paper["id"]
            
            # Get full metadata
            metadata = self.papers_by_id.get(paper_id)
            if not metadata:
                continue
            
            # Get openalex data
            openalex = metadata.get("openalex", {})
            
            node = {
                "id": f"paper_{paper_id.replace('.', '_').replace('-', '_')}",
                "type": "Paper",
                "arxiv_id": paper_id,
                "title": metadata.get("title", ""),
                "authors": metadata.get("authors", []),
                "abstract": metadata.get("summary", ""),
                "categories": metadata.get("categories", []),
                "published": metadata.get("published", ""),
                "score": metadata.get("score", 50.0),
                "cited_by_count": openalex.get("cited_by_count", 0) if openalex else 0,
                "pattern_id": pattern_paper.get("pattern_id"),
                "cluster_id": pattern_paper.get("cluster_id"),
                "pdf_url": metadata.get("pdf_url", ""),
                "local_pdf": metadata.get("local_pdf", ""),
            }
            
            self.paper_nodes.append(node)
            self.paper_map[paper_id] = node["id"]
        
        print(f"    ✅ Created {len(self.paper_nodes)} Paper nodes")

    # ===================== Node Linking =====================

    def _link_paper_to_pattern(self, pattern_papers: List[Dict]):
        """Link papers to their patterns"""
        print("  🔗 Linking Paper→Pattern...")
        
        link_count = 0
        for pattern_paper in pattern_papers:
            paper_id = pattern_paper["id"]
            pattern_id = pattern_paper.get("pattern_id")
            
            if not pattern_id:
                continue
            
            # Find pattern node
            pattern_node = next(
                (p for p in self.pattern_nodes if p["id"] == pattern_id),
                None
            )
            
            if pattern_node:
                paper_node_id = self.paper_map.get(paper_id)
                if paper_node_id and paper_node_id not in pattern_node["papers"]:
                    pattern_node["papers"].append(paper_node_id)
                    link_count += 1
        
        print(f"    ✅ Created {link_count} Paper→Pattern links")

    def _link_paper_to_idea(self, pattern_papers: List[Dict]):
        """Link papers to ideas (via their pattern)"""
        print("  🔗 Linking Paper→Idea...")
        
        link_count = 0
        for pattern_paper in pattern_papers:
            paper_id = pattern_paper["id"]
            pattern_id = pattern_paper.get("pattern_id")
            
            if not pattern_id:
                continue
            
            # Find all ideas belonging to this pattern
            pattern_ideas = [
                idea for idea in self.idea_nodes 
                if idea.get("pattern_id") == pattern_id
            ]
            
            paper_node_id = self.paper_map.get(paper_id)
            if not paper_node_id:
                continue
            
            # Link each idea to this paper
            for idea in pattern_ideas:
                if paper_node_id not in idea["papers"]:
                    idea["papers"].append(paper_node_id)
                    link_count += 1
        
        print(f"    ✅ Created {link_count} Paper→Idea links")

    def _link_paper_to_domain(self):
        """Link papers to their domains (categories)"""
        print("  🔗 Linking Paper→Domain...")
        
        link_count = 0
        for paper_node in self.paper_nodes:
            categories = paper_node.get("categories", [])
            paper_id = paper_node["id"]
            
            for category in categories:
                domain_id = self.domain_map.get(category)
                if domain_id:
                    # Find domain node
                    domain_node = next(
                        (d for d in self.domain_nodes if d["id"] == domain_id),
                        None
                    )
                    if domain_node and paper_id not in domain_node["papers"]:
                        domain_node["papers"].append(paper_id)
                        link_count += 1
        
        print(f"    ✅ Created {link_count} Paper→Domain links")

    def _link_idea_to_pattern(self):
        """Ideas are already linked to patterns in _build_idea_nodes"""
        print("  🔗 Idea→Pattern links already established")

    # ===================== Saving =====================

    def _save_nodes(self):
        """Save all node types to JSON files"""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        nodes = {
            "nodes_idea.json": self.idea_nodes,
            "nodes_pattern.json": self.pattern_nodes,
            "nodes_domain.json": self.domain_nodes,
            "nodes_paper.json": self.paper_nodes,
        }
        
        for filename, node_list in nodes.items():
            filepath = self.output_dir / filename
            with filepath.open('w') as f:
                json.dump(node_list, f, indent=2, ensure_ascii=False)
            print(f"    ✅ Saved {filepath}")

    def _update_stats(self):
        """Update statistics"""
        self.stats.ideas = len(self.idea_nodes)
        self.stats.patterns = len(self.pattern_nodes)
        self.stats.domains = len(self.domain_nodes)
        self.stats.papers = len(self.paper_nodes)
        self.stats.total_nodes = (
            self.stats.ideas +
            self.stats.patterns +
            self.stats.domains +
            self.stats.papers
        )

    def _save_stats(self):
        """Save statistics to file"""
        stats_file = self.output_dir / "knowledge_graph_stats.json"
        with stats_file.open('w') as f:
            json.dump(asdict(self.stats), f, indent=2)
        print(f"    ✅ Saved {stats_file}")

    def _print_stats(self):
        """Print statistics"""
        print("\n" + "=" * 60)
        print("📊 Knowledge Graph Statistics")
        print("=" * 60)
        print(f"  Ideas:    {self.stats.ideas}")
        print(f"  Patterns: {self.stats.patterns}")
        print(f"  Domains:  {self.stats.domains}")
        print(f"  Papers:   {self.stats.papers}")
        print(f"  Total:    {self.stats.total_nodes}")
        print("=" * 60)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Build math knowledge graph")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="output_math",
        help="Output directory for knowledge graph files"
    )
    
    args = parser.parse_args()
    
    # Resolve paths
    project_root = Path(__file__).parent.parent.parent
    output_dir = project_root / args.output_dir
    
    # Build graph
    builder = MathKnowledgeGraphBuilder(project_root, output_dir)
    builder.build()


if __name__ == "__main__":
    main()
