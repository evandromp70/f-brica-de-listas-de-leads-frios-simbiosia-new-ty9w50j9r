routerAdd(
  'POST',
  '/backend/v1/fabrica/enviar-funil',
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

    const regs = $app.findRecordsByFilter('empresas', 'lista = {:listaId}', 'razao_social', 0, 0, {
      listaId,
    })
    if (regs.length === 0) {
      return e.badRequestError('Esta lista não tem empresas para enviar')
    }

    const baseUrl = ($secrets.get('FUNIL_API_BASE_URL') || '').replace(/\/$/, '')
    const email = $secrets.get('FUNIL_API_EMAIL') || ''
    const senha = $secrets.get('FUNIL_API_PASSWORD') || ''
    if (!baseUrl || !email || !senha) {
      return e.internalServerError('Credenciais do funil não configuradas')
    }

    // Autentica na API do funil (PocketBase) e pega o id do usuário (owner)
    let token = ''
    let ownerId = ''
    try {
      const res = $http.send({
        url: baseUrl + '/api/collections/users/auth-with-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password: senha }),
        timeout: 30,
      })
      if (res.statusCode !== 200) {
        $app.logger().error('funil auth falhou', { status: res.statusCode })
        return e.internalServerError('Não foi possível autenticar no funil')
      }
      token = res.json.token
      ownerId = res.json.record && res.json.record.id ? res.json.record.id : ''
    } catch (err) {
      $app.logger().error('funil auth erro', { err: String(err) })
      return e.internalServerError('Não foi possível conectar ao funil')
    }

    // Cria os leads
    let criados = 0
    let duplicados = 0
    const nomeLista = lista.getString('nome')
    for (const r of regs) {
      const razao = r.getString('razao_social') || ''
      const cnpj = r.getString('cnpj') || ''
      const emailC = r.getString('email') || ''
      const tel = r.getString('telefone') || ''
      const linkedin = r.getString('linkedin') || ''
      const setor = r.getString('setor') || ''
      const uf = r.getString('uf') || ''
      const cidade = r.getString('cidade') || ''
      const obs = [
        'Fábrica de Listas → Funil',
        `Lista: ${nomeLista}`,
        cnpj ? `CNPJ: ${cnpj}` : '',
        setor ? `Setor: ${setor}` : '',
        uf ? `UF: ${uf}` : '',
        cidade ? `Cidade: ${cidade}` : '',
        linkedin ? `LinkedIn: ${linkedin}` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      // Campos estruturados de segmentação (para filtros e atribuição em lote)
      const segmento = setor || ''
      const ufCampo = uf || ''
      const cidadeCampo = cidade || ''

      // Verifica duplicata (mesmo nome de empresa no funil)
      let existe = false
      try {
        const busca = $http.send({
          url:
            baseUrl +
            '/api/collections/leads/records?filter=' +
            encodeURIComponent(`nome_empresa = "${razao.replace(/"/g, '\\"')}"`),
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
          timeout: 30,
        })
        if (
          busca.statusCode === 200 &&
          busca.json &&
          busca.json.items &&
          busca.json.items.length > 0
        ) {
          existe = true
        }
      } catch (err) {
        // segue sem verificação
      }

      if (existe) {
        duplicados++
        continue
      }

      try {
        const res = $http.send({
          url: baseUrl + '/api/collections/leads/records',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({
            owner: ownerId,
            nome_empresa: razao,
            contato_nome: '',
            contato_email: emailC || '',
            contato_telefone: tel || '',
            origem: 'outbound',
            etapa: 'lista',
            segmento: segmento,
            uf: ufCampo,
            cidade: cidadeCampo,
            lista_origem: nomeLista,
            observacoes: obs,
          }),
          timeout: 30,
        })
        if (res.statusCode === 200 || res.statusCode === 201) {
          criados++
        } else {
          // se erro de validação de owner (relação exige id), tenta sem owner
          try {
            const res2 = $http.send({
              url: baseUrl + '/api/collections/leads/records',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token,
              },
              body: JSON.stringify({
                nome_empresa: razao,
                contato_nome: '',
                contato_email: emailC || '',
                contato_telefone: tel || '',
                origem: 'outbound',
                etapa: 'lista',
                observacoes: obs,
              }),
              timeout: 30,
            })
            if (res2.statusCode === 200 || res2.statusCode === 201) {
              criados++
            } else {
              $app.logger().error('lead nao criado', { status: res2.statusCode, razao })
            }
          } catch (err2) {
            $app.logger().error('lead nao criado erro', { err: String(err2), razao })
          }
        }
      } catch (err) {
        $app.logger().error('lead nao criado erro', { err: String(err), razao })
      }
    }

    // marca a lista como exportada
    try {
      lista.set('status', 'exportada')
      $app.save(lista)
    } catch (err) {
      $app.logger().warn('nao marcou lista exportada', { err: String(err) })
    }

    return e.json(200, {
      criados,
      duplicados,
      total: regs.length,
      lista: nomeLista,
    })
  },
  $apis.requireAuth(),
)
