"""
Fact Store - Persistent memory for verified mathematical facts.
This is NOT an agent. This is infrastructure.
"""

import json
from pathlib import Path
from typing import List, Optional
from datetime import datetime
import uuid

from ..models.types import Fact, VerifiedResult


class FactStore:
    """
    Persistent storage for verified mathematical facts.
    Uses simple JSON file storage.
    """
    
    def __init__(self, storage_path: str = "./data/facts.json"):
        self.storage_path = Path(storage_path)
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._facts: dict[str, Fact] = {}
        self._load()
    
    def _load(self):
        """Load facts from disk."""
        if self.storage_path.exists():
            try:
                data = json.loads(self.storage_path.read_text())
                for fact_data in data.get("facts", []):
                    # Parse datetime
                    if "created_at" in fact_data:
                        fact_data["created_at"] = datetime.fromisoformat(
                            fact_data["created_at"]
                        )
                    fact = Fact(**fact_data)
                    self._facts[fact.id] = fact
            except (json.JSONDecodeError, Exception) as e:
                print(f"Warning: Could not load facts: {e}")
                self._facts = {}
    
    def _save(self):
        """Persist facts to disk."""
        data = {
            "facts": [
                {
                    **fact.model_dump(),
                    "created_at": fact.created_at.isoformat()
                }
                for fact in self._facts.values()
            ],
            "updated_at": datetime.now().isoformat()
        }
        self.storage_path.write_text(json.dumps(data, indent=2))
    
    def save(self, result: VerifiedResult) -> Fact:
        """
        Save a verified result to the store.
        
        Args:
            result: The verified result containing the fact and lean result
            
        Returns:
            The saved Fact
        """
        fact = result.fact
        if not fact.id:
            fact.id = str(uuid.uuid4())
        
        self._facts[fact.id] = fact
        self._save()
        return fact
    
    def save_fact(self, fact: Fact) -> Fact:
        """Direct fact save."""
        if not fact.id:
            fact.id = str(uuid.uuid4())
        self._facts[fact.id] = fact
        self._save()
        return fact
    
    def get(self, fact_id: str) -> Optional[Fact]:
        """Get a fact by ID."""
        return self._facts.get(fact_id)
    
    def get_by_block(self, block_id: str) -> List[Fact]:
        """Get all facts associated with a block."""
        return [
            fact for fact in self._facts.values()
            if fact.block_id == block_id
        ]
    
    def relevant(self, block_id: str, limit: int = 10) -> List[Fact]:
        """
        Get relevant facts for a given block.
        Currently returns facts from the same block, sorted by recency.
        
        Args:
            block_id: The block to find relevant facts for
            limit: Maximum number of facts to return
            
        Returns:
            List of relevant Facts
        """
        block_facts = self.get_by_block(block_id)
        # Sort by created_at descending (most recent first)
        block_facts.sort(key=lambda f: f.created_at, reverse=True)
        return block_facts[:limit]
    
    def search(self, query: str, limit: int = 10) -> List[Fact]:
        """
        Simple text search across facts.
        
        Args:
            query: Search string
            limit: Maximum results
            
        Returns:
            List of matching Facts
        """
        query_lower = query.lower()
        matches = []
        for fact in self._facts.values():
            if (query_lower in fact.statement.lower() or 
                query_lower in fact.lean_code.lower()):
                matches.append(fact)
                if len(matches) >= limit:
                    break
        return matches
    
    def all(self) -> List[Fact]:
        """Get all facts."""
        return list(self._facts.values())
    
    def count(self) -> int:
        """Get total number of facts."""
        return len(self._facts)
    
    def delete(self, fact_id: str) -> bool:
        """Delete a fact by ID."""
        if fact_id in self._facts:
            del self._facts[fact_id]
            self._save()
            return True
        return False
    
    def clear(self):
        """Clear all facts (use with caution!)."""
        self._facts = {}
        self._save()


if __name__ == "__main__":
    import sys
    if "--test" in sys.argv:
        print("Testing FactStore...")
        store = FactStore("./test_facts.json")
        
        # Create a test fact
        fact = Fact(
            id="test-1",
            block_id="block-1",
            statement="1 + 1 = 2",
            lean_code="theorem one_plus_one : 1 + 1 = 2 := rfl"
        )
        
        store.save_fact(fact)
        print(f"Saved fact: {fact.id}")
        
        retrieved = store.get("test-1")
        print(f"Retrieved: {retrieved.statement if retrieved else 'None'}")
        
        relevant = store.relevant("block-1")
        print(f"Relevant facts for block-1: {len(relevant)}")
        
        # Cleanup
        Path("./test_facts.json").unlink(missing_ok=True)
        print("Test complete!")
