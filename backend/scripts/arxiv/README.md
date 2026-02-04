# ArXiv Scripts

Scripts for importing and processing mathematical papers from arXiv.

## 📁 Files

- **import_arxiv_papers.py** - Import arXiv paper metadata
- **cluster_math_papers.py** - Cluster papers by topics
- **extract_pattern_summaries.py** - Extract research patterns

## 🚀 Usage

### Import ArXiv Papers

Download and import arXiv mathematics papers:

```bash
docker compose exec backend python scripts/arxiv/import_arxiv_papers.py
```

**What it does:**
- Queries arXiv API for mathematics papers
- Downloads metadata (title, abstract, authors, categories)
- Parses LaTeX abstracts
- Stores in `papers/arxiv_math/` organized by subject

**Options:**
```bash
# Import specific category
python scripts/arxiv/import_arxiv_papers.py --category math.AG

# Limit number of papers
python scripts/arxiv/import_arxiv_papers.py --max 1000

# Date range
python scripts/arxiv/import_arxiv_papers.py --from 2023-01-01 --to 2024-01-01
```

**Output Structure:**
```
papers/arxiv_math/
├── metadata_all.jsonl      # All paper metadata
├── math.AG/               # Algebraic Geometry
│   ├── 2301.12345.json
│   └── ...
├── math.NT/               # Number Theory
├── math.GT/               # Geometric Topology
└── ...
```

### Cluster Papers

Group papers by research topics using embeddings and clustering:

```bash
docker compose exec backend python scripts/arxiv/cluster_math_papers.py
```

**What it does:**
- Loads paper abstracts and metadata
- Generates semantic embeddings
- Applies clustering algorithms (K-means, HDBSCAN)
- Identifies research themes
- Generates cluster summaries

**Clustering Methods:**
- **K-means** - Fixed number of clusters
- **HDBSCAN** - Density-based, auto-detects cluster count
- **Hierarchical** - Creates topic hierarchy

**Output:**
```
output_math/
├── pattern_clusters.jsonl           # Cluster assignments
├── pattern_clusters_summary.json    # Cluster descriptions
└── cluster_visualization.html       # Interactive viz
```

**Cluster Information:**
- Cluster ID and size
- Representative papers
- Common keywords
- Central theme description
- Related domains

### Extract Research Patterns

Identify common research patterns across papers:

```bash
docker compose exec backend python scripts/arxiv/extract_pattern_summaries.py
```

**What it does:**
- Analyzes proof techniques
- Identifies problem formulations
- Extracts methodology patterns
- Finds recurring themes

**Patterns Extracted:**
- **Proof Techniques**: Induction, contradiction, construction, etc.
- **Problem Types**: Existence, classification, computation, etc.
- **Methodologies**: Algebraic, geometric, analytic, etc.
- **Common Structures**: Exact sequences, spectral sequences, etc.

**Output:**
```
output_math/
├── math_patterns_full.jsonl    # All patterns with examples
├── pattern_clusters.jsonl      # Grouped patterns
└── nodes_pattern.json          # Pattern knowledge graph nodes
```

## 📊 ArXiv Categories

### Mathematics Subject Classification

Papers are organized by arXiv math categories:

| Code | Subject |
|------|---------|
| math.AG | Algebraic Geometry |
| math.NT | Number Theory |
| math.GT | Geometric Topology |
| math.AT | Algebraic Topology |
| math.RT | Representation Theory |
| math.DG | Differential Geometry |
| math.CO | Combinatorics |
| math.GR | Group Theory |
| math.CT | Category Theory |
| math.FA | Functional Analysis |
| math.LO | Logic |
| math.PR | Probability |
| math.QA | Quantum Algebra |
| math.KT | K-Theory |
| math.AC | Commutative Algebra |

See full list: https://arxiv.org/archive/math

## 🔧 Configuration

### API Settings

Edit scripts to configure arXiv API:

```python
# In import_arxiv_papers.py
MAX_RESULTS = 10000
CATEGORIES = ["math.AG", "math.NT", "math.GT"]
WAIT_TIME = 3  # seconds between requests
```

### Clustering Parameters

```python
# In cluster_math_papers.py
N_CLUSTERS = 50  # for K-means
MIN_CLUSTER_SIZE = 10  # for HDBSCAN
EMBEDDING_MODEL = "allenai/specter"  # paper embeddings model
```

### Pattern Extraction

```python
# In extract_pattern_summaries.py
MIN_PATTERN_FREQUENCY = 5  # minimum occurrences
PATTERN_TYPES = ["proof", "method", "formulation"]
```

## 📝 Examples

### Import Recent Papers

```bash
# Import last year's algebraic geometry papers
python scripts/arxiv/import_arxiv_papers.py \
  --category math.AG \
  --from 2025-01-01 \
  --max 5000
```

### Cluster Specific Domain

```bash
# Cluster only algebraic geometry
python scripts/arxiv/cluster_math_papers.py --category math.AG
```

### Extract Techniques

```bash
# Extract only proof techniques
python scripts/arxiv/extract_pattern_summaries.py --pattern-type proof
```

## 📈 Analysis Workflows

### Complete Pipeline

```bash
# 1. Import papers
python scripts/arxiv/import_arxiv_papers.py

# 2. Cluster by topics
python scripts/arxiv/cluster_math_papers.py

# 3. Extract patterns
python scripts/arxiv/extract_pattern_summaries.py

# 4. Build knowledge graph
python scripts/knowledge_graph/build_math_kg.py
```

### Update Existing Data

```bash
# Import only new papers since last run
python scripts/arxiv/import_arxiv_papers.py --since-last

# Re-cluster with new papers
python scripts/arxiv/cluster_math_papers.py --incremental
```

### Domain-Specific Analysis

```bash
# Focus on one domain
DOMAIN="math.AG"
python scripts/arxiv/import_arxiv_papers.py --category $DOMAIN
python scripts/arxiv/cluster_math_papers.py --category $DOMAIN
python scripts/arxiv/extract_pattern_summaries.py --category $DOMAIN
```

## 🎯 Use Cases

### Research Discovery
- Find papers on specific topics
- Identify emerging research areas
- Track research trends over time

### Knowledge Base
- Populate knowledge graph with real papers
- Link concepts to literature
- Provide citation context

### Platform Features
- Suggest related problems from papers
- Auto-tag problems by similarity
- Generate problem descriptions from abstracts

### Education
- Find introductory papers by topic
- Build reading lists by cluster
- Identify foundational papers (high centrality)

## 🔬 Advanced Features

### Custom Embeddings

Use specialized models:

```python
# Research paper embeddings
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('allenai/specter')

# Math-specific embeddings
model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')
```

### Incremental Updates

```python
# Track last import date
LAST_IMPORT = "2024-01-01"
papers = search_arxiv(date_from=LAST_IMPORT)
```

### Citation Network

```python
# Build citation graph
def extract_citations(paper):
    # Parse references from paper
    return citation_list
    
# Add to knowledge graph as edges
```

## 📚 Data Format

### Paper Metadata (JSONL)

```json
{
  "id": "2301.12345",
  "title": "On the Cohomology of Shimura Varieties",
  "authors": ["Alice Smith", "Bob Jones"],
  "abstract": "We study...",
  "categories": ["math.AG", "math.NT"],
  "published": "2023-01-15",
  "updated": "2023-02-10",
  "doi": "10.1234/example"
}
```

### Cluster Data

```json
{
  "cluster_id": 5,
  "size": 127,
  "theme": "Étale cohomology and motives",
  "keywords": ["étale", "cohomology", "motives", "Galois"],
  "papers": ["2301.12345", "2302.23456", ...],
  "centroid": [0.1, -0.2, ...],
  "top_papers": [...]
}
```

### Pattern Data

```json
{
  "pattern_id": "proof_induction_structural",
  "type": "proof_technique",
  "name": "Structural Induction",
  "frequency": 234,
  "domains": ["math.LO", "math.CT"],
  "examples": [...]
}
```

## 🐛 Troubleshooting

**Issue: Rate limiting**
```
Error: 429 Too Many Requests
Solution: Increase WAIT_TIME between requests
```

**Issue: Memory error during clustering**
```
Solution: Process in batches or reduce embedding dimensions
```

**Issue: Missing abstracts**
```
Some papers may not have abstracts - filter them out:
papers = [p for p in papers if p.get('abstract')]
```

## 📄 See Also

- [Knowledge Graph Scripts](../knowledge_graph/README.md) - Build concept graph
- [Seed Scripts](../seed_realistic/README.md) - Generate platform data
- Main [README](../README.md) - All scripts overview

## 🔗 External Resources

- [arXiv API Docs](https://arxiv.org/help/api/)
- [arXiv Math Archive](https://arxiv.org/archive/math)
- [Mathematics Subject Classification](https://mathscinet.ams.org/msc/msc2020.html)
