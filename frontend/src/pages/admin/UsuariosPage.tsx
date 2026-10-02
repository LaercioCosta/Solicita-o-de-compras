import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError, api } from '../../api/client'
import { ROTULOS_PERFIL } from '../../auth/capacidades'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Coluna } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToaster } from '../../components/ui/ToasterContext'
import type { Perfil } from '../../types/api'
import { ROTULOS_SETOR, SLUGS_SETOR, type SlugSetor, type UsuarioAdmin } from './tipos'

const TAMANHO_PAGINA = 50
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface DadosFormulario {
  nome: string
  email: string
  senha: string
  perfil: Perfil
  setor: SlugSetor
}

interface ErrosFormulario {
  nome?: string
  email?: string
  senha?: string
}

const PERFIS_USUARIO: Perfil[] = [
  'SOLICITANTE',
  'GERENTE',
  'GERENTE_FINANCEIRA',
  'FINANCEIRO',
  'TI',
  'ADMINISTRADOR',
]

function FormularioUsuario({
  usuario,
  aoFechar,
  aoSalvar,
}: {
  usuario: UsuarioAdmin | null
  aoFechar: () => void
  aoSalvar: (dados: DadosFormulario) => Promise<boolean>
}) {
  const [nome, setNome] = useState(usuario?.nome ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [senha, setSenha] = useState('')
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil.slug ?? 'SOLICITANTE')
  const [setor, setSetor] = useState<SlugSetor>(usuario?.setor.slug ?? 'OFICINA')
  const [erros, setErros] = useState<ErrosFormulario>({})
  const [exibirSenha, setExibirSenha] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function submeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const novosErros: ErrosFormulario = {}
    if (!nome.trim()) {
      novosErros.nome = 'Informe o nome.'
    }
    if (!email.trim()) {
      novosErros.email = 'Informe o e-mail.'
    } else if (!REGEX_EMAIL.test(email.trim())) {
      novosErros.email = 'Informe um e-mail válido.'
    }
    if ((!usuario || senha !== '') && senha.length < 8) {
      novosErros.senha = 'A senha deve ter no mínimo 8 caracteres.'
    }
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return

    setSalvando(true)
    const ok = await aoSalvar({ nome: nome.trim(), email: email.trim(), senha, perfil, setor })
    setSalvando(false)
    if (!ok) return
    setNome('')
    setEmail('')
    setSenha('')
    setErros({})
  }

  return (
    <form onSubmit={submeter} noValidate>
      <div className="flex flex-col gap-4">
        <Input
          label="Nome"
          name="nome"
          value={nome}
          erro={erros.nome}
          onChange={(evento) => setNome(evento.target.value)}
        />
        <Input
          label="E-mail"
          name="email"
          type="email"
          value={email}
          erro={erros.email}
          onChange={(evento) => setEmail(evento.target.value)}
        />
        <div className="flex flex-col gap-1">
          <div className="relative">
            <Input
              label="Senha"
              name="senha"
              type={exibirSenha ? 'text' : 'password'}
              value={senha}
              erro={erros.senha}
              placeholder={usuario ? 'Deixe vazio para manter' : undefined}
              className="pr-16"
              onChange={(evento) => setSenha(evento.target.value)}
            />
            <button
              type="button"
              aria-label={exibirSenha ? 'Ocultar senha' : 'Exibir senha'}
              onClick={() => setExibirSenha((atual) => !atual)}
              className="absolute top-9 right-2 rounded px-2 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {exibirSenha ? 'Ocultar' : 'Exibir'}
            </button>
          </div>
          {usuario ? <p className="text-xs text-slate-500">Deixe vazio para manter a senha atual.</p> : null}
        </div>
        <label htmlFor="perfil" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Perfil
          <select
            id="perfil"
            name="perfil"
            value={perfil}
            onChange={(evento) => setPerfil(evento.target.value as Perfil)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:outline-2 focus:outline-blue-600"
          >
            {PERFIS_USUARIO.map((opcao) => (
              <option key={opcao} value={opcao}>
                {ROTULOS_PERFIL[opcao]}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="setor" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Setor
          <select
            id="setor"
            name="setor"
            value={setor}
            onChange={(evento) => setSetor(evento.target.value as SlugSetor)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:outline-2 focus:outline-blue-600"
          >
            {SLUGS_SETOR.map((opcao) => (
              <option key={opcao} value={opcao}>
                {ROTULOS_SETOR[opcao]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variante="secundario" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando...' : usuario ? 'Salvar alterações' : 'Criar usuário'}
        </Button>
      </div>
    </form>
  )
}

export default function UsuariosPage() {
  const toaster = useToaster()
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<UsuarioAdmin | null>(null)
  const [pagina, setPagina] = useState(1)

  const carregar = useCallback(() => {
    api<UsuarioAdmin[]>('/usuarios')
      .then((lista) => {
        setUsuarios(lista)
        setErro('')
      })
      .catch(() => setErro('Não foi possível carregar os usuários.'))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const filtrados = useMemo(() => {
    if (!usuarios) return []
    const termo = busca.trim().toLowerCase()
    if (!termo) return usuarios
    return usuarios.filter(
      (usuario) =>
        usuario.nome.toLowerCase().includes(termo) || usuario.email.toLowerCase().includes(termo),
    )
  }, [usuarios, busca])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAMANHO_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = filtrados.slice((paginaAtual - 1) * TAMANHO_PAGINA, paginaAtual * TAMANHO_PAGINA)

  function abrirNovo() {
    setEmEdicao(null)
    setModalAberto(true)
  }

  function abrirEdicao(usuario: UsuarioAdmin) {
    setEmEdicao(usuario)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEmEdicao(null)
  }

  async function salvar(usuario: UsuarioAdmin | null, dados: DadosFormulario): Promise<boolean> {
    try {
      if (usuario) {
        const corpo: Record<string, string> = {
          nome: dados.nome,
          email: dados.email,
          perfil: dados.perfil,
          setor: dados.setor,
        }
        if (dados.senha !== '') {
          corpo.senha = dados.senha
        }
        await api<UsuarioAdmin>(`/usuarios/${usuario.id}`, {
          method: 'PATCH',
          body: JSON.stringify(corpo),
        })
        toaster.sucesso('Usuário atualizado com sucesso.')
      } else {
        await api<UsuarioAdmin>('/usuarios', {
          method: 'POST',
          body: JSON.stringify({
            nome: dados.nome,
            email: dados.email,
            senha: dados.senha,
            perfil: dados.perfil,
            setor: dados.setor,
          }),
        })
        toaster.sucesso('Usuário criado com sucesso.')
      }
      fecharModal()
      carregar()
      return true
    } catch (excecao) {
      const mensagem =
        excecao instanceof ApiError ? excecao.message : 'Não foi possível salvar o usuário.'
      toaster.erro(mensagem)
      return false
    }
  }

  const colunas: Coluna<UsuarioAdmin>[] = [
    { titulo: 'Nome', renderizar: (usuario) => <span className="font-medium">{usuario.nome}</span> },
    { titulo: 'E-mail', renderizar: (usuario) => usuario.email },
    {
      titulo: 'Perfil',
      renderizar: (usuario) => <Badge tom="azul">{ROTULOS_PERFIL[usuario.perfil.slug]}</Badge>,
    },
    { titulo: 'Setor', renderizar: (usuario) => usuario.setor.nome },
    {
      titulo: 'Ações',
      renderizar: (usuario) => (
        <Button variante="fantasma" onClick={() => abrirEdicao(usuario)}>
          Editar
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        titulo="Usuários"
        descricao="Gerencie usuários, perfis e setores."
        acoes={<Button onClick={abrirNovo}>Novo usuário</Button>}
      />
      <Card className="mt-6">
        <div className="border-b border-slate-200 px-4 py-3">
          <Input
            label="Buscar por nome ou e-mail"
            name="busca"
            value={busca}
            placeholder="Digite para filtrar"
            onChange={(evento) => {
              setBusca(evento.target.value)
              setPagina(1)
            }}
          />
        </div>
        {erro ? (
          <p className="px-4 py-3 text-sm text-red-700">{erro}</p>
        ) : (
          <DataTable
            colunas={colunas}
            itens={visiveis}
            chave={(usuario) => String(usuario.id)}
            carregando={usuarios === null}
            vazio={
              <EmptyState
                titulo="Nenhum usuário encontrado"
                descricao={
                  busca ? 'Nenhum usuário corresponde à busca.' : 'Nenhum usuário cadastrado.'
                }
              />
            }
          />
        )}
        {filtrados.length > TAMANHO_PAGINA ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-sm text-slate-500">Página {paginaAtual}</span>
            <div className="flex gap-2">
              <Button
                variante="secundario"
                disabled={paginaAtual === 1}
                onClick={() => setPagina(paginaAtual - 1)}
              >
                Anterior
              </Button>
              <Button
                variante="secundario"
                disabled={paginaAtual === totalPaginas}
                onClick={() => setPagina(paginaAtual + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
      <Modal
        aberto={modalAberto}
        titulo={emEdicao ? 'Editar usuário' : 'Novo usuário'}
        aoFechar={fecharModal}
      >
        {modalAberto ? (
          <FormularioUsuario
            key={emEdicao ? String(emEdicao.id) : 'novo'}
            usuario={emEdicao}
            aoFechar={fecharModal}
            aoSalvar={(dados) => salvar(emEdicao, dados)}
          />
        ) : null}
      </Modal>
    </div>
  )
}
