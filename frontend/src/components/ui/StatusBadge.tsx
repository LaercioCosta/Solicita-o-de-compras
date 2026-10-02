import { Badge } from './Badge'
import { ROTULOS_STATUS, TONS_STATUS } from '../../lib/status'
import type { EstadoSolicitacao } from '../../types/api'

interface PropsStatusBadge {
  status: EstadoSolicitacao
}

export function StatusBadge({ status }: PropsStatusBadge) {
  return <Badge tom={TONS_STATUS[status]}>{ROTULOS_STATUS[status]}</Badge>
}
