#!/usr/bin/env python3
"""
Math Knowledge Base Management Script

Manages the complete pipeline with checkpoints, recovery, and status tracking.

Usage:
    python backend/scripts/manage_math_kb.py status
    python backend/scripts/manage_math_kb.py run --step clustering
    python backend/scripts/manage_math_kb.py run --step extraction --resume
    python backend/scripts/manage_math_kb.py run --all
    python backend/scripts/manage_math_kb.py clean --step extraction
"""

import asyncio
import json
import argparse
from pathlib import Path
from typing import Dict, List, Optional
import sys
from datetime import datetime

# Add parent for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


class MathKBManager:
    """Manages the math knowledge base pipeline"""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.output_dir = project_root / "output_math"
        self.metadata_file = project_root / "papers" / "arxiv_math" / "metadata_all.jsonl"
        
        # Pipeline files
        self.files = {
            "metadata": self.metadata_file,
            "clusters": self.output_dir / "pattern_clusters.jsonl",
            "clusters_summary": self.output_dir / "pattern_clusters_summary.json",
            "patterns": self.output_dir / "math_patterns_full.jsonl",
            "patterns_checkpoint": self.output_dir / "math_patterns_full_checkpoint.jsonl",
            "nodes_idea": self.output_dir / "nodes_idea.json",
            "nodes_pattern": self.output_dir / "nodes_pattern.json",
            "nodes_domain": self.output_dir / "nodes_domain.json",
            "nodes_paper": self.output_dir / "nodes_paper.json",
            "kg_stats": self.output_dir / "knowledge_graph_stats.json",
        }
        
        # Status file
        self.status_file = self.output_dir / "pipeline_status.json"
    
    def get_status(self) -> Dict:
        """Get current pipeline status"""
        status = {
            "timestamp": datetime.now().isoformat(),
            "steps": {
                "clustering": {"completed": False, "file_exists": False, "count": 0},
                "extraction": {"completed": False, "file_exists": False, "count": 0, "checkpoint_exists": False},
                "knowledge_graph": {"completed": False, "file_exists": False, "count": 0},
                "database_import": {"completed": False, "count": 0}
            }
        }
        
        # Check clustering
        if self.files["clusters"].exists():
            status["steps"]["clustering"]["file_exists"] = True
            with self.files["clusters"].open() as f:
                count = sum(1 for _ in f)
            status["steps"]["clustering"]["count"] = count
            status["steps"]["clustering"]["completed"] = count > 0
        
        # Check extraction
        if self.files["patterns"].exists():
            status["steps"]["extraction"]["file_exists"] = True
            with self.files["patterns"].open() as f:
                count = sum(1 for _ in f)
            status["steps"]["extraction"]["count"] = count
            status["steps"]["extraction"]["completed"] = count > 0
        
        if self.files["patterns_checkpoint"].exists():
            status["steps"]["extraction"]["checkpoint_exists"] = True
        
        # Check knowledge graph
        kg_files = ["nodes_idea", "nodes_pattern", "nodes_domain", "nodes_paper"]
        kg_exists = all(self.files[f].exists() for f in kg_files)
        status["steps"]["knowledge_graph"]["file_exists"] = kg_exists
        
        if kg_exists and self.files["kg_stats"].exists():
            with self.files["kg_stats"].open() as f:
                stats = json.load(f)
            status["steps"]["knowledge_graph"]["count"] = stats.get("total_nodes", 0)
            status["steps"]["knowledge_graph"]["completed"] = stats.get("total_nodes", 0) > 0
        
        # Load persistent status if available
        if self.status_file.exists():
            with self.status_file.open() as f:
                saved_status = json.load(f)
            # Merge database import status
            if "database_import" in saved_status.get("steps", {}):
                status["steps"]["database_import"] = saved_status["steps"]["database_import"]
        
        return status
    
    def save_status(self, status: Dict):
        """Save pipeline status"""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        with self.status_file.open('w') as f:
            json.dump(status, f, indent=2)
    
    def print_status(self):
        """Print formatted status"""
        status = self.get_status()
        
        print("\n" + "=" * 60)
        print("📊 Math Knowledge Base Pipeline Status")
        print("=" * 60)
        print(f"Last updated: {status['timestamp']}\n")
        
        steps = status["steps"]
        
        # Clustering
        clustering = steps["clustering"]
        icon = "✅" if clustering["completed"] else "❌"
        print(f"{icon} Step 1: Clustering")
        print(f"   File exists: {clustering['file_exists']}")
        if clustering["count"] > 0:
            print(f"   Papers clustered: {clustering['count']}")
        print()
        
        # Extraction
        extraction = steps["extraction"]
        icon = "✅" if extraction["completed"] else "⏳" if extraction["checkpoint_exists"] else "❌"
        print(f"{icon} Step 2: Pattern Extraction")
        print(f"   File exists: {extraction['file_exists']}")
        if extraction["count"] > 0:
            print(f"   Patterns extracted: {extraction['count']}")
        if extraction["checkpoint_exists"]:
            print(f"   ⚠️  Checkpoint found (incomplete extraction)")
        print()
        
        # Knowledge graph
        kg = steps["knowledge_graph"]
        icon = "✅" if kg["completed"] else "❌"
        print(f"{icon} Step 3: Knowledge Graph")
        print(f"   Files exist: {kg['file_exists']}")
        if kg["count"] > 0:
            print(f"   Total nodes: {kg['count']}")
        print()
        
        # Database import
        db = steps["database_import"]
        icon = "✅" if db["completed"] else "❌"
        print(f"{icon} Step 4: Database Import")
        if db["count"] > 0:
            print(f"   Papers imported: {db['count']}")
        print()
        
        print("=" * 60)
        
        # Next steps
        if not clustering["completed"]:
            print("\n💡 Next: Run clustering")
            print("   python backend/scripts/manage_math_kb.py run --step clustering")
        elif not extraction["completed"]:
            if extraction["checkpoint_exists"]:
                print("\n💡 Next: Resume pattern extraction")
                print("   python backend/scripts/manage_math_kb.py run --step extraction --resume")
            else:
                print("\n💡 Next: Run pattern extraction")
                print("   python backend/scripts/manage_math_kb.py run --step extraction")
        elif not kg["completed"]:
            print("\n💡 Next: Build knowledge graph")
            print("   python backend/scripts/manage_math_kb.py run --step knowledge_graph")
        elif not db["completed"]:
            print("\n💡 Next: Import to database")
            print("   python backend/scripts/manage_math_kb.py run --step database_import")
        else:
            print("\n🎉 All steps completed!")
        print()
    
    async def run_clustering(self, n_clusters: int = 60):
        """Run clustering step"""
        print("\n" + "=" * 60)
        print("🚀 Running Step 1: Clustering")
        print("=" * 60 + "\n")
        
        # Import here to avoid circular dependencies
        from cluster_math_papers import main as cluster_main
        
        # Set sys.argv for argparse
        sys.argv = [
            "cluster_math_papers.py",
            "--metadata", str(self.metadata_file),
            "--output", str(self.files["clusters"]),
            "--n-clusters", str(n_clusters)
        ]
        
        await cluster_main()
        
        # Update status
        status = self.get_status()
        self.save_status(status)
        
        print("\n✅ Clustering complete!")
    
    async def run_extraction(self, resume: bool = False):
        """Run pattern extraction step"""
        print("\n" + "=" * 60)
        print("🚀 Running Step 2: Pattern Extraction")
        if resume:
            print("   (Resuming from checkpoint)")
        print("=" * 60 + "\n")
        
        from extract_pattern_summaries import main as extract_main
        
        # Set sys.argv for argparse
        args = [
            "extract_pattern_summaries.py",
            "--input", str(self.files["clusters"]),
            "--output", str(self.files["patterns"])
        ]
        
        if resume:
            args.append("--resume")
        
        sys.argv = args
        
        await extract_main()
        
        # Update status
        status = self.get_status()
        self.save_status(status)
        
        print("\n✅ Pattern extraction complete!")
    
    async def run_knowledge_graph(self):
        """Run knowledge graph build step"""
        print("\n" + "=" * 60)
        print("🚀 Running Step 3: Knowledge Graph Build")
        print("=" * 60 + "\n")
        
        from build_math_kg import main as kg_main
        
        # Set sys.argv for argparse
        sys.argv = [
            "build_math_kg.py",
            "--output-dir", str(self.output_dir)
        ]
        
        kg_main()
        
        # Update status
        status = self.get_status()
        self.save_status(status)
        
        print("\n✅ Knowledge graph build complete!")
    
    def clean_step(self, step: str):
        """Clean outputs for a specific step"""
        print(f"\n🧹 Cleaning step: {step}")
        
        if step == "clustering":
            files = ["clusters", "clusters_summary"]
        elif step == "extraction":
            files = ["patterns", "patterns_checkpoint"]
        elif step == "knowledge_graph":
            files = ["nodes_idea", "nodes_pattern", "nodes_domain", "nodes_paper", "kg_stats"]
        elif step == "all":
            files = list(self.files.keys())
            if "metadata" in files:
                files.remove("metadata")  # Don't delete source data
        else:
            print(f"Unknown step: {step}")
            return
        
        for file_key in files:
            if file_key in self.files:
                file_path = self.files[file_key]
                if file_path.exists():
                    file_path.unlink()
                    print(f"  ✅ Deleted: {file_path.name}")
        
        # Update status
        status = self.get_status()
        self.save_status(status)
        
        print(f"✅ Cleaned: {step}")


async def main():
    parser = argparse.ArgumentParser(description="Manage math knowledge base pipeline")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Status command
    subparsers.add_parser("status", help="Show pipeline status")
    
    # Run command
    run_parser = subparsers.add_parser("run", help="Run pipeline step")
    run_parser.add_argument(
        "--step",
        choices=["clustering", "extraction", "knowledge_graph", "database_import", "all"],
        required=True,
        help="Pipeline step to run"
    )
    run_parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from checkpoint (extraction only)"
    )
    run_parser.add_argument(
        "--n-clusters",
        type=int,
        default=60,
        help="Number of clusters (clustering only)"
    )
    
    # Clean command
    clean_parser = subparsers.add_parser("clean", help="Clean step outputs")
    clean_parser.add_argument(
        "--step",
        choices=["clustering", "extraction", "knowledge_graph", "all"],
        required=True,
        help="Step to clean"
    )
    
    args = parser.parse_args()
    
    # Get project root
    project_root = Path(__file__).parent.parent.parent
    manager = MathKBManager(project_root)
    
    if args.command == "status":
        manager.print_status()
    
    elif args.command == "run":
        if args.step == "clustering":
            await manager.run_clustering(n_clusters=args.n_clusters)
        elif args.step == "extraction":
            await manager.run_extraction(resume=args.resume)
        elif args.step == "knowledge_graph":
            await manager.run_knowledge_graph()
        elif args.step == "database_import":
            print("⚠️  Database import must be run inside Docker container")
            print("   Run: docker compose exec backend python backend/scripts/import_arxiv_papers.py \\")
            print("        --pattern-clusters output_math/pattern_clusters.jsonl")
        elif args.step == "all":
            status = manager.get_status()
            steps = status["steps"]
            
            if not steps["clustering"]["completed"]:
                await manager.run_clustering(n_clusters=args.n_clusters)
            
            if not steps["extraction"]["completed"]:
                await manager.run_extraction(resume=args.resume)
            
            if not steps["knowledge_graph"]["completed"]:
                await manager.run_knowledge_graph()
            
            print("\n✅ All steps completed!")
            print("⚠️  Database import must be run inside Docker container")
    
    elif args.command == "clean":
        manager.clean_step(args.step)
    
    else:
        parser.print_help()


if __name__ == "__main__":
    asyncio.run(main())
