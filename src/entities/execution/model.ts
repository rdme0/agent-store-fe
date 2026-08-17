import type { ExecutionDto } from './api'
import { formatAtomicUsdc } from '../agent/model'

export interface ExecutionModel extends ExecutionDto {
  actualCostLabel: string
  maxBudgetLabel: string
  reservedCostLabel: string
}

export function toExecutionModel(dto: ExecutionDto): ExecutionModel {
  return {
    ...dto,
    actualCostLabel: formatAtomicUsdc(dto.actualCostAtomic),
    maxBudgetLabel: formatAtomicUsdc(dto.maxBudgetAtomic),
    reservedCostLabel: formatAtomicUsdc(dto.reservedCostAtomic),
  }
}
