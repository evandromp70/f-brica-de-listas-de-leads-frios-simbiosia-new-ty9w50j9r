migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const getOrCreateUser = (email, name) => {
      try {
        return app.findAuthRecordByEmail('_pb_users_auth_', email)
      } catch (_) {}
      const u = new Record(users)
      u.setEmail(email)
      u.setPassword('Simbiosia@2026')
      u.setVerified(true)
      u.set('name', name)
      app.save(u)
      return u
    }

    const jose = getOrCreateUser('jose@simbiosia.com.br', 'José Aquino')
    getOrCreateUser('evandro@simbiosia.com.br', 'Evandro Pereira')

    // ---------- lista de demonstração ----------
    const listasCol = app.findCollectionByNameOrId('listas')
    let lista
    try {
      lista = app.findFirstRecordByData('listas', 'nome', 'Outbound Indústria SP')
    } catch (_) {
      lista = new Record(listasCol)
      lista.set('owner', jose.id)
      lista.set('nome', 'Outbound Indústria SP')
      lista.set(
        'descricao',
        'Empresas industriais de médio porte em São Paulo, para prospecção outbound.',
      )
      lista.set('fonte', 'rfb')
      lista.set('setor', 'Indústria')
      lista.set('porte', 'Médio')
      lista.set('uf', 'SP')
      lista.set('status', 'em_preparacao')
      lista.set('total_empresas', 0)
      app.save(lista)
    }

    // ---------- empresas de demonstração ----------
    const empresasCol = app.findCollectionByNameOrId('empresas')
    const seedEmpresa = (fields) => {
      try {
        return app.findFirstRecordByData('empresas', 'razao_social', fields.razao_social)
      } catch (_) {}
      const r = new Record(empresasCol)
      r.set('owner', jose.id)
      r.set('lista', fields.lista || lista.id)
      r.set('cnpj', fields.cnpj || '')
      r.set('razao_social', fields.razao_social)
      r.set('nome_fantasia', fields.nome_fantasia || '')
      r.set('porte', fields.porte || '')
      r.set('cnae', fields.cnae || '')
      r.set('setor', fields.setor || '')
      r.set('uf', fields.uf || '')
      r.set('cidade', fields.cidade || '')
      r.set('data_inicio', fields.data_inicio || '')
      r.set('email', fields.email || '')
      r.set('telefone', fields.telefone || '')
      r.set('linkedin', fields.linkedin || '')
      r.set('observacoes', fields.observacoes || '')
      app.save(r)
    }

    seedEmpresa({
      cnpj: '12.345.678/0001-90',
      razao_social: 'Metalúrgica Andrade Ltda',
      nome_fantasia: 'Andrade Metais',
      porte: 'Médio',
      cnae: '2599-3',
      setor: 'Indústria',
      uf: 'SP',
      cidade: 'Guarulhos',
      data_inicio: '2008-03-14',
      email: 'contato@andrademetais.com.br',
      telefone: '(11) 2456-7800',
      linkedin: 'linkedin.com/company/andrade-metais',
    })
    seedEmpresa({
      cnpj: '98.765.432/0001-10',
      razao_social: 'Alimentos São João S/A',
      nome_fantasia: 'São João Alimentos',
      porte: 'Médio',
      cnae: '1099-6',
      setor: 'Alimentos',
      uf: 'SP',
      cidade: 'Campinas',
      data_inicio: '2005-07-01',
      email: 'comercial@saojoaoalimentos.com.br',
      telefone: '(19) 3245-8899',
      linkedin: 'linkedin.com/company/sao-joao-alimentos',
    })
    seedEmpresa({
      cnpj: '11.222.333/0001-44',
      razao_social: 'Plásticos Primeiro Ltda',
      nome_fantasia: 'PrimPlast',
      porte: 'Médio',
      cnae: '2222-6',
      setor: 'Plásticos',
      uf: 'SP',
      cidade: 'São Bernardo do Campo',
      data_inicio: '2010-11-22',
      email: 'contato@primplast.com.br',
      telefone: '(11) 4345-1200',
      linkedin: '',
    })
    seedEmpresa({
      cnpj: '44.555.666/0001-77',
      razao_social: 'Logística Rápido Norte Ltda',
      nome_fantasia: 'Rápido Norte',
      porte: 'Médio',
      cnae: '4930-2',
      setor: 'Logística',
      uf: 'SP',
      cidade: 'São Paulo',
      data_inicio: '2012-02-08',
      email: 'contato@rapidonorte.com.br',
      telefone: '(11) 3333-4455',
      linkedin: 'linkedin.com/company/rapido-norte',
    })

    // atualiza total da lista demo
    const total = app.countRecords('empresas')
    if (lista) {
      lista.set('total_empresas', total)
      app.save(lista)
    }
  },
  (app) => {
    const names = ['regras_icp', 'importacoes', 'empresas', 'listas']
    for (const name of names) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
    try {
      app.delete(app.findAuthRecordByEmail('_pb_users_auth_', 'evandro@simbiosia.com.br'))
    } catch (_) {}
    try {
      app.delete(app.findAuthRecordByEmail('_pb_users_auth_', 'jose@simbiosia.com.br'))
    } catch (_) {}
  },
)
