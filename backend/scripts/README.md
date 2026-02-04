# Backend Scripts

Utility scripts for ProofMesh backend operations.

## 📁 Directory Structure

```
scripts/
├── seed_realistic/              # 🌱 Platform seeding system
│   ├── README.md               # Full seeding documentation
│   ├── run.py                  # Main orchestrator
│   ├── seed_users.py
│   ├── seed_teams.py
│   ├── seed_problems.py
│   ├── seed_workspaces.py
│   ├── seed_library_items.py
│   └── seed_social_activity.py
│
├── knowledge_graph/            # 🧠 Knowledge graph tools
│   ├── README.md              # KG documentation
│   ├── build_math_kg.py       # Build graph from papers
│   └── manage_math_kb.py      # Interactive KB manager
│
├── arxiv/                     # 📚 ArXiv paper tools
│   ├── README.md             # ArXiv documentation
│   ├── import_arxiv_papers.py      # Import paper metadata
│   ├── cluster_math_papers.py      # Cluster by topics
│   └── extract_pattern_summaries.py # Extract patterns
│
├── seed_platform.py          # ⚠️  DEPRECATED - redirects to seed_realistic
├── run.sh                   # 🎯 Convenience script for all modules
├── entrypoint.sh            # 🐳 Docker entrypoint
└── README.md                # This file

```

## 🚀 Quick Start

### Using Convenience Script

```bash
# Show help
./scripts/run.sh

# Seeding
./scripts/run.sh seed              # Full seeding
./scripts/run.sh seed --clear      # Clear and reseed
./scripts/run.sh seed --help       # Seeding options

# Knowledge Graph
./scripts/run.sh kg build          # Build knowledge graph
./scripts/run.sh kg manage         # Interactive KB manager

# ArXiv
./scripts/run.sh arxiv import      # Import papers
./scripts/run.sh arxiv cluster     # Cluster papers
./scripts/run.sh arxiv extract     # Extract patterns
```

### Using Make Commands

```bash
# Seeding
make seed              # Full seeding
make seed-clean        # Clear and reseed
make seed-custom       # Interactive custom seeding
```

### Using Python Directly

```bash
# Seeding
python -m scripts.seed_realistic.run

# Knowledge Graph
python scripts/knowledge_graph/build_math_kg.py
python scripts/knowledge_graph/manage_math_kb.py

# ArXiv
python scripts/arxiv/import_arxiv_papers.py
python scripts/arxiv/cluster_math_papers.py
python scripts/arxiv/extract_pattern_summaries.py
```

### Seed Realistic Data

```bash
# Full seeding (recommended)
make seed

# Clear and reseed
make seed-clean

# Custom quantities
make seed-custom
```

Or directly:
```bash
docker compose exec backend python -m scripts.seed_realistic.run
```

See [seed_realistic/README.md](seed_realistic/README.md) for full documentation.

### Knowledge Graph Operations

```bash
# Build knowledge graph from papers
docker compose exec backend python scripts/knowledge_graph/build_math_kg.py

# Interactive knowledge base manager
docker compose exec backend python scripts/knowledge_graph/manage_math_kb.py
```

See [knowledge_graph/README.md](knowledge_graph/README.md) for full documentation.

### ArXiv Operations

```bash
# Import arXiv papers metadata
docker compose exec backend python scripts/arxiv/import_arxiv_papers.py

# Cluster papers by topics
docker compose exec backend python scripts/arxiv/cluster_math_papers.py

# Extract patterns from papers
docker compose exec backend python scripts/arxiv/extract_pattern_summaries.py
```

See [arxiv/README.md](arxiv/README.md) for full documentation.

## 📖 Script Details

### 🌱 seed_realistic/
**Modular realistic platform seeding system**

Creates a fully populated ProofMesh platform with academic users, research teams, problems, workspaces, and social activity.

**Documentation:** [seed_realistic/README.md](seed_realistic/README.md)

### 🧠 knowledge_graph/
**Knowledge graph construction and management**

Builds and manages a mathematical knowledge graph from research papers, extracting concepts, theorems, and relationships.

**Scripts:**
- `build_math_kg.py` - Build graph from papers
- `manage_math_kb.py` - Interactive KB manager

**Documentation:** [knowledge_graph/README.md](knowledge_graph/README.md)

### 📚 arxiv/
**ArXiv paper import and analysis**

Import and process mathematical papers from arXiv, including clustering and pattern extraction.

**Scripts:**
- `import_arxiv_papers.py` - Download paper metadata
- `cluster_math_papers.py` - Cluster by research topics
- `extract_pattern_summaries.py` - Extract research patterns

**Documentation:** [arxiv/README.md](arxiv/README.md)

### 🐳 entrypoint.sh
**Docker Entrypoint**

Container startup script that:
1. Waits for database
2. Runs migrations
3. Starts the application

## 🔄 Migration to Modular System

The old `seed_platform.py` script has been **deprecated** in favor of the modular `seed_realistic/` system.

**Old way:**
```bash
python scripts/seed_platform.py
```

**New way:**
```bash
python -m scripts.seed_realistic.run
# or simply:
make seed
```

The old script will automatically redirect to the new system.

## 🤝 Contributing

When adding new scripts:

1. **Seeding scripts** → Add to `seed_realistic/` package
2. **Knowledge graph scripts** → Add to `knowledge_graph/`
3. **ArXiv scripts** → Add to `arxiv/`
4. **Other utilities** → Add to root `scripts/` directory
5. **Update documentation** → Update relevant README
6. **Add to Makefile** → If commonly used

### Directory Guidelines

- **seed_realistic/** - Platform data generation
- **knowledge_graph/** - KB construction and querying
- **arxiv/** - Paper import and analysis
- **Root level** - General utilities and Docker scripts

## 📝 Notes

- All scripts should be run from the **backend directory** or via Docker
- Scripts use async SQLAlchemy for database operations
- Environment variables loaded from `.env`
- Database migrations run automatically on container start

## 🆘 Help

For seeding documentation:
```bash
python -m scripts.seed_realistic.run --help
```

For general help, see main project [README.md](../../README.md)
