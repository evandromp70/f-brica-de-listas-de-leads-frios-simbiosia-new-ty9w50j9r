routerAdd(
  'POST',
  '/backend/v1/fabrica/exportar',
  (e) => {
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária')

    const body = e.requestInfo().body || {}
    const listaId = body.listaId || ''
    if (!listaId) return e.badRequestError('listaId é obrigatório')

    let lista
    try {
      lista = $app.findRecordById('listas', listaId)
    } catch (err) {
      return e.notFoundError('Lista não encontrada')
    }

    const nome = lista.getString('nome')
    const regs = $app.findRecordsByFilter('empresas', 'lista = {:listaId}', 'razao_social', 0, 0, {
      listaId,
    })

    const esc = (v) => {
      const s = String(v ?? '')
      if (s.includes(';') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"'
      }
      return s
    }

    const campos = [
      'cnpj',
      'razao_social',
      'nome_fantasia',
      'porte',
      'cnae',
      'setor',
      'uf',
      'cidade',
      'data_inicio',
      'email',
      'telefone',
      'linkedin',
      'observacoes',
    ]
    const header = campos.join(';')
    const linhas = regs.map((r) => campos.map((c) => esc(r.getString(c))).join(';'))
    const csv = [header, ...linhas].join('\n')

    return e.json(200, { csv, nome, total: regs.length })
  },
  $apis.requireAuth(),
)
