"""
Seed realistic mathematical problems with academic content.
"""
import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.user import User
from app.models.problem import Problem, ProblemVisibility, ProblemDifficulty
from app.models.team import Team, TeamMember, TeamProblem
from app.models.activity import Activity, ActivityType


# Problem templates by research area
PROBLEM_TEMPLATES = {
    "algebraic geometry": [
        ("On the Étale Cohomology of {}", "Investigate étale cohomology groups H^i_ét(X, ℤ_ℓ) for {} varieties over finite fields.", ["algebraic-geometry", "cohomology", "etale"]),
        ("Moduli Spaces of {} Bundles", "Study the geometry and compactification of moduli spaces M_{} of vector bundles on algebraic varieties.", ["algebraic-geometry", "moduli", "bundles"]),
        ("Derived Categories and {}", "Explore derived equivalences and stability conditions on {} using Bridgeland stability.", ["algebraic-geometry", "derived", "categorical"]),
        ("Hodge Theory for {}", "Compute Hodge structures and mixed Hodge theory for {} with applications to rationality.", ["algebraic-geometry", "hodge", "motives"]),
        ("Intersection Theory on {}", "Study intersection products and Chern classes on {} using Chow groups and K-theory.", ["algebraic-geometry", "intersection", "chow"]),
    ],
    "number theory": [
        ("On the Distribution of {} in Arithmetic Progressions", "Analyze the asymptotic distribution of {} in arithmetic progressions using L-function methods.", ["number-theory", "primes", "l-functions"]),
        ("Diophantine Equations of Type {}", "Study integer solutions to {} equations using height bounds and descent arguments.", ["number-theory", "diophantine", "heights"]),
        ("Arithmetic Geometry of {} Curves", "Investigate rational points and Mordell-Weil groups for {} curves over number fields.", ["number-theory", "arithmetic-geometry", "curves"]),
        ("Special Values of {} L-functions", "Compute and relate special values of L-functions associated to {} using modular forms.", ["number-theory", "l-functions", "modular"]),
        ("Galois Representations and {}", "Study Galois representations attached to {} and their modularity properties.", ["number-theory", "galois", "representations"]),
    ],
    "topology": [
        ("Homotopy Groups of {}", "Compute stable and unstable homotopy groups π_n({}) using spectral sequences.", ["topology", "homotopy", "spectral-sequences"]),
        ("Knot Invariants from {}", "Develop new knot invariants using {} theory and establish their categorification.", ["topology", "knot-theory", "invariants"]),
        ("Homology of {} Spaces", "Calculate homology groups H_*({}) and their operations using cellular methods.", ["topology", "homology", "cellular"]),
        ("Fiber Bundles and {}", "Study the classification of {} fiber bundles using characteristic classes and obstruction theory.", ["topology", "bundles", "characteristic-classes"]),
        ("Manifold Topology of {}", "Investigate the topology and smooth structures on {} manifolds.", ["topology", "manifolds", "smooth"]),
    ],
    "analysis": [
        ("Spectral Theory of {} Operators", "Analyze spectrum and spectral measures for {} operators on Hilbert spaces.", ["analysis", "spectral", "operators"]),
        ("Regularity of Solutions to {}", "Prove regularity estimates for weak solutions to {} partial differential equations.", ["analysis", "pde", "regularity"]),
        ("Harmonic Analysis on {}", "Develop Fourier analysis and singular integrals on {} spaces.", ["analysis", "harmonic", "fourier"]),
        ("Convergence of {} Methods", "Establish convergence rates for {} approximation schemes.", ["analysis", "approximation", "convergence"]),
        ("Functional Inequalities in {}", "Prove Sobolev, Poincaré, and logarithmic {} inequalities.", ["analysis", "functional", "inequalities"]),
    ],
    "category theory": [
        ("Higher Categories and {}", "Develop the theory of (∞,1)-categories for {} using quasi-categories.", ["category-theory", "higher-categories", "infinity"]),
        ("Topoi and {} Logic", "Study Grothendieck topoi with {} internal logic and forcing.", ["category-theory", "topos", "logic"]),
        ("Monoidal Structure on {}", "Construct and classify monoidal structures on {} categories.", ["category-theory", "monoidal", "tensor"]),
        ("Adjunctions in {}", "Establish adjoint functor theorems for {} and applications.", ["category-theory", "adjunctions", "limits"]),
        ("Categorical {} Theory", "Develop {} theory using categorical methods and universal properties.", ["category-theory", "universal", "abstract"]),
    ],
    "representation theory": [
        ("Representations of {} Groups", "Classify irreducible representations of {} Lie groups and their characters.", ["representation-theory", "lie-groups", "characters"]),
        ("Quantum Groups and {}", "Study representations of quantum groups U_q({}) at roots of unity.", ["representation-theory", "quantum", "deformation"]),
        ("Geometric Representation Theory of {}", "Use geometric methods to study {} representations via perverse sheaves.", ["representation-theory", "geometric", "sheaves"]),
        ("Character Theory for {}", "Develop character formulas for {} using combinatorial methods.", ["representation-theory", "characters", "combinatorial"]),
        ("Branching Rules for {}", "Compute branching rules for restriction of {} representations.", ["representation-theory", "branching", "restriction"]),
    ],
    "differential geometry": [
        ("Ricci Flow on {} Manifolds", "Study long-time behavior of Ricci flow on {} manifolds.", ["differential-geometry", "ricci-flow", "geometric-analysis"]),
        ("Minimal Surfaces in {}", "Classify minimal and CMC surfaces in {} ambient spaces.", ["differential-geometry", "minimal", "cmc"]),
        ("Kähler Geometry of {}", "Investigate Kähler-Einstein metrics on {} complex manifolds.", ["differential-geometry", "kahler", "complex"]),
        ("Gauge Theory and {}", "Apply Yang-Mills and Seiberg-Witten theory to {} manifolds.", ["differential-geometry", "gauge", "yang-mills"]),
        ("Curvature Flows on {}", "Analyze mean curvature flow and other geometric flows on {}.", ["differential-geometry", "flows", "curvature"]),
    ],
    "combinatorics": [
        ("Extremal Problems for {} Graphs", "Determine extremal numbers for {} graph properties using probabilistic methods.", ["combinatorics", "extremal", "graph-theory"]),
        ("Ramsey Theory for {}", "Establish Ramsey numbers R({}, {}) using constructive methods.", ["combinatorics", "ramsey", "colorings"]),
        ("Algebraic Methods in {} Combinatorics", "Apply polynomial method to {} combinatorial problems.", ["combinatorics", "algebraic", "polynomial"]),
        ("Random {} Structures", "Analyze threshold phenomena in random {} using probabilistic techniques.", ["combinatorics", "random", "probabilistic"]),
        ("Enumerative Combinatorics of {}", "Count and classify {} objects using generating functions.", ["combinatorics", "enumerative", "generating-functions"]),
    ],
    "logic": [
        ("Model Theory of {}", "Study definability and quantifier elimination in {} structures.", ["logic", "model-theory", "definability"]),
        ("Set-Theoretic {} Principles", "Investigate consequences of {} axioms in ZFC and forcing extensions.", ["logic", "set-theory", "forcing"]),
        ("Computability of {}", "Analyze Turing degrees and computability properties of {} functions.", ["logic", "computability", "turing"]),
        ("Proof Theory for {} Logic", "Develop proof systems and normalization for {} logic.", ["logic", "proof-theory", "normalization"]),
        ("Descriptive Set Theory of {}", "Study Borel and projective hierarchies for {} sets.", ["logic", "descriptive", "borel"]),
    ],
    "probability": [
        ("Random Walks on {} Graphs", "Analyze mixing time and cutoff for random walks on {} graphs.", ["probability", "random-walks", "mixing"]),
        ("Percolation on {} Lattices", "Study critical exponents and phase transitions for {} percolation.", ["probability", "percolation", "critical"]),
        ("Stochastic Processes in {}", "Model {} phenomena using Markov chains and martingales.", ["probability", "stochastic", "markov"]),
        ("Large Deviations for {}", "Prove large deviation principles for {} random variables.", ["probability", "large-deviations", "concentration"]),
        ("Ergodic Theory of {}", "Study ergodic properties of {} dynamical systems.", ["probability", "ergodic", "dynamical"]),
    ],
    "mathematical physics": [
        ("Quantum Field Theory on {}", "Construct QFT on {} spacetimes using algebraic methods.", ["math-physics", "qft", "algebraic"]),
        ("String Compactification on {}", "Study string theory compactified on {} Calabi-Yau manifolds.", ["math-physics", "string", "calabi-yau"]),
        ("Integrable Systems and {}", "Analyze integrability of {} using Lax pairs and Bethe ansatz.", ["math-physics", "integrable", "lax"]),
        ("Statistical Mechanics of {}", "Compute partition functions for {} spin systems.", ["math-physics", "statistical", "spin"]),
        ("Topological Invariants from {}", "Extract topological invariants using {} quantum field theories.", ["math-physics", "topological", "invariants"]),
    ],
}

# Specific mathematical objects to fill templates
MATH_OBJECTS = {
    "algebraic geometry": ["Shimura", "abelian", "Fano", "toric", "K3", "Calabi-Yau"],
    "number theory": ["primes", "elliptic", "hyperelliptic", "abelian", "modular"],
    "topology": ["spheres", "loop spaces", "classifying", "configuration", "symmetric products"],
    "analysis": ["Schrödinger", "elliptic", "parabolic", "hyperbolic", "nonlinear"],
    "category theory": ["presheaf", "enriched", "2-", "derived", "stable"],
    "representation theory": ["reductive", "semi-simple", "affine", "GL(n)", "SL(2)"],
    "differential geometry": ["Einstein", "Kähler", "Riemannian", "4-", "symplectic"],
    "combinatorics": ["planar", "k-uniform", "expander", "sparse", "dense"],
    "logic": ["algebraically closed", "o-minimal", "large cardinal", "intuitionistic", "modal"],
    "probability": ["Cayley", "random regular", "Erdős-Rényi", "bond", "site"],
    "mathematical physics": ["curved", "Minkowski", "anti-de Sitter", "Ising", "Heisenberg"],
}


def random_past_time(days_ago_max: int, days_ago_min: int = 0) -> datetime:
    """Generate a random datetime between days_ago_min and days_ago_max days ago."""
    days = random.randint(days_ago_min, days_ago_max)
    hours = random.randint(0, 23)
    minutes = random.randint(0, 59)
    return datetime.utcnow() - timedelta(days=days, hours=hours, minutes=minutes)


async def seed_problems(num_problems: int = 120):
    """Seed realistic mathematical problems."""
    async with async_session_maker() as db:
        # Check if problems already exist
        result = await db.execute(select(Problem))
        existing_problems = result.scalars().all()
        if len(existing_problems) > 20:
            print(f"✓ Already have {len(existing_problems)} problems, skipping problem seeding")
            return
        
        # Get all users and teams
        result = await db.execute(select(User))
        all_users = result.scalars().all()
        
        result = await db.execute(select(Team))
        all_teams = result.scalars().all()
        
        if len(all_users) < 10:
            print("⚠ Need at least 10 users to create problems. Run seed_users.py first.")
            return
        
        print(f"Creating {num_problems} realistic mathematical problems...")
        
        problems_created = []
        
        for i in range(num_problems):
            # Pick random research area
            area = random.choice(list(PROBLEM_TEMPLATES.keys()))
            template_title, template_desc, tags = random.choice(PROBLEM_TEMPLATES[area])
            math_obj = random.choice(MATH_OBJECTS[area])
            
            # Fill template
            title = template_title.format(math_obj)
            description = template_desc.format(math_obj, math_obj, math_obj)
            
            # Pick author
            author = random.choice(all_users)
            
            # Assign difficulty
            difficulty = random.choices(
                [ProblemDifficulty.EASY, ProblemDifficulty.MEDIUM, ProblemDifficulty.HARD, None],
                weights=[0.2, 0.4, 0.3, 0.1],  # Most are medium, some hard, few easy, some unrated
            )[0]
            
            # Visibility (90% public)
            visibility = random.choices(
                [ProblemVisibility.PUBLIC, ProblemVisibility.PRIVATE],
                weights=[0.9, 0.1]
            )[0]
            
            created_at = random_past_time(365, 1)
            
            problem = Problem(
                title=title,
                description=description,
                author_id=author.id,
                visibility=visibility,
                difficulty=difficulty,
                tags=tags,
                created_at=created_at,
                updated_at=created_at,
            )
            
            db.add(problem)
            await db.flush()  # Get problem.id
            
            problems_created.append(problem)
            
            # Create activity
            db.add(Activity(
                user_id=author.id,
                type=ActivityType.CREATED_PROBLEM,
                target_id=problem.id,
                extra_data={"problem_id": str(problem.id), "problem_title": problem.title},
                created_at=created_at,
            ))
            
            if (i + 1) % 20 == 0:
                print(f"  Created {i + 1}/{num_problems} problems...")
        
        await db.commit()
        print(f"✓ Created {len(problems_created)} problems")
        
        # Now associate some problems with teams
        print("Associating problems with teams...")
        
        team_associations = 0
        for team in all_teams:
            # Get team members
            result = await db.execute(
                select(TeamMember).where(TeamMember.team_id == team.id)
            )
            team_members = result.scalars().all()
            member_ids = {tm.user_id for tm in team_members}
            
            # Find problems by team members
            team_problems = [p for p in problems_created if p.author_id in member_ids]
            
            # Associate 1-5 problems with this team
            num_to_associate = min(random.randint(1, 5), len(team_problems))
            selected_problems = random.sample(team_problems, k=num_to_associate)
            
            for problem in selected_problems:
                db.add(TeamProblem(
                    team_id=team.id,
                    problem_id=problem.id,
                    added_by_id=problem.author_id,
                    added_at=random_past_time(180, 10),
                ))
                team_associations += 1
        
        await db.commit()
        print(f"✓ Created {team_associations} team-problem associations")
        
        # Create some forked problems (10-15% of problems)
        print("Creating forked problems...")
        num_forks = int(len(problems_created) * 0.12)
        forks_created = 0
        
        for _ in range(num_forks):
            original = random.choice(problems_created)
            forker = random.choice([u for u in all_users if u.id != original.author_id])
            
            fork_title = f"{original.title} (Extended)"
            fork_desc = f"Building on work from {original.author.username}: {original.description}"
            
            created_at = random_past_time(180, 1)
            
            fork = Problem(
                title=fork_title,
                description=fork_desc,
                author_id=forker.id,
                visibility=original.visibility,
                difficulty=original.difficulty,
                tags=original.tags,
                fork_of=original.id,
                created_at=created_at,
                updated_at=created_at,
            )
            
            db.add(fork)
            await db.flush()
            
            db.add(Activity(
                user_id=forker.id,
                type=ActivityType.FORKED_PROBLEM,
                target_id=fork.id,
                extra_data={
                    "problem_id": str(fork.id),
                    "problem_title": fork.title,
                    "original_id": str(original.id),
                },
                created_at=created_at,
            ))
            
            forks_created += 1
        
        await db.commit()
        print(f"✓ Created {forks_created} forked problems")


async def main():
    await seed_problems(120)


if __name__ == "__main__":
    asyncio.run(main())
