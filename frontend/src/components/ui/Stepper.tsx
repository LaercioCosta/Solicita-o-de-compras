import { ORDEM_FLUXO, ROTULOS_STATUS } from '../../lib/status'
import type { EstadoSolicitacao } from '../../types/api'

interface PropsStepper {
  status: EstadoSolicitacao
}

const ESTADOS_TERMINAIS_FORA_FLUXO: EstadoSolicitacao[] = ['REPROVADO', 'CANCELADO']

export function Stepper({ status }: PropsStepper) {
  const indiceAtual = ORDEM_FLUXO.indexOf(status)
  const foraDoFluxo = ESTADOS_TERMINAIS_FORA_FLUXO.includes(status)

  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-2" aria-label="Etapas do fluxo">
      {ORDEM_FLUXO.map((etapa, indice) => {
        const concluida = !foraDoFluxo && indice < indiceAtual
        const atual = indice === indiceAtual
        const classeBase = 'flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap'
        const classe =
          atual
            ? 'bg-blue-600 text-white'
            : concluida
              ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
              : 'bg-slate-100 text-slate-500'
        return (
          <li key={etapa} className={indice > 0 ? 'ml-2' : ''} aria-current={atual ? 'step' : undefined}>
            <span className={`${classeBase} ${classe}`} data-testid={atual ? 'etapa-atual' : undefined}>
              <span
                className={`flex size-4 items-center justify-center rounded-full text-[10px] ${
                  atual ? 'bg-white/20 text-white' : concluida ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'
                }`}
              >
                {concluida ? '✓' : indice + 1}
              </span>
              {ROTULOS_STATUS[etapa]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
