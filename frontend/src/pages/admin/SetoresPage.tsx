import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError, api } from '../../api/client'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Coluna } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToaster } from '../../components/ui/ToasterContext'
import { SLUGS_SETOR, type SetorAdmin, type SlugSetor } from './tipos'

function FormularioNovoSetor({
  aoFechar,
  aoSalvar,
}: {
  aoFechar: () => void
  aoSalvar: (dados: { slug: SlugSetor; nome: string }) => Promise<boolean>
}) {
  const [slug, setSlug] = useState<SlugSetor>(SLUGS_SETOR[0])
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function submeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!nome.trim()) {
      setErro('Informe o nome do setor.')
      return
    }
    setErro('')
    setSalvando(true)
    const ok = await aoSalvar({ slug, nome: nome.trim() })
    setSalvando(false)
    if (!ok) return
    setNome('')
  }

  return (
    <form onSubmit={submeter} noValidate>
      <div className="flex flex-col gap-4">
        <label htmlFor="slug-setor" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Slug
          <select
            id="slug-setor"
            name="slug"
            value={slug}
            onChange={(evento) => setSlug(evento.target.value as SlugSetor)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:outline-2 focus:outline-blue-600"
          >
            {SLUGS_SETOR.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Nome"
          name="nome-setor"
          value={nome}
          erro={erro}
          onChange={(evento) => setNome(evento.target.value)}
        />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variante="secundario" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Criar setor'}
        </Button>
      </div>
    </form>
  )
}

function FormularioEditarSetor({
  setor,
  aoFechar,
  aoSalvar,
}: {
  setor: SetorAdmin
  aoFechar: () => void
  aoSalvar: (nome: string) => Promise<boolean>
}) {
  const [nome, setNome] = useState(setor.nome)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function submeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!nome.trim()) {
      setErro('Informe o nome do setor.')
      return
    }
    setErro('')
    setSalvando(true)
    const ok = await aoSalvar(nome.trim())
    setSalvando(false)
    if (!ok) return
  }

  return (
    <form onSubmit={submeter} noValidate>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Badge tom="neutro">{setor.slug}</Badge>
          <span className="text-xs text-slate-500">Slug fixo do sistema</span>
        </div>
        <Input
          label="Nome"
          name={`nome-setor-${setor.id}`}
          value={nome}
          erro={erro}
          onChange={(evento) => setNome(evento.target.value)}
        />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variante="secundario" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  )
}

export default function SetoresPage() {
  const toaster = useToaster()
  const [setores, setSetores] = useState<SetorAdmin[] | null>(null)
  const [erro, setErro] = useState('')
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<SetorAdmin | null>(null)

  const carregar = useCallback(() => {
    api<SetorAdmin[]>('/setores')
      .then((lista) => {
        setSetores(lista)
        setErro('')
      })
      .catch(() => setErro('Não foi possível carregar os setores.'))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function criarSetor(dados: { slug: SlugSetor; nome: string }): Promise<boolean> {
    try {
      await api<SetorAdmin>('/setores', {
        method: 'POST',
        body: JSON.stringify(dados),
      })
      toaster.sucesso('Setor criado com sucesso.')
      setModalNovoAberto(false)
      carregar()
      return true
    } catch (excecao) {
      const mensagem =
        excecao instanceof ApiError ? excecao.message : 'Não foi possível criar o setor.'
      toaster.erro(mensagem)
      return false
    }
  }

  async function atualizarSetor(setor: SetorAdmin, nome: string): Promise<boolean> {
    try {
      await api<SetorAdmin>(`/setores/${setor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ nome }),
      })
      toaster.sucesso('Setor atualizado com sucesso.')
      setEmEdicao(null)
      carregar()
      return true
    } catch (excecao) {
      const mensagem =
        excecao instanceof ApiError ? excecao.message : 'Não foi possível atualizar o setor.'
      toaster.erro(mensagem)
      return false
    }
  }

  const colunas: Coluna<SetorAdmin>[] = [
    { titulo: 'Slug', renderizar: (setor) => <Badge tom="neutro">{setor.slug}</Badge> },
    { titulo: 'Nome', renderizar: (setor) => <span className="font-medium">{setor.nome}</span> },
    {
      titulo: 'Ações',
      renderizar: (setor) => (
        <Button variante="fantasma" onClick={() => setEmEdicao(setor)}>
          Editar nome
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        titulo="Setores"
        descricao="Gerencie os setores da empresa."
        acoes={<Button onClick={() => setModalNovoAberto(true)}>Novo setor</Button>}
      />
      <div className="mt-6 flex items-start gap-2 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800 ring-1 ring-blue-200">
        <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
            clipRule="evenodd"
          />
        </svg>
        <p>
          Os slugs são fixos do sistema (OFICINA, TI, MKT e COMERCIAL) e não podem ser alterados nem
          criados fora dessa lista.
        </p>
      </div>
      <Card className="mt-6">
        {erro ? (
          <p className="px-4 py-3 text-sm text-red-700">{erro}</p>
        ) : (
          <DataTable
            colunas={colunas}
            itens={setores ?? []}
            chave={(setor) => String(setor.id)}
            carregando={setores === null}
            vazio={<EmptyState titulo="Nenhum setor cadastrado" />}
          />
        )}
      </Card>
      <Modal aberto={modalNovoAberto} titulo="Novo setor" aoFechar={() => setModalNovoAberto(false)}>
        {modalNovoAberto ? (
          <FormularioNovoSetor
            aoFechar={() => setModalNovoAberto(false)}
            aoSalvar={criarSetor}
          />
        ) : null}
      </Modal>
      <Modal
        aberto={emEdicao !== null}
        titulo="Editar setor"
        aoFechar={() => setEmEdicao(null)}
      >
        {emEdicao ? (
          <FormularioEditarSetor
            key={emEdicao.id}
            setor={emEdicao}
            aoFechar={() => setEmEdicao(null)}
            aoSalvar={(nome) => atualizarSetor(emEdicao, nome)}
          />
        ) : null}
      </Modal>
    </div>
  )
}
