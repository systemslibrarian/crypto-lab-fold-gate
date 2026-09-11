import { commit } from '../commit/pedersen'
import type { PublicInstance } from '../nifs/prove'
import { residual, type RelaxedInstance } from '../r1cs/relaxed'

export interface FinalCheckResult {
  valid: boolean
  constraintValid: boolean
  witnessCommitmentValid: boolean
  errorCommitmentValid: boolean
}

export function finalCheck(publicFolded: PublicInstance, opened: RelaxedInstance): FinalCheckResult {
  const constraintValid = residual(opened).every((value) => value === 0n)
  const witnessCommitmentValid = commit(opened.W).equals(publicFolded.commitmentW)
  const errorCommitmentValid = commit(opened.E).equals(publicFolded.commitmentE)
  return {
    valid: constraintValid && witnessCommitmentValid && errorCommitmentValid && opened.u === publicFolded.u && opened.x.every((value, index) => value === publicFolded.x[index]),
    constraintValid,
    witnessCommitmentValid,
    errorCommitmentValid,
  }
}