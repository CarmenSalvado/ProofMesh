"""
Seed realistic library items - canvas nodes with definitions, lemmas, theorems, etc.
"""
import asyncio
import random
import uuid
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.problem import Problem
from app.models.library_item import LibraryItem, LibraryItemKind, LibraryItemStatus
from app.models.canvas_block import CanvasBlock
from app.models.activity import Activity, ActivityType


# Content templates by item kind
DEFINITION_TEMPLATES = [
    "A {} $X$ is said to be **{}** if {} holds for all {}.",
    "We define the **{}** of a {} $M$ to be the {}.",
    "Let $X$ be a {}. The **{} structure** on $X$ is given by {}.",
    "A map $f: X \\to Y$ is called **{}** if {} and {}.",
]

LEMMA_TEMPLATES = [
    "If $X$ satisfies {}, then {} for all $n \\geq 0$.",
    "Let $f: X \\to Y$ be {}. Then {} commutes with {}.",
    "For any {} $M$, we have $H^k(M) \\cong {}$ when {}.",
    "Suppose {} holds. Then there exists {} such that {}.",
]

THEOREM_TEMPLATES = [
    "Let $X$ be a {} satisfying {}. Then {} if and only if {}.",
    "Suppose $M$ is a {} with {}. Then $\\dim H^*(M) = {}$.",
    "For any {} $f: X \\to Y$, we have $\\deg(f) \\leq {}$ with equality when {}.",
    "If {} and {}, then {} admits a unique {} structure.",
]

CONJECTURE_TEMPLATES = [
    "We conjecture that {} holds for all {} with {}.",
    "It is expected that the bound $\\|{}\\| \\leq {}$ is optimal.",
    "Conjecture: Every {} satisfying {} can be expressed as {}.",
    "The following generalization is expected to hold: {}.",
]

CLAIM_TEMPLATES = [
    "With high probability, {} when $n \\to \\infty$.",
    "The spectral gap $\\lambda_1 \\geq {}$ for {} graphs.",
    "We claim that {} implies {} in dimension $d \\geq 3$.",
    "It suffices to prove that {} for the special case when {}.",
]

IDEA_TEMPLATES = [
    "Use {} method to reduce to the case where {}.",
    "Apply {} technique from [Reference] to bound {}.",
    "Consider the {} filtration and use the associated spectral sequence.",
    "The key insight is that {} can be computed via {}.",
]

EXAMPLE_TEMPLATES = [
    "Consider the case where $X = {}$. Then {} and we can compute {}.",
    "When $n = {}$, we have explicitly that {}.",
    "A classical example is given by {} where {}.",
    "For $G = {}$, the {} equals {} by direct calculation.",
]

PROOF_TEMPLATES = [
    "By induction on $n$. Base case: {}. Inductive step: assume {} and show {}.",
    "Consider the exact sequence $0 \\to {} \\to {} \\to {} \\to 0$. Then {} follows from {}.",
    "Use {} to obtain {}. The result follows by {}.",
    "Standard argument using {}. Details omitted.",
]

# LaTeX formula templates
FORMULAS = [
    "H^i(X, \\mathcal{F})",
    "\\pi_n(X, x_0)",
    "\\mathrm{Ext}^i(M, N)",
    "\\mathrm{Tor}_i(M, N)",
    "\\chi(X) = \\sum (-1)^i b_i",
    "\\lambda_1(G) \\geq d - 2\\sqrt{d-1}",
    "\\|f\\|_{L^p} \\leq C \\|f\\|_{H^s}",
    "\\dim H^*(M) = 2^g",
    "\\int_M \\omega \\wedge \\omega",
    "\\mathrm{rank}(E) \\cdot c_1(L)",
]


def random_past_time(days_ago_max: int, days_ago_min: int = 0) -> datetime:
    """Generate a random datetime between days_ago_min and days_ago_max days ago."""
    days = random.randint(days_ago_min, days_ago_max)
    hours = random.randint(0, 23)
    minutes = random.randint(0, 59)
    return datetime.utcnow() - timedelta(days=days, hours=hours, minutes=minutes)


def generate_content(kind: LibraryItemKind) -> tuple[str, str | None]:
    """Generate content and formula for a library item."""
    if kind == LibraryItemKind.DEFINITION:
        content = random.choice(DEFINITION_TEMPLATES).format("space", "regular", "property P", "elements")
        formula = None
    elif kind == LibraryItemKind.LEMMA:
        content = random.choice(LEMMA_TEMPLATES).format("condition A", "property B", "morphism", "homology")
        formula = random.choice(FORMULAS)
    elif kind == LibraryItemKind.THEOREM:
        content = random.choice(THEOREM_TEMPLATES).format("manifold", "positive curvature", "volume", "constant")
        formula = random.choice(FORMULAS)
    elif kind == LibraryItemKind.PROPOSITION:
        content = random.choice(LEMMA_TEMPLATES).format("assumption", "conclusion", "continuous map", "structure")
        formula = random.choice(FORMULAS)
    elif kind == LibraryItemKind.COROLLARY:
        content = "As an immediate consequence of the main theorem, we obtain the following result. " + random.choice(LEMMA_TEMPLATES).format("hypothesis", "result", "proper", "limit")
        formula = random.choice(FORMULAS)
    elif kind == LibraryItemKind.CONJECTURE:
        content = random.choice(CONJECTURE_TEMPLATES).format("property X", "objects", "condition Y", "expression")
        formula = random.choice(FORMULAS)
    elif kind == LibraryItemKind.CLAIM:
        content = random.choice(CLAIM_TEMPLATES).format("convergence", "lower bound", "random", "assumption")
        formula = random.choice(FORMULAS)
    elif kind == LibraryItemKind.IDEA:
        content = random.choice(IDEA_TEMPLATES).format("reduction", "trivial", "approximation", "quantity")
        formula = None
    elif kind == LibraryItemKind.EXAMPLE:
        content = random.choice(EXAMPLE_TEMPLATES).format("S^n", "topology", "calculation", "cyclic group", "value")
        formula = random.choice(FORMULAS)
    elif kind == LibraryItemKind.PROOF:
        content = random.choice(PROOF_TEMPLATES).format("n=0", "holds for n", "holds for n+1", "technique", "estimate")
        formula = None
    else:
        content = "Mathematical content for this item."
        formula = random.choice(FORMULAS) if random.random() < 0.5 else None
    
    return content, formula


def generate_title(kind: LibraryItemKind, index: int) -> str:
    """Generate a title for a library item."""
    if kind == LibraryItemKind.DEFINITION:
        return random.choice([
            f"Definition of regularity",
            f"Basic structure",
            f"Key property",
            f"Fundamental concept",
        ])
    elif kind == LibraryItemKind.LEMMA:
        return f"Lemma {index + 1}"
    elif kind == LibraryItemKind.THEOREM:
        return random.choice([
            "Main Theorem",
            f"Theorem {index + 1}",
            "Key Result",
            "Classification Theorem",
        ])
    elif kind == LibraryItemKind.PROPOSITION:
        return f"Proposition {index + 1}"
    elif kind == LibraryItemKind.COROLLARY:
        return f"Corollary {index + 1}"
    elif kind == LibraryItemKind.CONJECTURE:
        return random.choice([
            "Main Conjecture",
            f"Conjecture {index + 1}",
            "Open Question",
        ])
    elif kind == LibraryItemKind.CLAIM:
        return random.choice([
            f"Claim {index + 1}",
            "Key Claim",
            "Technical Claim",
        ])
    elif kind == LibraryItemKind.IDEA:
        return random.choice([
            "Proof Strategy",
            "Key Idea",
            "Approach",
            "Reduction Step",
        ])
    elif kind == LibraryItemKind.EXAMPLE:
        return f"Example {index + 1}"
    elif kind == LibraryItemKind.PROOF:
        return "Proof Sketch"
    else:
        return f"{kind.value.title()} {index + 1}"


async def seed_library_items():
    """Seed library items (canvas nodes) for problems."""
    async with async_session_maker() as db:
        # Check if library items already exist
        result = await db.execute(select(LibraryItem))
        existing_items = result.scalars().all()
        if len(existing_items) > 100:
            print(f"✓ Already have {len(existing_items)} library items, skipping")
            return
        
        # Get all problems
        result = await db.execute(select(Problem))
        all_problems = result.scalars().all()
        
        if len(all_problems) < 10:
            print("⚠ Need problems to create library items. Run seed_problems.py first.")
            return
        
        print(f"Creating library items for {len(all_problems)} problems...")
        
        items_created = 0
        blocks_created = 0
        
        for prob_idx, problem in enumerate(all_problems):
            # Each problem gets 3-12 library items
            num_items = random.randint(3, 12)
            
            # Distribution of item kinds
            kinds_pool = (
                [LibraryItemKind.DEFINITION] * 2 +
                [LibraryItemKind.LEMMA] * 4 +
                [LibraryItemKind.THEOREM] * 2 +
                [LibraryItemKind.PROPOSITION] * 2 +
                [LibraryItemKind.CLAIM] * 2 +
                [LibraryItemKind.IDEA] * 2 +
                [LibraryItemKind.EXAMPLE] * 1 +
                [LibraryItemKind.CONJECTURE] * 1 +
                [LibraryItemKind.COROLLARY] * 1
            )
            
            problem_items = []
            
            for i in range(num_items):
                kind = random.choice(kinds_pool)
                title = generate_title(kind, i)
                content, formula = generate_content(kind)
                
                # Position on canvas (arranged in rough grid)
                row = i // 4
                col = i % 4
                x = 100 + col * 350
                y = 100 + row * 250
                
                # Add some randomness to positions
                x += random.randint(-30, 30)
                y += random.randint(-30, 30)
                
                # Status distribution: mostly verified, some proposed, few rejected
                status = random.choices(
                    [LibraryItemStatus.VERIFIED, LibraryItemStatus.PROPOSED, LibraryItemStatus.REJECTED],
                    weights=[0.7, 0.25, 0.05]
                )[0]
                
                created_at = random_past_time(180, 5)
                
                # Authors (mix of AI and human)
                if random.random() < 0.3:
                    # AI-generated
                    authors = [{"type": "ai", "model": "gemini-2.0-flash-exp"}]
                else:
                    # Human-authored
                    authors = [{
                        "type": "human",
                        "id": str(problem.author_id),
                        "name": problem.author.username if problem.author else "Unknown"
                    }]
                
                item = LibraryItem(
                    problem_id=problem.id,
                    title=title,
                    kind=kind,
                    content=content,
                    formula=formula,
                    status=status,
                    x=x,
                    y=y,
                    tags=problem.tags[:2] if problem.tags else [],
                    authors=authors,
                    dependencies=[],  # Will add later
                    created_at=created_at,
                    updated_at=created_at,
                )
                
                db.add(item)
                await db.flush()  # Get item.id
                
                problem_items.append(item)
                items_created += 1
            
            # Create dependencies between items (theorems depend on lemmas, etc.)
            for item in problem_items:
                if item.kind in [LibraryItemKind.THEOREM, LibraryItemKind.COROLLARY, LibraryItemKind.PROOF]:
                    # These depend on earlier results
                    potential_deps = [
                        it for it in problem_items
                        if it.id != item.id and it.kind in [
                            LibraryItemKind.LEMMA,
                            LibraryItemKind.PROPOSITION,
                            LibraryItemKind.DEFINITION
                        ]
                    ]
                    if potential_deps:
                        num_deps = min(random.randint(1, 3), len(potential_deps))
                        deps = random.sample(potential_deps, k=num_deps)
                        item.dependencies = [str(d.id) for d in deps]
            
            # Create 1-3 canvas blocks to group items
            num_blocks = random.randint(1, 3)
            items_per_block = len(problem_items) // num_blocks
            
            for block_idx in range(num_blocks):
                block_name = random.choice([
                    "Preliminaries",
                    "Main Results",
                    "Technical Lemmas",
                    "Applications",
                    "Proofs",
                    "Examples",
                    "Open Questions",
                ])
                
                start_idx = block_idx * items_per_block
                end_idx = start_idx + items_per_block if block_idx < num_blocks - 1 else len(problem_items)
                block_items = problem_items[start_idx:end_idx]
                
                block = CanvasBlock(
                    problem_id=problem.id,
                    name=block_name,
                    node_ids=[str(item.id) for item in block_items],
                    created_at=random_past_time(150, 10),
                    updated_at=random_past_time(50, 0),
                )
                
                db.add(block)
                blocks_created += 1
            
            # Create activity for adding items
            if problem_items and random.random() < 0.5:
                db.add(Activity(
                    user_id=problem.author_id,
                    type=ActivityType.UPDATED_PROBLEM,
                    target_id=problem.id,
                    extra_data={
                        "problem_id": str(problem.id),
                        "problem_title": problem.title,
                        "action": "added_library_items",
                        "count": len(problem_items),
                    },
                    created_at=random_past_time(100, 5),
                ))
            
            if (prob_idx + 1) % 10 == 0:
                print(f"  Processed {prob_idx + 1}/{len(all_problems)} problems...")
                await db.commit()  # Commit periodically
        
        await db.commit()
        print(f"✓ Created {items_created} library items")
        print(f"✓ Created {blocks_created} canvas blocks")


async def main():
    await seed_library_items()


if __name__ == "__main__":
    asyncio.run(main())
