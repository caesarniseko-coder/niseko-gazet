"""SimHash-based content fingerprinting for deduplication."""

import hashlib
import re


def _tokenize(text: str) -> list[str]:
    """Split text into lowercase word tokens."""
    text = re.sub(r"[^\w\s]", "", text.lower())
    return text.split()


def _hash_token(token: str) -> int:
    """Hash a single token to a 64-bit integer."""
    h = hashlib.md5(token.encode("utf-8")).hexdigest()
    return int(h[:16], 16)


def simhash(text: str, hash_bits: int = 64) -> str:
    """Compute a SimHash fingerprint for the given text.

    Returns hex string of the fingerprint.
    """
    tokens = _tokenize(text)
    if not tokens:
        return "0" * (hash_bits // 4)

    vector = [0] * hash_bits

    for token in tokens:
        token_hash = _hash_token(token)
        for i in range(hash_bits):
            if token_hash & (1 << i):
                vector[i] += 1
            else:
                vector[i] -= 1

    fingerprint = 0
    for i in range(hash_bits):
        if vector[i] > 0:
            fingerprint |= 1 << i

    return format(fingerprint, f"0{hash_bits // 4}x")


def hamming_distance(hash_a: str, hash_b: str) -> int:
    """Compute the Hamming distance between two hex hash strings."""
    val_a = int(hash_a, 16)
    val_b = int(hash_b, 16)
    xor = val_a ^ val_b
    return bin(xor).count("1")


def similarity(hash_a: str, hash_b: str, hash_bits: int = 64) -> float:
    """Compute similarity (0.0-1.0) between two SimHash fingerprints."""
    dist = hamming_distance(hash_a, hash_b)
    return 1.0 - (dist / hash_bits)


def is_duplicate(hash_a: str, hash_b: str, threshold: float = 0.85) -> bool:
    """Check if two fingerprints are similar enough to be duplicates."""
    return similarity(hash_a, hash_b) >= threshold
