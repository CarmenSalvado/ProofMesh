#!/bin/bash
# ProofMesh Scripts Runner
# Convenience wrapper for organized scripts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

show_help() {
    echo -e "${BLUE}ProofMesh Scripts Runner${NC}"
    echo ""
    echo "Usage: ./scripts/run.sh [category] [script] [args...]"
    echo ""
    echo -e "${GREEN}Categories:${NC}"
    echo "  seed       - Platform data seeding"
    echo "  kg         - Knowledge graph tools"
    echo "  arxiv      - ArXiv paper tools"
    echo ""
    echo -e "${GREEN}Examples:${NC}"
    echo "  ./scripts/run.sh seed              # Run full seeding"
    echo "  ./scripts/run.sh seed --clear      # Clear and reseed"
    echo "  ./scripts/run.sh kg build          # Build knowledge graph"
    echo "  ./scripts/run.sh kg manage         # Interactive KB manager"
    echo "  ./scripts/run.sh arxiv import      # Import arXiv papers"
    echo "  ./scripts/run.sh arxiv cluster     # Cluster papers"
    echo ""
    echo -e "${YELLOW}Or use directly:${NC}"
    echo "  python -m scripts.seed_realistic.run"
    echo "  python scripts/knowledge_graph/build_math_kg.py"
    echo "  python scripts/arxiv/import_arxiv_papers.py"
    echo ""
    echo "See README.md in each directory for full documentation."
}

case "$1" in
    seed)
        shift
        echo -e "${GREEN}→ Running platform seeding...${NC}"
        cd "$BACKEND_DIR"
        python -m scripts.seed_realistic.run "$@"
        ;;
    
    kg)
        case "$2" in
            build)
                echo -e "${GREEN}→ Building knowledge graph...${NC}"
                cd "$BACKEND_DIR"
                python scripts/knowledge_graph/build_math_kg.py "${@:3}"
                ;;
            manage)
                echo -e "${GREEN}→ Opening knowledge base manager...${NC}"
                cd "$BACKEND_DIR"
                python scripts/knowledge_graph/manage_math_kb.py "${@:3}"
                ;;
            *)
                echo -e "${RED}Unknown kg command: $2${NC}"
                echo "Available: build, manage"
                exit 1
                ;;
        esac
        ;;
    
    arxiv)
        case "$2" in
            import)
                echo -e "${GREEN}→ Importing arXiv papers...${NC}"
                cd "$BACKEND_DIR"
                python scripts/arxiv/import_arxiv_papers.py "${@:3}"
                ;;
            cluster)
                echo -e "${GREEN}→ Clustering papers...${NC}"
                cd "$BACKEND_DIR"
                python scripts/arxiv/cluster_math_papers.py "${@:3}"
                ;;
            extract)
                echo -e "${GREEN}→ Extracting patterns...${NC}"
                cd "$BACKEND_DIR"
                python scripts/arxiv/extract_pattern_summaries.py "${@:3}"
                ;;
            *)
                echo -e "${RED}Unknown arxiv command: $2${NC}"
                echo "Available: import, cluster, extract"
                exit 1
                ;;
        esac
        ;;
    
    help|--help|-h|"")
        show_help
        ;;
    
    *)
        echo -e "${RED}Unknown category: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
