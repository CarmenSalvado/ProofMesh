import Mathlib.Algebra.Ring.Parity
import Mathlib.Data.Int.Basic

-- "Sea m y n dos números pares cualesquiera."
-- "Por definición de número par, existen números enteros k y j tales que m = 2k y n = 2j."

example (m n : ℤ) (hm : Even m) (hn : Even n) : True := by
  -- Extract witness k for m
  obtain ⟨k, hk⟩ := hm
  -- Extract witness j for n
  obtain ⟨j, hj⟩ := hn
  
  -- Mathlib defines Even x as x = r + r. 
  -- To match the text "m = 2k", we rewrite addition as multiplication.
  rw [← two_mul] at hk
  rw [← two_mul] at hj
  
  -- At this point, the context matches the description:
  -- hk : m = 2 * k
  -- hj : n = 2 * j
  trivial