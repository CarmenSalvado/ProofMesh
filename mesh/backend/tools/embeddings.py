"""
Embedding Service - Generates embeddings using Google's text-embedding-004 model

This service provides vector embeddings for the Knowledge Graph, enabling
semantic similarity search across theorems, definitions, and proofs.
"""

from __future__ import annotations

import asyncio
import hashlib
from typing import Optional
from functools import lru_cache
import os
import json

from google import genai
from google.genai import types


class EmbeddingService:
    """
    Service for generating text embeddings using Gemini's text-embedding-004 model.
    
    The embeddings are 768-dimensional vectors optimized for semantic similarity
    in the mathematics domain.
    """
    
    MODEL_NAME = "text-embedding-004"
    EMBEDDING_DIM = 768
    MAX_BATCH_SIZE = 100
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the embedding service with Gemini API key."""
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment")
        
        self.client = genai.Client(api_key=self.api_key)
        self._cache: dict[str, list[float]] = {}
    
    def _cache_key(self, text: str) -> str:
        """Generate a cache key for the text."""
        return hashlib.sha256(text.encode()).hexdigest()[:16]
    
    async def embed_text(
        self, 
        text: str,
        task_type: str = "SEMANTIC_SIMILARITY",
        use_cache: bool = True
    ) -> list[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: The text to embed
            task_type: The task type for embedding optimization
                - SEMANTIC_SIMILARITY: General similarity (default)
                - RETRIEVAL_QUERY: When text is a query
                - RETRIEVAL_DOCUMENT: When text is a document
                - CLASSIFICATION: For classification tasks
                - CLUSTERING: For clustering tasks
            use_cache: Whether to use cached embeddings
            
        Returns:
            768-dimensional embedding vector
        """
        # Check cache
        if use_cache:
            cache_key = self._cache_key(text)
            if cache_key in self._cache:
                return self._cache[cache_key]
        
        # Generate embedding
        result = await asyncio.to_thread(
            self.client.models.embed_content,
            model=self.MODEL_NAME,
            contents=text,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=self.EMBEDDING_DIM
            )
        )
        
        embedding = list(result.embeddings[0].values)
        
        # Cache result
        if use_cache:
            self._cache[cache_key] = embedding
        
        return embedding
    
    async def embed_batch(
        self,
        texts: list[str],
        task_type: str = "SEMANTIC_SIMILARITY",
        use_cache: bool = True
    ) -> list[list[float]]:
        """
        Generate embeddings for multiple texts efficiently.
        
        Args:
            texts: List of texts to embed
            task_type: The task type for embedding optimization
            use_cache: Whether to use cached embeddings
            
        Returns:
            List of 768-dimensional embedding vectors
        """
        results: list[Optional[list[float]]] = [None] * len(texts)
        texts_to_embed: list[tuple[int, str]] = []
        
        # Check cache first
        for i, text in enumerate(texts):
            if use_cache:
                cache_key = self._cache_key(text)
                if cache_key in self._cache:
                    results[i] = self._cache[cache_key]
                    continue
            texts_to_embed.append((i, text))
        
        # Embed remaining texts in batches
        for batch_start in range(0, len(texts_to_embed), self.MAX_BATCH_SIZE):
            batch = texts_to_embed[batch_start:batch_start + self.MAX_BATCH_SIZE]
            batch_texts = [t[1] for t in batch]
            
            result = await asyncio.to_thread(
                self.client.models.embed_content,
                model=self.MODEL_NAME,
                contents=batch_texts,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=self.EMBEDDING_DIM
                )
            )
            
            for j, (orig_idx, text) in enumerate(batch):
                embedding = list(result.embeddings[j].values)
                results[orig_idx] = embedding
                
                if use_cache:
                    cache_key = self._cache_key(text)
                    self._cache[cache_key] = embedding
        
        return results
    
    async def embed_for_query(self, query: str) -> list[float]:
        """Embed a query for retrieval."""
        return await self.embed_text(query, task_type="RETRIEVAL_QUERY")
    
    async def embed_for_document(self, document: str) -> list[float]:
        """Embed a document for storage."""
        return await self.embed_text(document, task_type="RETRIEVAL_DOCUMENT")
    
    async def embed_math_content(
        self,
        title: str,
        content: str,
        formula: Optional[str] = None,
        node_type: Optional[str] = None
    ) -> list[float]:
        """
        Embed mathematical content with domain-specific formatting.
        
        Creates a structured text representation optimized for math similarity.
        """
        parts = []
        
        if node_type:
            parts.append(f"[{node_type.upper()}]")
        
        parts.append(title)
        parts.append(content)
        
        if formula:
            parts.append(f"Formula: {formula}")
        
        combined_text = "\n".join(parts)
        return await self.embed_for_document(combined_text)
    
    def clear_cache(self):
        """Clear the embedding cache."""
        self._cache.clear()
    
    def cache_size(self) -> int:
        """Get the current cache size."""
        return len(self._cache)
    
    def save_cache(self, path: str):
        """Save cache to file."""
        with open(path, 'w') as f:
            json.dump(self._cache, f)
    
    def load_cache(self, path: str):
        """Load cache from file."""
        with open(path, 'r') as f:
            self._cache = json.load(f)


# Singleton instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get or create the singleton embedding service."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


# Test function
if __name__ == "__main__":
    async def test():
        service = EmbeddingService()
        
        # Test single embedding
        text = "The sum of two even numbers is always even."
        embedding = await service.embed_text(text)
        print(f"Single embedding dim: {len(embedding)}")
        print(f"Sample values: {embedding[:5]}")
        
        # Test math content embedding
        embedding = await service.embed_math_content(
            title="Even Sum Theorem",
            content="If a and b are even integers, then a + b is also even.",
            formula="∀a,b ∈ ℤ: 2|a ∧ 2|b → 2|(a+b)",
            node_type="theorem"
        )
        print(f"\nMath embedding dim: {len(embedding)}")
        
        # Test batch embedding
        texts = [
            "A prime number has exactly two divisors.",
            "The Pythagorean theorem states a² + b² = c².",
            "An integer is even if it is divisible by 2."
        ]
        embeddings = await service.embed_batch(texts)
        print(f"\nBatch embeddings: {len(embeddings)} vectors of dim {len(embeddings[0])}")
        
        # Test cache
        print(f"Cache size: {service.cache_size()}")
        
    asyncio.run(test())
