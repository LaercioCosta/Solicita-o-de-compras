import { PageHeader } from '../components/ui/PageHeader'

interface PropsStubPage {
  titulo: string
  descricao?: string
}

export function StubPage({ titulo, descricao }: PropsStubPage) {
  return (
    <div>
      <PageHeader titulo={titulo} descricao={descricao} />
      <div className="mt-6 rounded-lg border-2 border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="text-base font-medium text-slate-700">Implementação nas próximas entregas</p>
        <p className="mt-2 text-sm text-slate-500">
          Esta seção está reservada e será desenvolvida na próxima entrega do fluxo.
        </p>
      </div>
    </div>
  )
}
