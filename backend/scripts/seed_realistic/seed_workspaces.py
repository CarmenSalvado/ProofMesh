"""
Seed realistic workspace files - papers in progress, notes, bibliography.
"""
import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.problem import Problem
from app.models.user import User
from app.models.workspace_file import WorkspaceFile, WorkspaceFileType


# LaTeX paper templates
PAPER_INTRO_TEMPLATES = [
    """\\section{{Introduction}}

The study of {} has been a central theme in modern {}. In this paper, we investigate {}, building upon the foundational work of [Author1] and recent advances in [Author2].

Our main results can be summarized as follows:

\\begin{{theorem}}
Let $X$ be a {}. Then {} if and only if {}.
\\end{{theorem}}

The proof relies on a combination of {} techniques and novel applications of {}. 

\\subsection{{Background and Motivation}}

Recent work by [Researcher] has shown that {}. This raises the natural question: can we extend these results to {}? 

\\textbf{{TODO:}} Complete literature review section.
\\textbf{{TODO:}} Add more precise statement of main theorem.
""",
    """\\section{{Introduction}}

In recent years, there has been significant interest in understanding {}. The goal of this paper is to establish {}, thereby resolving a question posed by [Author] in [Year].

\\subsection{{Main Results}}

Our principal contribution is the following:

\\begin{{theorem}}\\label{{thm:main}}
Suppose $M$ is a {} satisfying {}. Then there exists {} such that $$.
\\end{{theorem}}

The significance of Theorem~\\ref{{thm:main}} lies in its applications to {}. As a corollary, we obtain:

\\begin{{corollary}}
{} implies {}.
\\end{{corollary}}

\\subsection{{Outline}}

The paper is organized as follows. Section 2 reviews preliminary material on {}. Section 3 contains the proof of the main theorem. Section 4 discusses applications and open problems.

\\textbf{{NOTE:}} Section 3 still needs significant work.
""",
]

PAPER_PROOF_TEMPLATES = [
    """\\section{{Proof of Main Theorem}}

We begin with a key lemma.

\\begin{{lemma}}\\label{{lem:key}}
If $X$ satisfies {}, then {} for all $n \\geq N_0$.
\\end{{lemma}}

\\begin{{proof}}
The proof proceeds by {}. Consider the {} and note that {}.

\\textbf{{TODO:}} Fill in details of the induction step.
\\textbf{{TODO:}} Check constants.
\\end{{proof}}

\\begin{{proof}}[Proof of Theorem~\\ref{{thm:main}}]
By Lemma~\\ref{{lem:key}}, it suffices to show that {}. 

\\textbf{{INCOMPLETE:}} Need to handle the boundary case.
\\textbf{{QUESTION:}} Does this argument work for non-compact $X$?
\\end{{proof}}
""",
    """\\section{{Technical Lemmas}}

We establish several technical results needed for the main proof.

\\begin{{lemma}}
Let $f: X \\to Y$ be a {}. Then {} commutes with {}.
\\end{{lemma}}

\\begin{{proof}}
Standard diagram chase. Details omitted.
\\end{{proof}}

\\begin{{proposition}}
Assume {}. Then the spectral sequence $E_2^{{p,q}} = {}$ converges to {}.
\\end{{proposition}}

\\begin{{proof}}[Sketch]
Use the filtration induced by {}. The convergence follows from [Reference].
\\textbf{{TODO:}} Make this argument more rigorous.
\\end{{proof}}

\\section{{Main Proof}}

\\textbf{{DRAFT VERSION - NOT FOR CIRCULATION}}

Combining the above lemmas with the technique from [Paper], we can now prove the main theorem...
""",
]

NOTES_TEMPLATES = [
    """# Research Notes - {}

## Ideas
- Try using {} method to bound {}
- Check if this generalizes to the {} case
- Compare with results in [Paper]

## Computations
$$
\\begin{{align}}
{} &= {} \\\\
&\\leq {} \\\\
&= {} + O({})
\\end{{align}}
$$

**Question:** Can we improve the error term?

## References to check
- [Author1] - section 4.2 on {}
- [Author2] - related but different approach
- [Author3] - possible connection to {}

## Next steps
1. Finish computation in section 2
2. Verify lemma 3.5 holds for {}
3. Write up introduction
4. Run by collaborators
""",
    """# Notes on {}

## Meeting with {} - {}

Discussed:
- Approach using {} seems promising
- Need to check compatibility with {}
- Potential issue with {} - may need additional hypothesis

## Open questions
1. Does {} hold in general or only for {}?
2. What happens when {}?
3. Connection to [OtherWork]?

## Calculations

Let $X$ be a {}. Then:
$$
H^*(X) \\cong \\bigoplus_{{i=0}}^n H^i(X)
$$

Need to compute this explicitly for small cases.

**TODO:** 
- [ ] Check calculation above
- [ ] Look for counterexamples
- [ ] Email [Colleague] about this
""",
]

BIBLIOGRAPHY_TEMPLATE = """@article{{author2023,
  author = {{Author, A. and Coauthor, B.}},
  title = {{On the structure of {}}},
  journal = {{Journal of {}}},
  year = {{2023}},
  volume = {{45}},
  pages = {{123--156}}
}}

@book{{researcher2022,
  author = {{Researcher, C.}},
  title = {{Introduction to {}}},
  publisher = {{Academic Press}},
  year = {{2022}}
}}

@article{{mathematician2021,
  author = {{Mathematician, D.}},
  title = {{A new approach to {}}},
  journal = {{Advances in Mathematics}},
  year = {{2021}},
  volume = {{389}},
  pages = {{107901}}
}}

@misc{{preprint2024,
  author = {{Scholar, E. and Expert, F.}},
  title = {{Recent progress on {}}},
  year = {{2024}},
  eprint = {{arXiv:2401.12345}}
}}
"""

# File content generators
def generate_workspace_markdown(title: str, description: str) -> str:
    """Generate initial workspace.md content."""
    return f"""# {title}

## Problem Statement

{description}

## Approach

Working on this problem using...

## Progress

- [ ] Set up basic framework
- [ ] Prove preliminary lemmas
- [ ] Main theorem
- [ ] Write up results

## Notes

...
"""


def generate_paper_content(problem_title: str, tags: list[str]) -> str:
    """Generate realistic LaTeX paper draft."""
    area = "mathematics"
    if "algebraic-geometry" in tags:
        area = "algebraic geometry"
    elif "number-theory" in tags:
        area = "number theory"
    elif "topology" in tags:
        area = "topology"
    elif "analysis" in tags:
        area = "analysis"
    
    intro = random.choice(PAPER_INTRO_TEMPLATES)
    proof_section = random.choice(PAPER_PROOF_TEMPLATES)
    
    content = f"""\\documentclass{{article}}
\\usepackage{{amsmath, amsthm, amssymb}}

\\title{{{problem_title}}}
\\author{{[Author Names]}}
\\date{{\\today}}

\\newtheorem{{theorem}}{{Theorem}}
\\newtheorem{{lemma}}[theorem]{{Lemma}}
\\newtheorem{{corollary}}[theorem]{{Corollary}}
\\newtheorem{{proposition}}[theorem]{{Proposition}}

\\begin{{document}}

\\maketitle

\\begin{{abstract}}
We study {{}} in the context of {area}. Our main result establishes {{}} under certain conditions.
\\textbf{{DRAFT - Abstract needs revision}}
\\end{{abstract}}

{intro}

{proof_section}

\\section{{Applications}}

\\textbf{{TODO:}} Add applications section.

\\section{{Open Problems}}

Several questions remain open:
\\begin{{enumerate}}
\\item Does the result hold without the {{}} assumption?
\\item Can the bound be improved?
\\item What happens in higher dimensions?
\\end{{enumerate}}

\\bibliographystyle{{alpha}}
\\bibliography{{references}}

\\end{{document}}
"""
    return content


def generate_research_notes(problem_title: str, author_name: str) -> str:
    """Generate research notes."""
    template = random.choice(NOTES_TEMPLATES)
    date = datetime.utcnow().strftime("%Y-%m-%d")
    return template.format(
        problem_title,
        author_name,
        date,
        "...",
        "...",
        "...",
        "...",
        "...",
        "...",
        "...",
        "...",
        "...",
        "...",
        "...",
        "...",
        "...",
        "...",
    )


def random_past_time(days_ago_max: int, days_ago_min: int = 0) -> datetime:
    """Generate a random datetime between days_ago_min and days_ago_max days ago."""
    days = random.randint(days_ago_min, days_ago_max)
    hours = random.randint(0, 23)
    minutes = random.randint(0, 59)
    return datetime.utcnow() - timedelta(days=days, hours=hours, minutes=minutes)


async def seed_workspaces():
    """Seed workspace files for problems."""
    async with async_session_maker() as db:
        # Check if workspace files already exist (beyond initial workspace.md)
        result = await db.execute(
            select(WorkspaceFile).where(WorkspaceFile.path != "workspace.md")
        )
        existing_files = result.scalars().all()
        if len(existing_files) > 50:
            print(f"✓ Already have {len(existing_files)} workspace files, skipping")
            return
        
        # Get all problems
        result = await db.execute(select(Problem))
        all_problems = result.scalars().all()

        result = await db.execute(select(User))
        all_users = result.scalars().all()
        usernames_by_id = {user.id: user.username for user in all_users}
        
        if len(all_problems) < 10:
            print("⚠ Need problems to create workspace files. Run seed_problems.py first.")
            return
        
        print(f"Creating workspace files for {len(all_problems)} problems...")
        
        files_created = 0
        
        for i, problem in enumerate(all_problems):
            # Check if workspace.md exists
            result = await db.execute(
                select(WorkspaceFile)
                .where(WorkspaceFile.problem_id == problem.id)
                .where(WorkspaceFile.path == "workspace.md")
            )
            workspace_md = result.scalar_one_or_none()
            
            if not workspace_md:
                # Create workspace.md
                workspace_md = WorkspaceFile(
                    problem_id=problem.id,
                    path="workspace.md",
                    parent_path="",
                    type=WorkspaceFileType.FILE,
                    content=generate_workspace_markdown(problem.title, problem.description or ""),
                    format="markdown",
                    mimetype="text/markdown",
                    created_at=problem.created_at,
                    updated_at=random_past_time(30, 0),
                )
                db.add(workspace_md)
                files_created += 1
            
            # 60% of problems get a paper draft
            if random.random() < 0.6:
                paper_content = generate_paper_content(problem.title, problem.tags or [])
                created_at = random_past_time(180, 10)
                
                db.add(WorkspaceFile(
                    problem_id=problem.id,
                    path="paper.tex",
                    parent_path="",
                    type=WorkspaceFileType.FILE,
                    content=paper_content,
                    format="latex",
                    mimetype="application/x-latex",
                    created_at=created_at,
                    updated_at=random_past_time(30, 0),
                ))
                files_created += 1
                
                # Add bibliography
                bib_content = BIBLIOGRAPHY_TEMPLATE.format(
                    problem.tags[0] if problem.tags else "mathematics",
                    problem.tags[0] if problem.tags else "Mathematics",
                    problem.tags[0] if problem.tags else "mathematics",
                    problem.tags[0] if problem.tags else "mathematics",
                    problem.tags[0] if problem.tags else "mathematics",
                )
                db.add(WorkspaceFile(
                    problem_id=problem.id,
                    path="references.bib",
                    parent_path="",
                    type=WorkspaceFileType.FILE,
                    content=bib_content,
                    format="bibtex",
                    mimetype="text/x-bibtex",
                    created_at=created_at,
                    updated_at=created_at,
                ))
                files_created += 1
            
            # 40% get research notes
            if random.random() < 0.4:
                # Create notes directory
                db.add(WorkspaceFile(
                    problem_id=problem.id,
                    path="notes",
                    parent_path="",
                    type=WorkspaceFileType.DIRECTORY,
                    content=None,
                    format=None,
                    mimetype=None,
                    created_at=random_past_time(200, 20),
                    updated_at=random_past_time(50, 0),
                ))
                
                notes_content = generate_research_notes(
                    problem.title,
                    usernames_by_id.get(problem.author_id, "Unknown")
                )
                db.add(WorkspaceFile(
                    problem_id=problem.id,
                    path="notes/research_notes.md",
                    parent_path="notes",
                    type=WorkspaceFileType.FILE,
                    content=notes_content,
                    format="markdown",
                    mimetype="text/markdown",
                    created_at=random_past_time(150, 5),
                    updated_at=random_past_time(20, 0),
                ))
                files_created += 2
            
            # 20% get scratch calculations
            if random.random() < 0.2:
                scratch = f"""# Scratch Calculations

## Attempt 1
$$
\\sum_{{k=1}}^n k^2 = \\frac{{n(n+1)(2n+1)}}{{6}}
$$

**Issue:** This doesn't generalize to the case we need.

## Attempt 2
Try using generating functions...

$$
F(x) = \\sum_{{n=0}}^\\infty a_n x^n
$$

**TODO:** Complete this calculation.
"""
                db.add(WorkspaceFile(
                    problem_id=problem.id,
                    path="scratch.md",
                    parent_path="",
                    type=WorkspaceFileType.FILE,
                    content=scratch,
                    format="markdown",
                    mimetype="text/markdown",
                    created_at=random_past_time(100, 5),
                    updated_at=random_past_time(10, 0),
                ))
                files_created += 1
            
            if (i + 1) % 20 == 0:
                print(f"  Processed {i + 1}/{len(all_problems)} problems...")
                await db.commit()  # Commit periodically
        
        await db.commit()
        print(f"✓ Created {files_created} workspace files")


async def main():
    await seed_workspaces()


if __name__ == "__main__":
    asyncio.run(main())
