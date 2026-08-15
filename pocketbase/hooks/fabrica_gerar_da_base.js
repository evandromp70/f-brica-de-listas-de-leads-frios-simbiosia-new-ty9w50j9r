routerAdd(
  'POST',
  '/backend/v1/fabrica/gerar-da-base',
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

    // Garante acesso: apenas equipe (qualquer autenticado)
    const nome = lista.getString('nome')
    const setor = lista.getString('setor') || ''
    const porte = lista.getString('porte') || ''
    const uf = lista.getString('uf') || ''
    const idadeMin = Math.max(0, Number(lista.get('idade_min_anos') || 3))

    // ------------------------------------------------------------------
    // GERA UM CSV DE DEMONSTRAÇÃO do recorte (dados fictícios marcados).
    // Em produção, este endpoint orquestraria o processamento da base RFB
    // oficial (que é pesada e fica em processamento local/assíncrono).
    // ------------------------------------------------------------------
    const hoje = new Date()
    const anoAtual = hoje.getFullYear()
    const SEGMENTOS = [
      ['Indústria', 'Metalúrgica', '2599-3', '12'],
      ['Indústria', 'Química', '2013-4', '20'],
      ['Varejo e atacado', 'Distribuidora', '4691-5', '46'],
      ['Varejo e atacado', 'Atacadista', '4693-1', '46'],
      ['Serviços financeiros', 'Financeira', '6423-6', '64'],
      ['Serviços financeiros', 'Crédito', '6433-3', '64'],
      ['Logística e transporte', 'Transportes', '4930-2', '49'],
      ['Logística e transporte', 'Logística', '5211-7', '52'],
      ['Saúde', 'Clínica', '8630-5', '86'],
      ['Saúde', 'Diagnósticos', '8640-2', '86'],
    ]
    const cidades = [
      ['São Paulo', 'SP'],
      ['Campinas', 'SP'],
      ['Rio de Janeiro', 'RJ'],
      ['Belo Horizonte', 'MG'],
      ['Curitiba', 'PR'],
      ['Porto Alegre', 'RS'],
    ]

    const linhas = []
    const n = 40
    for (let i = 0; i < n; i++) {
      const seg = SEGMENTOS[i % SEGMENTOS.length]
      const cidade = cidades[i % cidades.length]
      const ufRec = uf && uf !== 'BR' ? uf : cidade[1]
      // idade: respeita o mínimo, mas aleatória entre min e 30 anos
      const idade = idadeMin + Math.floor(Math.random() * (30 - idadeMin + 1))
      const anoInicio = anoAtual - idade
      const basico = String(10000000 + Math.floor(Math.random() * 89999999))
      const ordem = '0001'
      const dv = Math.floor(Math.random() * 10)
      const razao = `${seg[1]} ${cidade[0]} ${100 + Math.floor(Math.random() * 900)} Ltda`
      linhas.push(
        [
          `${basico}/${ordem}-${dv}`,
          razao,
          `${seg[1]} ${cidade[0]}`,
          porte || 'Médio',
          seg[2],
          seg[0],
          ufRec,
          cidade[0],
          `${anoInicio}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`,
          `contato@${razao.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br`,
          `(${ufRec === 'SP' ? '11' : '21'}) 3${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`,
          `linkedin.com/company/${razao.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        ].join(';'),
      )
    }

    const header =
      'cnpj;razao_social;nome_fantasia;porte;cnae;setor;uf;cidade;data_inicio;email;telefone;linkedin'
    const csv = [header, ...linhas].join('\n')

    return e.json(200, {
      status: 'pronto',
      csv,
      metadados: {
        recorte: { setor, porte, uf, idadeMin },
        fonte: 'rfb',
        origem:
          'DEMONSTRAÇÃO — dados fictícios para validar o fluxo. Em produção, viriam da base oficial RFB.',
        total: linhas.length,
        idade_min_aplicada: `${idadeMin}+ anos`,
      },
    })
  },
  $apis.requireAuth(),
)
