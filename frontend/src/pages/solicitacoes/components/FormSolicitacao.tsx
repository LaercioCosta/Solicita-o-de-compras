import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { formatarMoeda } from '../../../lib/format'
import { CampoTextarea } from './CampoTextarea'
import { novoItemFormulario, paraNumeroDecimal, type ItemFormulario, type PayloadSolicitacao } from './formularioUtils'

interface ErrosItem {
  produto?: string
  quantidade?: string
  valorUnitario?: string
}

interface ErrosFormulario {
  descricao?: string
  itens?: string
  itensPorLinha?: ErrosItem[]
}

const LIMITE_ITENS = 50
const LIMITE_DESCRICAO = 2000
const LIMITE_PRODUTO = 500

function validarDecimal(
  valor: string,
  mensagens: { vazio: string; positivo: string },
): string | undefined {
  const limpo = valor.trim()
  if (!limpo) return mensagens.vazio
  if (!/^\d+([.,]\d{1,2})?$/.test(limpo)) return mensagens.positivo
  const numero = Number(limpo.replace(',', '.'))
  if (!Number.isFinite(numero) || numero <= 0) return mensagens.positivo
  return undefined
}

function validarQuantidade(valor: string): string | undefined {
  return validarDecimal(valor, {
    vazio: 'Informe a quantidade.',
    positivo: 'A quantidade deve ser maior que zero.',
  })
}

function validarValorUnitario(valor: string): string | undefined {
  return validarDecimal(valor, {
    vazio: 'Informe o valor unitário estimado.',
    positivo: 'O valor unitário deve ser maior que zero.',
  })
}

function validarProduto(valor: string): string | undefined {
  if (valor.trim().length === 0) return 'Informe o produto.'
  if (valor.trim().length > LIMITE_PRODUTO) return 'O produto deve ter no máximo 500 caracteres.'
  return undefined
}

interface PropsFormSolicitacao {
  descricaoInicial?: string
  itensIniciais?: ItemFormulario[]
  textoBotao: string
  textoCancelar?: string
  enviando?: boolean
  erroApi?: string
  aviso?: string
  onEnviar: (payload: PayloadSolicitacao) => void
  onCancelar?: () => void
}

export function FormSolicitacao({
  descricaoInicial = '',
  itensIniciais,
  textoBotao,
  textoCancelar,
  enviando = false,
  erroApi,
  aviso,
  onEnviar,
  onCancelar,
}: PropsFormSolicitacao) {
  const [descricao, setDescricao] = useState(descricaoInicial)
  const [itens, setItens] = useState<ItemFormulario[]>(() =>
    itensIniciais && itensIniciais.length > 0 ? itensIniciais : [novoItemFormulario()],
  )
  const [erros, setErros] = useState<ErrosFormulario>({})

  function aoAlterarDescricao(evento: ChangeEvent<HTMLTextAreaElement>): void {
    setDescricao(evento.target.value)
  }

  function aoAlterarItem(
    chave: string,
    campo: keyof Omit<ItemFormulario, 'chave'>,
    valor: string,
  ): void {
    setItens((atuais) =>
      atuais.map((item) => (item.chave === chave ? { ...item, [campo]: valor } : item)),
    )
  }

  function aoRemoverItem(chave: string): void {
    setItens((atuais) => atuais.filter((item) => item.chave !== chave))
  }

  function aoAdicionarItem(): void {
    setItens((atuais) => (atuais.length >= LIMITE_ITENS ? atuais : [...atuais, novoItemFormulario()]))
  }

  function aoSubmeter(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    const novosErros: ErrosFormulario = {}
    const descricaoLimpa = descricao.trim()
    if (!descricaoLimpa) {
      novosErros.descricao = 'Informe a descrição.'
    } else if (descricaoLimpa.length > LIMITE_DESCRICAO) {
      novosErros.descricao = 'A descrição deve ter no máximo 2000 caracteres.'
    }
    if (itens.length === 0) {
      novosErros.itens = 'Adicione pelo menos um item.'
    }
    const errosPorLinha = itens.map((item) => ({
      produto: validarProduto(item.produto),
      quantidade: validarQuantidade(item.quantidade),
      valorUnitario: validarValorUnitario(item.valorUnitario),
    }))
    if (errosPorLinha.some((linha) => Object.values(linha).some(Boolean))) {
      novosErros.itensPorLinha = errosPorLinha
    }
    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }
    setErros({})
    onEnviar({
      descricao: descricaoLimpa,
      itens: itens.map((item) => ({
        produto: item.produto.trim(),
        quantidade: paraNumeroDecimal(item.quantidade),
        valorUnitarioEstimado: paraNumeroDecimal(item.valorUnitario),
      })),
    })
  }

  const totalEstimado = itens.reduce((total, item) => {
    const quantidade = paraNumeroDecimal(item.quantidade)
    const valor = paraNumeroDecimal(item.valorUnitario)
    if (Number.isFinite(quantidade) && Number.isFinite(valor) && quantidade > 0 && valor > 0) {
      return total + quantidade * valor
    }
    return total
  }, 0)

  return (
    <form className="flex flex-col gap-5" onSubmit={aoSubmeter} noValidate>
      {aviso ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{aviso}</p>
      ) : null}
      <CampoTextarea
        id="descricao-solicitacao"
        label="Descrição"
        valor={descricao}
        aoAlterar={aoAlterarDescricao}
        erro={erros.descricao}
        limite={LIMITE_DESCRICAO}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="flex w-full items-center justify-between text-sm font-semibold text-slate-900">
          <span>Itens</span>
          <span className="text-xs font-normal text-slate-500">
            {itens.length}/{LIMITE_ITENS}
          </span>
        </legend>
        <div className="flex flex-col gap-4">
          {itens.map((item, indice) => {
            const errosLinha = erros.itensPorLinha?.[indice]
            return (
              <div
                key={item.chave}
                className="flex flex-wrap items-start gap-3 rounded-md bg-slate-50 p-3"
              >
                <div className="min-w-56 flex-1">
                  <Input
                    id={`produto-${item.chave}`}
                    label={`Produto ${indice + 1}`}
                    placeholder="Ex.: Notebook Dell Latitude 5540"
                    value={item.produto}
                    onChange={(evento) => aoAlterarItem(item.chave, 'produto', evento.target.value)}
                    erro={errosLinha?.produto}
                  />
                </div>
                <div className="w-32">
                  <Input
                    id={`quantidade-${item.chave}`}
                    label="Quantidade"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={item.quantidade}
                    onChange={(evento) => aoAlterarItem(item.chave, 'quantidade', evento.target.value)}
                    erro={errosLinha?.quantidade}
                  />
                </div>
                <div className="w-36">
                  <Input
                    id={`valor-unitario-${item.chave}`}
                    label="Valor unitário (R$)"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={item.valorUnitario}
                    onChange={(evento) => aoAlterarItem(item.chave, 'valorUnitario', evento.target.value)}
                    erro={errosLinha?.valorUnitario}
                  />
                </div>
                <Button
                  variante="fantasma"
                  aria-label={`Remover item ${indice + 1}`}
                  className="mt-6 text-red-600 hover:bg-red-50"
                  onClick={() => aoRemoverItem(item.chave)}
                >
                  Remover
                </Button>
              </div>
            )
          })}
        </div>
        {erros.itens ? <span className="text-xs text-red-600">{erros.itens}</span> : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variante="secundario"
            onClick={aoAdicionarItem}
            disabled={itens.length >= LIMITE_ITENS}
          >
            Adicionar item
          </Button>
          {totalEstimado > 0 ? (
            <p className="text-sm font-semibold text-slate-900">
              Total estimado: {formatarMoeda(totalEstimado)}
            </p>
          ) : null}
        </div>
      </fieldset>
      {erroApi ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {erroApi}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancelar ? (
          <Button variante="secundario" onClick={onCancelar} disabled={enviando}>
            {textoCancelar ?? 'Cancelar'}
          </Button>
        ) : null}
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Salvando...' : textoBotao}
        </Button>
      </div>
    </form>
  )
}
