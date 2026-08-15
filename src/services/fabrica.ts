import pb from '@/lib/pocketbase/client'

export type Lista = {
  id: string
  owner: string
  nome: string
  descricao?: string
  fonte: 'rfb' | 'planilha' | 'api' | 'misto'
  setor?: string
  porte?: string
  uf?: string
  idade_min_anos?: number
  status: 'rascunho' | 'em_preparacao' | 'pronta' | 'exportada'
  total_empresas?: number
  created: string
  updated: string
}

export type Empresa = {
  id: string
  owner: string
  lista: string
  cnpj?: string
  razao_social: string
  nome_fantasia?: string
  porte?: string
  cnae?: string
  setor?: string
  uf?: string
  cidade?: string
  data_inicio?: string
  email?: string
  telefone?: string
  linkedin?: string
  observacoes?: string
  created: string
  updated: string
}

export type Importacao = {
  id: string
  owner: string
  lista: string
  arquivo?: string
  total_linhas?: number
  importadas?: number
  duplicadas?: number
  erros?: number
  status: 'processando' | 'concluida' | 'falha'
  detalhes?: string
  created: string
  updated: string
}

export const getListas = () => pb.collection('listas').getFullList<Lista>({ sort: '-created' })

export const getLista = (id: string) => pb.collection('listas').getOne<Lista>(id)

export const createLista = (data: Partial<Lista> & { nome: string; fonte: Lista['fonte'] }) =>
  pb
    .collection('listas')
    .create<Lista>({ owner: (pb.authStore.record?.id as string) ?? '', ...data })

export const updateLista = (id: string, data: Partial<Lista>) =>
  pb.collection('listas').update<Lista>(id, data)

export const deleteLista = (id: string) => pb.collection('listas').delete(id)

export const getEmpresas = (listaId: string) =>
  pb.collection('empresas').getFullList<Empresa>({
    filter: pb.filter('lista = {:listaId}', { listaId }),
    sort: 'razao_social',
  })

export const createEmpresa = (data: Partial<Empresa> & { razao_social: string; lista: string }) =>
  pb
    .collection('empresas')
    .create<Empresa>({ owner: (pb.authStore.record?.id as string) ?? '', ...data })

export const getImportacoes = (listaId: string) =>
  pb.collection('importacoes').getFullList<Importacao>({
    filter: pb.filter('lista = {:listaId}', { listaId }),
    sort: '-created',
  })

export const createImportacao = (data: Partial<Importacao> & { lista: string }) =>
  pb
    .collection('importacoes')
    .create<Importacao>({ owner: (pb.authStore.record?.id as string) ?? '', ...data })

export const gerarDaBase = (listaId: string) =>
  pb.send<{
    status: string
    csv?: string
    metadados?: {
      recorte: Record<string, string | number>
      fonte: string
      origem: string
      total: number
      idade_min_aplicada: string
    }
  }>('/backend/v1/fabrica/gerar-da-base', {
    method: 'POST',
    body: JSON.stringify({ listaId }),
  })

export const exportarLista = (listaId: string) =>
  pb.send<{ csv: string; nome: string }>('/backend/v1/fabrica/exportar', {
    method: 'POST',
    body: JSON.stringify({ listaId }),
  })

export const enviarParaFunil = (listaId: string) =>
  pb.send<{ criados: number; duplicados: number; total: number; lista: string }>(
    '/backend/v1/fabrica/enviar-funil',
    {
      method: 'POST',
      body: JSON.stringify({ listaId }),
    },
  )
