migrate(
  (app) => {
    // ---------- listas ----------
    const listas = new Collection({
      name: 'listas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'descricao', type: 'text', required: false },
        {
          name: 'fonte',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['rfb', 'planilha', 'api', 'misto'],
        },
        { name: 'setor', type: 'text', required: false },
        { name: 'porte', type: 'text', required: false },
        { name: 'uf', type: 'text', required: false },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['rascunho', 'em_preparacao', 'pronta', 'exportada'],
        },
        { name: 'total_empresas', type: 'number', required: false, min: 0, onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_listas_owner ON listas (owner)'],
    })
    app.save(listas)

    // ---------- empresas ----------
    const empresas = new Collection({
      name: 'empresas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'lista',
          type: 'relation',
          required: true,
          collectionId: listas.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'cnpj', type: 'text', required: false },
        { name: 'razao_social', type: 'text', required: true },
        { name: 'nome_fantasia', type: 'text', required: false },
        { name: 'porte', type: 'text', required: false },
        { name: 'cnae', type: 'text', required: false },
        { name: 'setor', type: 'text', required: false },
        { name: 'uf', type: 'text', required: false },
        { name: 'cidade', type: 'text', required: false },
        { name: 'data_inicio', type: 'text', required: false },
        { name: 'email', type: 'text', required: false },
        { name: 'telefone', type: 'text', required: false },
        { name: 'linkedin', type: 'text', required: false },
        { name: 'observacoes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_empresas_lista ON empresas (lista)',
        'CREATE INDEX idx_empresas_cnpj ON empresas (cnpj)',
      ],
    })
    app.save(empresas)

    // ---------- importacoes (histórico de importação) ----------
    const importacoes = new Collection({
      name: 'importacoes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'lista',
          type: 'relation',
          required: true,
          collectionId: listas.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'arquivo', type: 'text', required: false },
        { name: 'total_linhas', type: 'number', required: false, min: 0, onlyInt: true },
        { name: 'importadas', type: 'number', required: false, min: 0, onlyInt: true },
        { name: 'duplicadas', type: 'number', required: false, min: 0, onlyInt: true },
        { name: 'erros', type: 'number', required: false, min: 0, onlyInt: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['processando', 'concluida', 'falha'],
        },
        { name: 'detalhes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_importacoes_lista ON importacoes (lista)'],
    })
    app.save(importacoes)

    // ---------- regras_icp (recorte do ICP) ----------
    const regrasIcp = new Collection({
      name: 'regras_icp',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'setores', type: 'text', required: false },
        { name: 'portes', type: 'text', required: false },
        { name: 'ufs', type: 'text', required: false },
        { name: 'idade_min_anos', type: 'number', required: false, min: 0, onlyInt: true },
        { name: 'regra', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_regras_icp_owner ON regras_icp (owner)'],
    })
    app.save(regrasIcp)
  },
  (app) => {
    const names = ['regras_icp', 'importacoes', 'empresas', 'listas']
    for (const name of names) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
  },
)
