# Knowledge Graph Scripts

Scripts for building and managing the mathematical knowledge graph from research papers.

## 📁 Files

- **build_math_kg.py** - Build knowledge graph from papers
- **manage_math_kb.py** - Interactive knowledge base manager

## 🚀 Usage

### Build Knowledge Graph

Extract mathematical concepts, theorems, and relationships from papers:

```bash
# From project root
docker compose exec backend python scripts/knowledge_graph/build_math_kg.py

# Or with make (if configured)
make build-kg
```

**What it does:**
- Parses LaTeX papers from `papers/arxiv_math/`
- Extracts definitions, theorems, lemmas
- Identifies proof techniques
- Builds relationship graph
- Stores in database (`knowledge_nodes` and `knowledge_edges` tables)

**Output:**
- Knowledge nodes in database
- Statistics in `output_math/knowledge_graph_stats.json`

### Manage Knowledge Base

Interactive tool for querying and managing the knowledge base:

```bash
docker compose exec backend python scripts/knowledge_graph/manage_math_kb.py
```

**Features:**
- Query concepts by name or domain
- View relationships between nodes
- Add/edit entries manually
- Export knowledge graph data
- Statistics and analysis

**Commands:**
- `search <term>` - Search for concepts
- `show <node_id>` - Display node details
- `related <node_id>` - Show related concepts
- `stats` - Show knowledge base statistics
- `export` - Export to JSON/GraphML
- `help` - Show all commands
- `quit` - Exit

## 📊 Knowledge Graph Schema

### Node Types
- `theorem` - Mathematical theorems
- `lemma` - Supporting lemmas
- `definition` - Concept definitions
- `axiom` - Axioms and postulates
- `corollary` - Corollaries
- `proposition` - Propositions
- `proof_technique` - Proof methods
- `concept` - General concepts
- `domain` - Mathematical domains
- `paper` - Source papers
- `example` - Examples
- `counterexample` - Counterexamples

### Edge Types
- `uses` - Concept A uses concept B
- `implies` - A implies B
- `generalizes` - A generalizes B
- `specializes` - A specializes B
- `contradicts` - A contradicts B
- `proved_by` - Theorem proved by technique
- `requires` - A requires B as prerequisite
- `related` - General relationship
- `cites` - Paper citation
- `belongs_to` - Concept belongs to domain

### Node Properties
- `title` - Concept name
- `content` - Description/statement
- `formula` - LaTeX formula
- `lean_code` - Formal Lean proof
- `embedding` - Semantic vector (768-dim)
- `source` - Origin (mathlib, arxiv, user, etc.)
- `metadata` - Additional info (arXiv ID, Mathlib path)
- `confidence` - Confidence score (0-1)
- `domain` - Mathematical domain
- `tags` - Topic tags

### Edge Properties
- `weight` - Connection strength (0-1)
- `confidence` - Confidence in relationship
- `bidirectional` - Whether edge goes both ways

## 🔧 Configuration

### Data Sources

Papers are read from:
```
papers/arxiv_math/
├── math.AG/    # Algebraic Geometry
├── math.NT/    # Number Theory
├── math.GT/    # Geometric Topology
└── ...
```

### Output Directory

Results are written to:
```
output_math/
├── knowledge_graph_stats.json
├── nodes_*.json
└── edges_*.json
```

### Database Tables

Knowledge graph stored in:
- `knowledge_nodes` - Concept nodes
- `knowledge_edges` - Relationships

## 📝 Examples

### Building from Specific Domain

```python
# In build_math_kg.py, modify:
DOMAINS_TO_PROCESS = ["math.AG", "math.NT"]  # Only algebraic geometry and number theory
```

### Querying the Graph

```bash
$ python scripts/knowledge_graph/manage_math_kb.py
> search cohomology
Found 15 nodes matching 'cohomology'
1. Étale Cohomology (definition)
2. Sheaf Cohomology (concept)
...

> show 1
Node: Étale Cohomology
Type: definition
Domain: Algebraic Geometry
Content: ...
Formula: H^i_ét(X, ℤ_ℓ)
Related: 5 incoming, 8 outgoing edges
```

### Exporting Data

```bash
> export json nodes_ag.json --domain "algebraic geometry"
Exported 234 nodes to nodes_ag.json

> export graphml kg.graphml
Exported full graph to kg.graphml (can be opened in Gephi, Cytoscape)
```

## 🎯 Use Cases

1. **Research Assistance**
   - Find related concepts
   - Discover proof techniques
   - Identify prerequisites

2. **Education**
   - Build learning paths
   - Understand concept relationships
   - Find examples and counterexamples

3. **AI Training**
   - Train theorem proving models
   - Generate synthetic proofs
   - Concept embeddings

4. **Platform Features**
   - Suggest related problems
   - Auto-complete mathematical concepts
   - Semantic search

## ⚙️ Advanced Options

### Custom Extractors

Add custom extraction logic in `build_math_kg.py`:

```python
def extract_custom_patterns(text):
    """Extract domain-specific patterns."""
    # Your extraction logic
    pass
```

### Embedding Models

Configure embedding model:

```python
# Use different model for semantic embeddings
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('allenai/specter')
```

### Graph Algorithms

Run graph analysis:

```python
# In manage_math_kb.py
> analyze centrality
Computing betweenness centrality...
Top 10 central concepts:
1. Cohomology Theory (0.85)
2. Exact Sequence (0.78)
...
```

## 📚 References

- Papers: arXiv.org mathematical preprints
- Formalization: Lean 4 Mathlib
- Embeddings: sentence-transformers

## 🤝 Contributing

To extend the knowledge graph system:

1. Add new node/edge types to `app/models/knowledge_node.py`
2. Update extractors in `build_math_kg.py`
3. Add query commands in `manage_math_kb.py`
4. Update this documentation

## 🐛 Troubleshooting

**Issue: Papers not found**
```bash
# Check papers directory
ls papers/arxiv_math/math.AG/ | wc -l
# Should show paper count
```

**Issue: Database connection error**
```bash
# Check if postgres is running
docker compose ps postgres
# Verify DATABASE_URL in .env
```

**Issue: Out of memory during build**
```bash
# Process domains incrementally
python scripts/knowledge_graph/build_math_kg.py --domain math.AG
python scripts/knowledge_graph/build_math_kg.py --domain math.NT
```

## 📄 See Also

- [ArXiv Scripts](../arxiv/README.md) - Paper import and clustering
- [Seed Scripts](../seed_realistic/README.md) - Platform data seeding
- Main [README](../README.md) - All scripts overview
