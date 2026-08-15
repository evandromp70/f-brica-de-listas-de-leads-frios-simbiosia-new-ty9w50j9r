import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  createLista,
  deleteLista,
  getListas,
  getEmpresas,
  createEmpresa,
  createImportacao,
  updateLista,
  gerarDaBase,
  exportarLista,
  enviarParaFunil,
  enriquecerEmpresa,
  updateEmpresa,
  SugestaoEnriquecimento,
  Lista,
  Empresa,
} from '@/services/fabrica'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  em_preparacao: 'Em preparação',
  pronta: 'Pronta',
  exportada: 'Exportada',
}

export default function Index() {
  const { user } = useAuth()
  const [listas, setListas] = useState<Lista[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // nova lista
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [fonte, setFonte] = useState<'rfb' | 'planilha' | 'api' | 'misto'>('rfb')
  const [setor, setSetor] = useState('')
  const [porte, setPorte] = useState('')
  const [uf, setUf] = useState('')
  const [idadeMin, setIdadeMin] = useState<number>(3)

  // upload
  const [listaSelecionada, setListaSelecionada] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [importando, setImportando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [enviandoFunil, setEnviandoFunil] = useState(false)

  // empresas da lista selecionada
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaExpandida, setEmpresaExpandida] = useState('')

  // enriquecimento com IA
  const [enriquecendoId, setEnriquecendoId] = useState('')
  const [sugestaoModal, setSugestaoModal] = useState<{
    empresa: Empresa
    sugestao: SugestaoEnriquecimento
  } | null>(null)
  const [aplicandoSugestao, setAplicandoSugestao] = useState(false)

  const loadListas = async () => {
    setLoading(true)
    try {
      const data = await getListas()
      setListas(data)
      setError('')
    } catch (e) {
      setError('Não foi possível carregar as listas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadListas()
  }, [])

  const onCreateLista = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome || !fonte) {
      setError('Preencha nome e fonte.')
      return
    }
    setError('')
    try {
      const nova = await createLista({
        nome,
        descricao,
        fonte,
        setor,
        porte,
        uf,
        idade_min_anos: idadeMin,
        status: 'rascunho',
        total_empresas: 0,
      })
      setNome('')
      setDescricao('')
      setSetor('')
      setPorte('')
      setUf('')
      setIdadeMin(3)
      setListaSelecionada(nova.id)
      setNotice('Lista criada. Agora importe o CSV.')
      setTimeout(() => setNotice(''), 3000)
      await loadListas()
    } catch (e) {
      setError('Não foi possível criar a lista.')
    }
  }

  const onSelecionarLista = async (id: string) => {
    setListaSelecionada(id)
    setEmpresaExpandida('')
    try {
      const data = await getEmpresas(id)
      setEmpresas(data)
    } catch (e) {
      setEmpresas([])
    }
  }

  // Normaliza cabeçalho: remove acentos, espaços, deixa minúsculo
  const normalizar = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')

  const onImportar = async () => {
    if (!listaSelecionada || !arquivo) {
      setError('Selecione uma lista e um arquivo CSV.')
      return
    }
    setError('')
    setImportando(true)
    try {
      const texto = await arquivo.text()
      const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
      if (linhas.length < 2) throw new Error('CSV vazio')
      const cabecalho = linhas[0].split(';').map(normalizar)
      const mapCol = (nomes: string[]) => cabecalho.findIndex((h) => nomes.includes(h))

      const iCnpj = mapCol(['cnpj'])
      const iRazao = mapCol(['razaosocial', 'razaosocial', 'nome', 'empresa'])
      const iFantasia = mapCol(['nomefantasia', 'fantasia'])
      const iPorte = mapCol(['porte'])
      const iCnae = mapCol(['cnae', 'cnaeprincipal'])
      const iSetor = mapCol(['setor', 'segmento'])
      const iUf = mapCol(['uf', 'estado'])
      const iCidade = mapCol(['cidade', 'municipio'])
      const iInicio = mapCol(['datainicio', 'dataabertura', 'inicioatividade'])
      const iEmail = mapCol(['email', 'contatoemail'])
      const iTel = mapCol(['telefone', 'contatotelefone', 'dddtelefone'])
      const iLinkedin = mapCol(['linkedin', 'urllinkedin'])

      let importadas = 0,
        duplicadas = 0,
        erros = 0
      const vistos = new Set<string>()

      for (let i = 1; i < linhas.length; i++) {
        const cols = linhas[i].split(';')
        const val = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx].trim() : '')
        const razao = val(iRazao) || val(iFantasia)
        const cnpj = val(iCnpj)
        if (!razao) {
          erros++
          continue
        }
        const chave = cnpj || razao
        if (vistos.has(chave)) {
          duplicadas++
          continue
        }
        vistos.add(chave)
        try {
          await createEmpresa({
            lista: listaSelecionada,
            cnpj,
            razao_social: razao,
            nome_fantasia: val(iFantasia),
            porte: val(iPorte),
            cnae: val(iCnae),
            setor: val(iSetor),
            uf: val(iUf),
            cidade: val(iCidade),
            data_inicio: val(iInicio),
            email: val(iEmail),
            telefone: val(iTel),
            linkedin: val(iLinkedin),
          })
          importadas++
        } catch (e) {
          erros++
        }
      }

      await createImportacao({
        lista: listaSelecionada,
        arquivo: arquivo.name,
        total_linhas: linhas.length - 1,
        importadas,
        duplicadas,
        erros,
        status: 'concluida',
        detalhes: `Importadas: ${importadas}, duplicadas: ${duplicadas}, erros: ${erros}`,
      })

      setNotice(
        `Importação concluída: ${importadas} empresas, ${duplicadas} duplicadas, ${erros} erros.`,
      )
      setTimeout(() => setNotice(''), 4000)
      setArquivo(null)
      const data = await getEmpresas(listaSelecionada)
      setEmpresas(data)
      try {
        await updateLista(listaSelecionada, {
          total_empresas: data.length,
          status: 'em_preparacao',
        })
      } catch (_) {
        // falha ao atualizar total não bloqueia a importação
      }
      await loadListas()
    } catch (e) {
      setError('Não foi possível importar o CSV. Verifique o formato (separador ;).')
    } finally {
      setImportando(false)
    }
  }

  const onGerarDaBase = async (l: Lista) => {
    if (
      !confirm(
        `Gerar a lista "${l.nome}" a partir da base oficial RFB?\n\n` +
          `Recorte: ${l.setor || 'Todos'} · ${l.porte || 'Todos'} · ${l.uf || 'BR'} · ${l.idade_min_anos ?? 3}+ anos\n\n` +
          'O sistema vai baixar a base oficial (se ainda não tiver), aplicar os filtros do ICP e importar as empresas. Isso pode levar alguns minutos.',
      )
    ) {
      return
    }
    setError('')
    setNotice('')
    setImportando(true)
    try {
      // 1. Requisita ao backend o CSV do recorte (token injetado pelo SDK)
      const data = await gerarDaBase(l.id)
      // 2. O backend retorna o CSV pronto (processado pelo script) ou um aviso
      if (data.status === 'pronto' && data.csv) {
        // Salva o CSV em blob e importa pelo fluxo normal
        const blob = new Blob([data.csv], { type: 'text/csv' })
        const arquivo = new File([blob], `${l.nome}-rfb.csv`, { type: 'text/csv' })
        setArquivo(arquivo)
        setListaSelecionada(l.id)
        // dispara a importação programaticamente (reuso)
        await onImportarComArquivo(l.id, arquivo)
      } else if (data.status === 'aguardando_base') {
        setNotice(
          'Para gerar a lista, primeiro baixe a base oficial RFB (instruções no aviso) e envie o .zip pelo campo "Importar base RFB".',
        )
      } else {
        setNotice('A base oficial está sendo processada. Isso pode levar alguns minutos.')
      }
    } catch (e) {
      setError('Não foi possível gerar a lista da base RFB.')
    } finally {
      setImportando(false)
    }
  }

  const onImportarComArquivo = async (listaId: string, arquivo: File) => {
    try {
      const texto = await arquivo.text()
      const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
      if (linhas.length < 2) throw new Error('CSV vazio')
      const cabecalho = linhas[0].split(';').map(normalizar)
      const mapCol = (nomes: string[]) => cabecalho.findIndex((h) => nomes.includes(h))

      const iCnpj = mapCol(['cnpj'])
      const iRazao = mapCol(['razaosocial', 'razaosocial', 'nome', 'empresa'])
      const iFantasia = mapCol(['nomefantasia', 'fantasia'])
      const iPorte = mapCol(['porte'])
      const iCnae = mapCol(['cnae', 'cnaeprincipal'])
      const iSetor = mapCol(['setor', 'segmento'])
      const iUf = mapCol(['uf', 'estado'])
      const iCidade = mapCol(['cidade', 'municipio'])
      const iInicio = mapCol(['datainicio', 'dataabertura', 'inicioatividade'])
      const iEmail = mapCol(['email', 'contatoemail'])
      const iTel = mapCol(['telefone', 'contatotelefone', 'dddtelefone'])
      const iLinkedin = mapCol(['linkedin', 'urllinkedin'])

      let importadas = 0,
        duplicadas = 0,
        erros = 0
      const vistos = new Set<string>()

      for (let i = 1; i < linhas.length; i++) {
        const cols = linhas[i].split(';')
        const val = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx].trim() : '')
        const razao = val(iRazao) || val(iFantasia)
        const cnpj = val(iCnpj)
        if (!razao) {
          erros++
          continue
        }
        const chave = cnpj || razao
        if (vistos.has(chave)) {
          duplicadas++
          continue
        }
        vistos.add(chave)
        try {
          await createEmpresa({
            lista: listaId,
            cnpj,
            razao_social: razao,
            nome_fantasia: val(iFantasia),
            porte: val(iPorte),
            cnae: val(iCnae),
            setor: val(iSetor),
            uf: val(iUf),
            cidade: val(iCidade),
            data_inicio: val(iInicio),
            email: val(iEmail),
            telefone: val(iTel),
            linkedin: val(iLinkedin),
          })
          importadas++
        } catch (e) {
          erros++
        }
      }

      await createImportacao({
        lista: listaId,
        arquivo: arquivo.name,
        total_linhas: linhas.length - 1,
        importadas,
        duplicadas,
        erros,
        status: 'concluida',
        detalhes: `Importadas: ${importadas}, duplicadas: ${duplicadas}, erros: ${erros}`,
      })

      setNotice(
        `Importação concluída: ${importadas} empresas, ${duplicadas} duplicadas, ${erros} erros.`,
      )
      setTimeout(() => setNotice(''), 4000)
      const data = await getEmpresas(listaId)
      setEmpresas(data)
      try {
        await updateLista(listaId, {
          total_empresas: data.length,
          status: 'em_preparacao',
        })
      } catch (_) {
        // falha ao atualizar total não bloqueia a importação
      }
      await loadListas()
    } catch (e) {
      setError('Não foi possível importar o CSV. Verifique o formato (separador ;).')
    }
  }

  const onExportar = async (l: Lista) => {
    setError('')
    setNotice('')
    setExportando(true)
    try {
      const data = await exportarLista(l.id)
      // gera download do CSV no navegador
      const blob = new Blob(['\uFEFF' + data.csv], {
        type: 'text/csv;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${l.nome.replace(/[^a-z0-9]+/gi, '_')}_rfb.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setNotice(`Lista exportada: ${data.total} empresas.`)
      setTimeout(() => setNotice(''), 4000)
    } catch (e) {
      setError('Não foi possível exportar a lista.')
    } finally {
      setExportando(false)
    }
  }

  const onEnviarFunil = async (l: Lista) => {
    if (
      !confirm(
        `Enviar "${l.nome}" para o Funil MKT & Vendas?\n\n` +
          `Cada empresa vira um lead (origem outbound, etapa Lista) no funil.`,
      )
    ) {
      return
    }
    setError('')
    setNotice('')
    setEnviandoFunil(true)
    try {
      const data = await enviarParaFunil(l.id)
      setNotice(
        `Enviado para o funil: ${data.criados} leads criados, ${data.duplicados} duplicados ignorados.`,
      )
      setTimeout(() => setNotice(''), 5000)
      await loadListas()
    } catch (e) {
      setError('Não foi possível enviar para o funil.')
    } finally {
      setEnviandoFunil(false)
    }
  }

  const onEnriquecer = async (e: Empresa) => {
    setError('')
    setNotice('')
    setEnriquecendoId(e.id)
    try {
      const data = await enriquecerEmpresa(e.id)
      setSugestaoModal({ empresa: e, sugestao: data.sugestao })
    } catch (err) {
      setError('Não foi possível enriquecer esta empresa agora.')
    } finally {
      setEnriquecendoId('')
    }
  }

  const onAplicarSugestao = async () => {
    if (!sugestaoModal) return
    setAplicandoSugestao(true)
    try {
      await updateEmpresa(sugestaoModal.empresa.id, {
        email: sugestaoModal.sugestao.email || '',
        telefone: sugestaoModal.sugestao.telefone || '',
        linkedin: sugestaoModal.sugestao.linkedin || '',
      })
      setNotice('Sugestão aplicada à empresa.')
      setTimeout(() => setNotice(''), 4000)
      const listaId = sugestaoModal.empresa.lista
      setSugestaoModal(null)
      const data = await getEmpresas(listaId)
      setEmpresas(data)
    } catch (err) {
      setError('Não foi possível aplicar a sugestão.')
    } finally {
      setAplicandoSugestao(false)
    }
  }

  const onExcluir = async (id: string) => {
    if (!confirm('Excluir esta lista e todas as empresas dela?')) return
    try {
      await deleteLista(id)
      if (listaSelecionada === id) {
        setListaSelecionada('')
        setEmpresas([])
      }
      await loadListas()
    } catch (e) {
      setError('Não foi possível excluir.')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#10454f]">Fábrica de Listas de Leads Frios</h1>
        <p className="text-muted-foreground">
          Importe dados de empresas, filtre pelo ICP e prepare listas para alimentar o funil de
          vendas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Criar lista */}
        <Card id="nova-lista">
          <CardHeader>
            <CardTitle className="text-base">Nova lista</CardTitle>
            <CardDescription>
              Defina o recorte (setor, porte, UF) e a fonte dos dados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreateLista} className="space-y-3">
              <div className="space-y-1">
                <Label>Nome da lista *</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Outbound Indústria SP"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Contexto do recorte..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Fonte *</Label>
                  <Select
                    value={fonte}
                    onValueChange={(v) => setFonte(v as 'rfb' | 'planilha' | 'api' | 'misto')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rfb">Base oficial (RFB)</SelectItem>
                      <SelectItem value="planilha">Planilha</SelectItem>
                      <SelectItem value="api">API paga</SelectItem>
                      <SelectItem value="misto">Combinação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Porte</Label>
                  <Input
                    value={porte}
                    onChange={(e) => setPorte(e.target.value)}
                    placeholder="Médio / Grande"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Setor</Label>
                  <Input
                    value={setor}
                    onChange={(e) => setSetor(e.target.value)}
                    placeholder="Indústria, Saúde..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>UF</Label>
                  <Input
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    placeholder="SP, MG, BR..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Idade mínima (anos)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={idadeMin}
                    onChange={(e) => setIdadeMin(Number(e.target.value))}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-[#bde038] font-semibold text-[#10454f] hover:bg-[#a5cc2c]"
              >
                + Criar lista
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Importar CSV */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importar empresas (CSV)</CardTitle>
            <CardDescription>
              Escolha uma lista e envie um CSV com separador <strong>;</strong>. Colunas
              reconhecidas: cnpj, razao_social, nome_fantasia, porte, cnae, setor, uf, cidade,
              data_inicio, email, telefone, linkedin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Lista</Label>
              <Select value={listaSelecionada} onValueChange={(v) => onSelecionarLista(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a lista" />
                </SelectTrigger>
                <SelectContent>
                  {listas.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Arquivo CSV</Label>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              onClick={onImportar}
              disabled={importando || !listaSelecionada || !arquivo}
              className="bg-[#10454f] hover:bg-[#0d3942]"
            >
              {importando ? 'Importando...' : 'Importar empresas'}
            </Button>
            <p className="text-xs text-muted-foreground">
              O sistema valida, deduplica por CNPJ/razão social e registra o histórico da
              importação.
            </p>
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      {/* Modal de revisão da sugestão de enriquecimento */}
      {sugestaoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#10454f]">
              Sugestão de contato — {sugestaoModal.empresa.razao_social}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              A IA sugeriu os contatos abaixo. Revise antes de aplicar (confiança:{' '}
              <Badge
                variant={
                  sugestaoModal.sugestao.confianca === 'alta'
                    ? 'default'
                    : sugestaoModal.sugestao.confianca === 'media'
                      ? 'secondary'
                      : 'outline'
                }
              >
                {sugestaoModal.sugestao.confianca ?? '—'}
              </Badge>
              )
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="font-medium">E-mail</p>
                <p className="text-muted-foreground">{sugestaoModal.sugestao.email || '—'}</p>
              </div>
              <div>
                <p className="font-medium">Telefone</p>
                <p className="text-muted-foreground">{sugestaoModal.sugestao.telefone || '—'}</p>
              </div>
              <div>
                <p className="font-medium">LinkedIn</p>
                <p className="text-muted-foreground">{sugestaoModal.sugestao.linkedin || '—'}</p>
              </div>
              {sugestaoModal.sugestao.fonte && (
                <div>
                  <p className="font-medium">Fonte estimada</p>
                  <p className="text-muted-foreground">{sugestaoModal.sugestao.fonte}</p>
                </div>
              )}
              {sugestaoModal.sugestao.observacao && (
                <div>
                  <p className="font-medium">Observação</p>
                  <p className="text-muted-foreground">{sugestaoModal.sugestao.observacao}</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSugestaoModal(null)}
                disabled={aplicandoSugestao}
              >
                Descartar
              </Button>
              <Button
                className="bg-[#10454f] hover:bg-[#0d3942]"
                onClick={onAplicarSugestao}
                disabled={aplicandoSugestao}
              >
                {aplicandoSugestao ? 'Aplicando...' : 'Aplicar sugestão'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de listas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Listas ({listas.length})</CardTitle>
            <CardDescription>Clique em uma lista para ver as empresas.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              document.getElementById('nova-lista')?.scrollIntoView({ behavior: 'smooth' })
            }
          >
            + Nova lista
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : listas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma lista ainda. Crie a primeira acima.
            </p>
          ) : (
            <div className="space-y-3">
              {listas.map((l) => (
                <div key={l.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelecionarLista(l.id)}
                      className="text-left"
                    >
                      <p className="font-medium hover:text-[#10454f]">{l.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {l.setor || '—'} · {l.porte || '—'} · {l.uf || 'BR'} ·{' '}
                        {l.idade_min_anos ? `${l.idade_min_anos}+ anos` : ''} ·{' '}
                        {l.total_empresas ?? 0} empresas
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          l.status === 'pronta' || l.status === 'exportada'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {STATUS_LABEL[l.status] ?? l.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onGerarDaBase(l)}
                        disabled={importando}
                        className="whitespace-nowrap"
                      >
                        {importando ? 'Gerando...' : 'Gerar da base RFB'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onExportar(l)}
                        disabled={exportando}
                        className="whitespace-nowrap"
                      >
                        {exportando ? 'Exportando...' : 'Exportar CSV'}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onEnviarFunil(l)}
                        disabled={enviandoFunil}
                        className="whitespace-nowrap bg-[#bde038] text-[#10454f] hover:bg-[#a5cc2c]"
                      >
                        {enviandoFunil ? 'Enviando...' : 'Enviar para o funil'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => onExcluir(l.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                  {listaSelecionada === l.id && (
                    <div className="mt-3 border-t pt-3">
                      {empresas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma empresa nesta lista. Importe um CSV.
                        </p>
                      ) : (
                        <div className="max-h-72 space-y-2 overflow-y-auto">
                          {empresas.map((e) => (
                            <div key={e.id} className="rounded border p-2 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium">{e.razao_social}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{e.porte || '—'}</Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-[#10454f]"
                                    onClick={() => onEnriquecer(e)}
                                    disabled={enriquecendoId === e.id}
                                  >
                                    {enriquecendoId === e.id
                                      ? 'Buscando...'
                                      : e.email || e.telefone || e.linkedin
                                        ? 'Reenriquecer'
                                        : 'Enriquecer com IA'}
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {e.cnpj || '—'} · {e.cidade || '—'}/{e.uf || '—'} · {e.cnae || ''}
                              </p>
                              {e.email && <p className="text-xs">{e.email}</p>}
                              {e.telefone && (
                                <p className="text-xs text-muted-foreground">{e.telefone}</p>
                              )}
                              {e.linkedin && (
                                <p className="text-xs text-muted-foreground">{e.linkedin}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
