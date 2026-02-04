# Realistic Platform Seeding

Modular seeding system for generating realistic ProofMesh platform data with academic users, research teams, mathematical problems, and social activity.

## 📁 Structure

```
seed_realistic/
├── __init__.py              # Package exports
├── run.py                   # Main orchestrator script
├── seed_users.py           # Generate professors/researchers
├── seed_teams.py           # Generate research teams
├── seed_problems.py        # Generate mathematical problems
├── seed_workspaces.py      # Generate workspace files
├── seed_library_items.py   # Generate canvas nodes
└── seed_social_activity.py # Generate social features
```

## 🚀 Quick Start

### Run Complete Seeding

```bash
# From backend directory
cd backend
python -m scripts.seed_realistic.run

# Or with Docker
docker exec -it proofmesh-backend-1 python -m scripts.seed_realistic.run
```

### Options

```bash
# Clear existing data and reseed
python -m scripts.seed_realistic.run --clear

# Customize quantities
python -m scripts.seed_realistic.run --users 100 --teams 30 --problems 150

# Show help
python -m scripts.seed_realistic.run --help
```

## 📊 What Gets Created

### 👥 Users (80 default)
- Professors and researchers from top universities
- Real university emails (@mit.edu, @stanford.edu, @ox.ac.uk, etc.)
- Research areas and academic bios
- Diverse international names

**Universities included:**
MIT, Stanford, Oxford, Cambridge, ETH Zürich, Princeton, Harvard, Berkeley, ENS, Imperial College, University of Tokyo, and more.

### 🏛️ Teams (25 default)
- University-based research groups
- Role hierarchy: owners, admins, members
- 3-15 members per team
- Realistic descriptions and websites

**Example teams:**
- "MIT Algebraic Geometry Group"
- "Stanford Number Theory Seminar"
- "Oxford Topology Research Group"

### 📊 Problems (120 default)
- Academic mathematical problem titles
- LaTeX descriptions with formulas
- Research area tags
- Difficulty ratings
- Fork relationships (~12% are forks)
- Team associations

**Research areas covered:**
- Algebraic Geometry
- Number Theory
- Topology
- Analysis
- Category Theory
- Representation Theory
- Differential Geometry
- Combinatorics
- Logic
- Probability
- Mathematical Physics

### 📝 Workspaces
For each problem:
- `workspace.md` - Initial workspace file
- `paper.tex` - LaTeX paper draft with TODOs (60%)
- `references.bib` - Bibliography (60%)
- `notes/research_notes.md` - Research notes (40%)
- `scratch.md` - Scratch calculations (20%)

### 🎨 Canvas Library Items
Per problem: 3-12 nodes including:
- **Definitions** - Mathematical concepts
- **Lemmas** - Supporting results
- **Theorems** - Main results
- **Propositions** - Intermediate results
- **Claims** - Unproven statements
- **Ideas** - Proof strategies
- **Examples** - Concrete instances
- **Proofs** - Proof sketches

Features:
- Visual positioning (x, y coordinates)
- Dependencies between items
- LaTeX formulas
- Status: VERIFIED (70%), PROPOSED (25%), REJECTED (5%)
- Canvas blocks for grouping

### 💬 Social Activity
- **Follows**: Each user follows 5-20 others
- **Stars**: Users star 3-15 problems
- **Discussions**: 40-60 discussions with 2-10 comments each
- **Comments**: Threaded replies
- **Activities**: Full activity logs
- **Notifications**: For follows, comments, etc.

## 🔧 Running Individual Modules

Each module can be run independently:

```bash
cd backend

# Seed only users
python -m scripts.seed_realistic.seed_users

# Seed only teams (requires users)
python -m scripts.seed_realistic.seed_teams

# Seed only problems (requires users and teams)
python -m scripts.seed_realistic.seed_problems

# And so on...
```

## 📝 Default Credentials

All seeded users have the default password:
```
proofmesh123
```

## ⚙️ Configuration

Edit the respective module files to customize:
- University lists
- Research areas
- Content templates
- Probability distributions
- Quantity ranges

## 🧹 Clearing Data

To start fresh:

```bash
python -m scripts.seed_realistic.run --clear
```

**⚠️ Warning:** This will delete ALL data from the database. Use with caution!

## 📦 Dependencies

All dependencies are included in the main `requirements.txt`:
- SQLAlchemy (async)
- FastAPI
- bcrypt (password hashing)

## 🎯 Use Cases

- **Development**: Populate local database for testing
- **Demos**: Show realistic platform usage
- **Testing**: Generate test data for features
- **Staging**: Seed staging environments

## 📖 Module Details

### seed_users.py
Generates academic users with:
- Realistic name combinations
- University-specific email domains
- Research area extraction
- Varied join dates (up to 2 years ago)

### seed_teams.py
Creates research teams by:
- Grouping users by university
- Extracting research areas from bios
- Assigning proper role hierarchy
- Setting up team descriptions

### seed_problems.py
Generates problems with:
- Template-based titles and descriptions
- LaTeX mathematical notation
- Research area tagging
- Fork relationships
- Team associations
- Activity logging

### seed_workspaces.py
Populates workspaces with:
- Initial workspace markdown
- LaTeX paper drafts with structure
- Bibliography files
- Research notes in markdown
- Scratch calculation files

### seed_library_items.py
Creates canvas nodes with:
- Multiple item types (definitions through proofs)
- Visual grid positioning
- Dependency relationships
- LaTeX formulas
- Status distribution
- Author attribution (AI/human)
- Canvas block groupings

### seed_social_activity.py
Generates social features:
- Follow graph construction
- Star distribution
- Discussion creation
- Comment threading
- Activity logging
- Notification generation

## 🤝 Contributing

To add new seeding modules:

1. Create new module in `seed_realistic/`
2. Import in `__init__.py`
3. Add to orchestrator in `run.py`
4. Update this README

## 📄 License

Part of the ProofMesh project.
