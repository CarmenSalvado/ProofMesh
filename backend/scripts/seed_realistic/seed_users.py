"""
Seed realistic users - professors and researchers from real universities.
"""
import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.user import User
from app.services.auth import get_password_hash

DEMO_EMAIL = "demo@proofmesh.app"
DEMO_USERNAME = "lucia_mora"
DEMO_PASSWORD = "proofmesh-demo"
DEMO_BIO = "Collaborative mathematician exploring conjectures and formal proofs on ProofMesh."


# Real universities with their locations
UNIVERSITIES = [
    "Massachusetts Institute of Technology",
    "Stanford University",
    "University of Oxford",
    "University of Cambridge",
    "ETH Zürich",
    "Princeton University",
    "Harvard University",
    "University of California, Berkeley",
    "École Normale Supérieure",
    "Imperial College London",
    "University of Tokyo",
    "Technion - Israel Institute of Technology",
    "University of Toronto",
    "University of Michigan",
    "Cornell University",
    "Columbia University",
    "Yale University",
    "University of Chicago",
    "Caltech",
    "Carnegie Mellon University",
    "University of Bonn",
    "University of Paris",
    "KU Leuven",
    "Australian National University",
    "Tsinghua University",
    "IIT Bombay",
    "Seoul National University",
    "University of São Paulo",
]

# Academic titles
TITLES = ["Prof.", "Dr.", ""]

# Research areas for bios
RESEARCH_AREAS = [
    ("algebraic geometry", ["moduli spaces", "derived categories", "Hodge theory", "intersection theory"]),
    ("number theory", ["primes", "L-functions", "arithmetic geometry", "Diophantine equations"]),
    ("topology", ["algebraic topology", "geometric topology", "knot theory", "homotopy theory"]),
    ("analysis", ["harmonic analysis", "functional analysis", "operator theory", "PDEs"]),
    ("category theory", ["higher categories", "topos theory", "homotopy type theory", "categorical logic"]),
    ("representation theory", ["Lie groups", "quantum groups", "geometric representation theory", "character theory"]),
    ("differential geometry", ["Ricci flow", "minimal surfaces", "Kähler geometry", "gauge theory"]),
    ("combinatorics", ["graph theory", "extremal combinatorics", "algebraic combinatorics", "Ramsey theory"]),
    ("logic", ["model theory", "set theory", "computability", "proof theory"]),
    ("probability", ["stochastic processes", "random graphs", "percolation", "ergodic theory"]),
    ("mathematical physics", ["quantum field theory", "string theory", "statistical mechanics", "integrable systems"]),
    ("dynamical systems", ["chaos theory", "bifurcation", "ergodic theory", "celestial mechanics"]),
]

# Realistic mathematician names (diverse backgrounds)
FIRST_NAMES = [
    "Alexander", "Elena", "James", "Maria", "David", "Sophie", "Michael", "Anna",
    "Robert", "Claire", "William", "Isabel", "Thomas", "Rachel", "Daniel", "Emma",
    "Christopher", "Laura", "Andrew", "Sarah", "Richard", "Julia", "Paul", "Hannah",
    "Matthew", "Victoria", "Jonathan", "Alice", "Benjamin", "Grace", "Nicholas", "Olivia",
    "Samuel", "Charlotte", "Peter", "Emily", "John", "Catherine", "Joseph", "Sophia",
    "Charles", "Margaret", "Edward", "Rebecca", "George", "Elizabeth", "Henry", "Diana",
    "Yuri", "Nadia", "Vladimir", "Olga", "Dmitri", "Tatiana", "Sergei", "Irina",
    "Wei", "Li", "Chen", "Mei", "Takeshi", "Yuki", "Hiroshi", "Akiko",
    "Rajesh", "Priya", "Arjun", "Deepa", "Sanjay", "Anjali", "Vikram", "Lakshmi",
    "Ahmed", "Fatima", "Hassan", "Aisha", "Omar", "Yasmin", "Ali", "Layla",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Martinez", "Rodriguez",
    "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Martin", "Jackson", "Thompson",
    "White", "Lopez", "Lee", "Gonzalez", "Harris", "Clark", "Lewis", "Robinson",
    "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen",
    "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker",
    "Dubois", "Martin", "Bernard", "Petit", "Robert", "Richard", "Simon", "Laurent",
    "Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci",
    "Petrov", "Ivanov", "Kuznetsov", "Popov", "Volkov", "Sokolov", "Lebedev", "Kozlov",
    "Wang", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao", "Wu",
    "Tanaka", "Suzuki", "Takahashi", "Watanabe", "Yamamoto", "Nakamura", "Kobayashi", "Sato",
    "Kumar", "Sharma", "Patel", "Singh", "Gupta", "Reddy", "Rao", "Desai",
    "Cohen", "Levy", "Goldstein", "Rosenberg", "Kaplan", "Friedman", "Klein", "Berg",
]


def random_past_time(days_ago_max: int, days_ago_min: int = 0) -> datetime:
    """Generate a random datetime between days_ago_min and days_ago_max days ago."""
    days = random.randint(days_ago_min, days_ago_max)
    hours = random.randint(0, 23)
    minutes = random.randint(0, 59)
    return datetime.utcnow() - timedelta(days=days, hours=hours, minutes=minutes)


def generate_username(first: str, last: str) -> str:
    """Generate a username from name."""
    patterns = [
        f"{first.lower()}.{last.lower()}",
        f"{first[0].lower()}{last.lower()}",
        f"{first.lower()}{last[0].lower()}",
        f"{first.lower()}_{last.lower()}",
        f"{last.lower()}{first[0].lower()}",
    ]
    return random.choice(patterns)


def generate_email(username: str, university: str) -> str:
    """Generate a realistic academic email."""
    # Extract domain from university name
    if "MIT" in university:
        domain = "mit.edu"
    elif "Stanford" in university:
        domain = "stanford.edu"
    elif "Oxford" in university:
        domain = "ox.ac.uk"
    elif "Cambridge" in university:
        domain = "cam.ac.uk"
    elif "ETH" in university:
        domain = "ethz.ch"
    elif "Princeton" in university:
        domain = "princeton.edu"
    elif "Harvard" in university:
        domain = "harvard.edu"
    elif "Berkeley" in university:
        domain = "berkeley.edu"
    elif "École Normale" in university:
        domain = "ens.fr"
    elif "Imperial" in university:
        domain = "imperial.ac.uk"
    elif "Tokyo" in university:
        domain = "u-tokyo.ac.jp"
    elif "Technion" in university:
        domain = "technion.ac.il"
    elif "Toronto" in university:
        domain = "utoronto.ca"
    elif "Michigan" in university:
        domain = "umich.edu"
    elif "Cornell" in university:
        domain = "cornell.edu"
    elif "Columbia" in university:
        domain = "columbia.edu"
    elif "Yale" in university:
        domain = "yale.edu"
    elif "Chicago" in university:
        domain = "uchicago.edu"
    elif "Caltech" in university:
        domain = "caltech.edu"
    elif "Carnegie Mellon" in university:
        domain = "cmu.edu"
    elif "Bonn" in university:
        domain = "uni-bonn.de"
    elif "Paris" in university:
        domain = "u-paris.fr"
    elif "Leuven" in university:
        domain = "kuleuven.be"
    elif "Australian National" in university:
        domain = "anu.edu.au"
    elif "Tsinghua" in university:
        domain = "tsinghua.edu.cn"
    elif "IIT Bombay" in university:
        domain = "iitb.ac.in"
    elif "Seoul" in university:
        domain = "snu.ac.kr"
    elif "São Paulo" in university:
        domain = "usp.br"
    else:
        domain = "university.edu"
    
    return f"{username}@{domain}"


def generate_bio(areas: list[tuple[str, list[str]]]) -> str:
    """Generate a realistic academic bio."""
    primary_area, subfields = random.choice(areas)
    selected_subfields = random.sample(subfields, k=random.randint(1, 3))
    
    bio_templates = [
        f"Researcher in {primary_area}. Interested in {', '.join(selected_subfields)}.",
        f"Professor specializing in {primary_area}. Current focus: {', '.join(selected_subfields)}.",
        f"Working on problems in {primary_area}, particularly {' and '.join(selected_subfields)}.",
        f"{primary_area.title()} researcher. Main interests: {', '.join(selected_subfields)}.",
        f"Studying {primary_area} with emphasis on {' & '.join(selected_subfields)}.",
    ]
    
    return random.choice(bio_templates)


async def seed_users(num_users: int = 80):
    """Seed realistic academic users."""
    async with async_session_maker() as db:
        async def ensure_demo_user() -> bool:
            """Ensure demo account exists with human-like identity."""
            result_demo = await db.execute(select(User).where(User.email == DEMO_EMAIL))
            demo_user = result_demo.scalar_one_or_none()

            if not demo_user:
                db.add(
                    User(
                        email=DEMO_EMAIL,
                        username=DEMO_USERNAME,
                        password_hash=get_password_hash(DEMO_PASSWORD),
                        bio=DEMO_BIO,
                        created_at=random_past_time(120, 7),
                    )
                )
                await db.commit()
                return True

            updated = False
            if demo_user.bio != DEMO_BIO:
                demo_user.bio = DEMO_BIO
                updated = True
            if demo_user.username != DEMO_USERNAME:
                username_taken = await db.execute(
                    select(User).where(User.username == DEMO_USERNAME, User.id != demo_user.id)
                )
                if username_taken.scalar_one_or_none() is None:
                    demo_user.username = DEMO_USERNAME
                    updated = True
            if updated:
                await db.commit()
            return updated

        # Check if users already exist
        result = await db.execute(select(User))
        existing_users = result.scalars().all()
        if len(existing_users) > 10:
            await ensure_demo_user()
            print(f"✓ Already have {len(existing_users)} users, skipping user seeding")
            return
        
        print(f"Creating {num_users} realistic academic users...")
        
        used_usernames = set()
        used_emails = set()
        users_created = 0
        
        for _ in range(num_users * 2):  # Try up to 2x times to handle collisions
            if users_created >= num_users:
                break
                
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            title = random.choice(TITLES)
            university = random.choice(UNIVERSITIES)
            
            username = generate_username(first, last)
            email = generate_email(username, university)
            
            # Ensure uniqueness
            if username in used_usernames or email in used_emails:
                continue
                
            used_usernames.add(username)
            used_emails.add(email)
            
            # Generate bio
            bio = generate_bio(RESEARCH_AREAS)
            # Random join date (1-730 days ago = up to 2 years)
            created_at = random_past_time(730, 90)
            
            user = User(
                email=email,
                username=username,
                password_hash=get_password_hash("proofmesh123"),  # Default password
                bio=bio,
                created_at=created_at,
            )
            
            db.add(user)
            users_created += 1
            
            if users_created % 10 == 0:
                print(f"  Created {users_created}/{num_users} users...")
        
        await db.commit()
        demo_created_or_updated = await ensure_demo_user()
        if demo_created_or_updated:
            print(f"✓ Ensured demo user @{DEMO_USERNAME}")
        print(f"✓ Created {users_created} users")


async def main():
    await seed_users(80)


if __name__ == "__main__":
    asyncio.run(main())
