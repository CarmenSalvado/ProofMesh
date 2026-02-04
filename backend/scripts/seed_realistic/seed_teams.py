"""
Seed realistic research teams based on universities and research areas.
"""
import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.user import User
from app.models.team import Team, TeamMember, TeamMemberRole


# Team name patterns by research area
TEAM_PATTERNS = {
    "algebraic geometry": [
        "{} Algebraic Geometry Seminar",
        "{} Algebraic Geometry Group",
        "{} Moduli Spaces Research Group",
        "{} Derived Categories Lab",
    ],
    "number theory": [
        "{} Number Theory Group",
        "{} Arithmetic Geometry Seminar",
        "{} Analytic Number Theory Lab",
        "{} L-functions Research Group",
    ],
    "topology": [
        "{} Topology Seminar",
        "{} Homotopy Theory Group",
        "{} Geometric Topology Lab",
        "{} Knot Theory Research Group",
    ],
    "analysis": [
        "{} Analysis Group",
        "{} Harmonic Analysis Seminar",
        "{} PDE Research Lab",
        "{} Functional Analysis Group",
    ],
    "category theory": [
        "{} Category Theory Seminar",
        "{} Higher Categories Group",
        "{} Homotopy Type Theory Lab",
        "{} Applied Category Theory Group",
    ],
    "representation theory": [
        "{} Representation Theory Group",
        "{} Lie Theory Seminar",
        "{} Quantum Groups Lab",
        "{} Geometric Representation Theory Group",
    ],
    "differential geometry": [
        "{} Differential Geometry Seminar",
        "{} Geometric Analysis Group",
        "{} Ricci Flow Lab",
        "{} Gauge Theory Research Group",
    ],
    "combinatorics": [
        "{} Combinatorics Seminar",
        "{} Graph Theory Group",
        "{} Extremal Combinatorics Lab",
        "{} Algebraic Combinatorics Group",
    ],
    "logic": [
        "{} Logic Seminar",
        "{} Model Theory Group",
        "{} Set Theory Research Lab",
        "{} Computability Theory Group",
    ],
    "probability": [
        "{} Probability Seminar",
        "{} Random Structures Group",
        "{} Stochastic Processes Lab",
        "{} Ergodic Theory Research Group",
    ],
    "mathematical physics": [
        "{} Mathematical Physics Group",
        "{} Quantum Field Theory Seminar",
        "{} String Theory Lab",
        "{} Integrable Systems Group",
    ],
}


def extract_university_short_name(affiliation: str) -> str:
    """Extract short university name from affiliation."""
    if not affiliation:
        return "Research"
    
    if "MIT" in affiliation or "Massachusetts Institute" in affiliation:
        return "MIT"
    elif "Stanford" in affiliation:
        return "Stanford"
    elif "Oxford" in affiliation:
        return "Oxford"
    elif "Cambridge" in affiliation and "UK" not in affiliation:
        return "Cambridge"
    elif "ETH" in affiliation:
        return "ETH Zürich"
    elif "Princeton" in affiliation:
        return "Princeton"
    elif "Harvard" in affiliation:
        return "Harvard"
    elif "Berkeley" in affiliation:
        return "Berkeley"
    elif "École Normale" in affiliation or "ENS" in affiliation:
        return "ENS"
    elif "Imperial" in affiliation:
        return "Imperial"
    elif "Tokyo" in affiliation:
        return "Tokyo"
    elif "Technion" in affiliation:
        return "Technion"
    elif "Toronto" in affiliation:
        return "Toronto"
    elif "Michigan" in affiliation:
        return "Michigan"
    elif "Cornell" in affiliation:
        return "Cornell"
    elif "Columbia" in affiliation:
        return "Columbia"
    elif "Yale" in affiliation:
        return "Yale"
    elif "Chicago" in affiliation:
        return "Chicago"
    elif "Caltech" in affiliation:
        return "Caltech"
    elif "Carnegie Mellon" in affiliation or "CMU" in affiliation:
        return "CMU"
    elif "Bonn" in affiliation:
        return "Bonn"
    elif "Paris" in affiliation:
        return "Paris"
    elif "Leuven" in affiliation:
        return "Leuven"
    elif "Australian National" in affiliation or "ANU" in affiliation:
        return "ANU"
    elif "Tsinghua" in affiliation:
        return "Tsinghua"
    elif "IIT Bombay" in affiliation:
        return "IIT Bombay"
    elif "Seoul" in affiliation:
        return "SNU"
    elif "São Paulo" in affiliation:
        return "USP"
    else:
        return "Research"


def extract_research_area_from_bio(bio: str) -> str:
    """Extract primary research area from user bio."""
    bio_lower = bio.lower()
    
    # Check for each area
    for area in TEAM_PATTERNS.keys():
        if area in bio_lower:
            return area
    
    # Fallback checks
    if "geometry" in bio_lower:
        return "algebraic geometry"
    elif "number" in bio_lower or "prime" in bio_lower:
        return "number theory"
    elif "topology" in bio_lower or "homotopy" in bio_lower:
        return "topology"
    elif "analysis" in bio_lower or "operator" in bio_lower:
        return "analysis"
    elif "category" in bio_lower or "topos" in bio_lower:
        return "category theory"
    elif "representation" in bio_lower or "lie" in bio_lower:
        return "representation theory"
    elif "combinat" in bio_lower or "graph" in bio_lower:
        return "combinatorics"
    elif "logic" in bio_lower or "model theory" in bio_lower:
        return "logic"
    elif "probability" in bio_lower or "stochastic" in bio_lower:
        return "probability"
    elif "physics" in bio_lower or "quantum" in bio_lower:
        return "mathematical physics"
    else:
        return random.choice(list(TEAM_PATTERNS.keys()))


def random_past_time(days_ago_max: int, days_ago_min: int = 0) -> datetime:
    """Generate a random datetime between days_ago_min and days_ago_max days ago."""
    days = random.randint(days_ago_min, days_ago_max)
    hours = random.randint(0, 23)
    minutes = random.randint(0, 59)
    return datetime.utcnow() - timedelta(days=days, hours=hours, minutes=minutes)


async def seed_teams(num_teams: int = 25):
    """Seed realistic research teams."""
    async with async_session_maker() as db:
        # Check if teams already exist
        result = await db.execute(select(Team))
        existing_teams = result.scalars().all()
        if len(existing_teams) > 5:
            print(f"✓ Already have {len(existing_teams)} teams, skipping team seeding")
            return
        
        # Get all users
        result = await db.execute(select(User))
        all_users = result.scalars().all()
        
        if len(all_users) < 10:
            print("⚠ Need at least 10 users to create teams. Run seed_users.py first.")
            return
        
        print(f"Creating {num_teams} research teams...")
        
        # Group users by university
        users_by_uni = {}
        for user in all_users:
            uni = extract_university_short_name(user.affiliation or "")
            if uni not in users_by_uni:
                users_by_uni[uni] = []
            users_by_uni[uni].append(user)
        
        teams_created = 0
        used_team_names = set()
        
        for _ in range(num_teams * 2):  # Try up to 2x times
            if teams_created >= num_teams:
                break
            
            # Pick a university with enough users
            unis_with_users = [uni for uni, users in users_by_uni.items() if len(users) >= 3]
            if not unis_with_users:
                break
            
            uni = random.choice(unis_with_users)
            uni_users = users_by_uni[uni]
            
            # Pick an owner (the "professor")
            owner = random.choice(uni_users)
            research_area = extract_research_area_from_bio(owner.bio or "")
            
            # Generate team name
            pattern = random.choice(TEAM_PATTERNS.get(research_area, ["{} Research Group"]))
            team_name = pattern.format(uni)
            
            if team_name in used_team_names:
                continue
            
            used_team_names.add(team_name)
            
            # Create description
            descriptions = [
                f"A collaborative research group focused on {research_area}.",
                f"Weekly seminar series and research collaboration in {research_area}.",
                f"Graduate students and faculty working on problems in {research_area}.",
                f"Research group exploring cutting-edge questions in {research_area}.",
            ]
            
            team_created_at = random_past_time(365, 60)
            
            team = Team(
                name=team_name,
                slug=team_name.lower().replace(" ", "-").replace(".", ""),
                description=random.choice(descriptions),
                website=f"https://{uni.lower().replace(' ', '')}.edu/math/{research_area.replace(' ', '-')}",
                is_public=random.choice([True, True, True, False]),  # 75% public
                created_at=team_created_at,
                updated_at=team_created_at,
            )
            
            db.add(team)
            await db.flush()  # Get team.id
            
            # Add owner
            db.add(TeamMember(
                team_id=team.id,
                user_id=owner.id,
                role=TeamMemberRole.OWNER,
                joined_at=team_created_at,
            ))
            
            # Add 1-3 admins
            potential_admins = [u for u in uni_users if u.id != owner.id]
            num_admins = min(random.randint(1, 3), len(potential_admins))
            admins = random.sample(potential_admins, k=num_admins)
            
            for admin in admins:
                db.add(TeamMember(
                    team_id=team.id,
                    user_id=admin.id,
                    role=TeamMemberRole.ADMIN,
                    joined_at=random_past_time(300, 60),
                ))
            
            # Add 3-10 regular members
            potential_members = [u for u in uni_users if u.id != owner.id and u not in admins]
            num_members = min(random.randint(3, 10), len(potential_members))
            members = random.sample(potential_members, k=num_members)
            
            for member in members:
                db.add(TeamMember(
                    team_id=team.id,
                    user_id=member.id,
                    role=TeamMemberRole.MEMBER,
                    joined_at=random_past_time(250, 30),
                ))
            
            teams_created += 1
            
            if teams_created % 5 == 0:
                print(f"  Created {teams_created}/{num_teams} teams...")
        
        await db.commit()
        print(f"✓ Created {teams_created} teams")


async def main():
    await seed_teams(25)


if __name__ == "__main__":
    asyncio.run(main())
