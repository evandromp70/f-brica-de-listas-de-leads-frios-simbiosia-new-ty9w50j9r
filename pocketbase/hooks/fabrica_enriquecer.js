routerAdd(
  'POST',
  '/backend/v1/fabrica/enriquecer',
  (e) => {
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária')

    const body = e.requestInfo().body || {}
    const empresaId = body.empresaId || ''
    if (!empresaId) return e.badRequestError('empresaId é obrigatório')

    let empresa
    try {
      empresa = $app.findRecordById('empresas', empresaId)
    } catch (err) {
      return e.notFoundError('Empresa não encontrada')
    }

    const razao = empresa.getString('razao_social') || ''
    const fantasia = empresa.getString('nome_fantasia') || ''
    const cnpj = empresa.getString('cnpj') || ''
    const setor = empresa.getString('setor') || ''
    const cnae = empresa.getString('cnae') || ''
    const uf = empresa.getString('uf') || ''
    const cidade = empresa.getString('cidade') || ''
    const emailAtual = empresa.getString('email') || ''
    const telAtual = empresa.getString('telefone') || ''
    const linkedinAtual = empresa.getString('linkedin') || ''

    const prompt =
      'Sugira dados de contato para a empresa abaixo (prospecção B2B outbound). Devolva apenas o JSON no formato combinado, com confiança e fonte.\n' +
      `Razão social: ${razao}\n` +
      `Nome fantasia: ${fantasia || '—'}\n` +
      `CNPJ: ${cnpj || '—'}\n` +
      `Setor: ${setor || '—'}\n` +
      `CNAE: ${cnae || '—'}\n` +
      `Localização: ${cidade || '—'}${uf ? '/' + uf : ''}\n` +
      `Contatos atuais (substitua se houver algo melhor): email=${emailAtual || '—'}, telefone=${telAtual || '—'}, linkedin=${linkedinAtual || '—'}`

    let result
    try {
      result = $ai.agent('enriquecedor').chat({
        user_id: auth.id,
        conversation_id: null,
        message: prompt,
      })
    } catch (err) {
      $app.logger().error('falha ao chamar enriquecedor', 'err', String(err))
      return e.internalServerError('Não foi possível enriquecer agora')
    }

    // tenta extrair JSON do retorno
    const texto = result && result.content ? String(result.content) : ''
    let sugestao = null
    try {
      const inicio = texto.indexOf('{')
      const fim = texto.lastIndexOf('}')
      if (inicio >= 0 && fim > inicio) {
        sugestao = JSON.parse(texto.slice(inicio, fim + 1))
      }
    } catch (err) {
      $app.logger().warn('resposta do enriquecedor não era JSON válido', 'err', String(err))
    }

    if (!sugestao) {
      sugestao = {
        email: '',
        telefone: '',
        linkedin: '',
        confianca: 'baixa',
        fonte: 'resposta não estruturada',
        observacao: texto.slice(0, 500),
      }
    }

    return e.json(200, {
      empresaId,
      sugestao,
      atual: {
        email: emailAtual,
        telefone: telAtual,
        linkedin: linkedinAtual,
      },
    })
  },
  $apis.requireAuth(),
)
