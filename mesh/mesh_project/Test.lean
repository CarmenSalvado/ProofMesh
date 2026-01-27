import Mathlib.Data.Nat.Prime
import Mathlib.Data.Nat.ModEq
import Mathlib.Algebra.BigOperators.Intervals

open Finset Nat BigOperators

/-- Definition of the sum S_n = ∑_{k=1}^n k^{n-k+1} -/
def S (n : ℕ) : ℕ := ∑ k in Ico 1 (n + 1), k ^ (n - k + 1)

/-- The recurrence relation S_{n+p-1} ≡ S_n + ∑_{j=1}^{p-1} (n+j)^{p-j} (mod p).
    Note: The derivation of this relation relies on Fermat's Little Theorem, 
    so we assume p is prime. -/
theorem S_recurrence (n p : ℕ) (hp : p.Prime) :
  S (n + p - 1) ≡ S n + ∑ j in Ico 1 p, (n + j) ^ (p - j) [MOD p] := by
  sorry