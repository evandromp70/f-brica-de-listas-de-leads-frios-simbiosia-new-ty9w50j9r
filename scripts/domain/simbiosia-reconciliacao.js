// espelho de consulta — FONTE EXECUTÁVEL É O SKIP (projeto 50248, v0.0.29/c603535).
// SPEC-1-007 (acc7d79f): fonte pura da reconciliação — CA-1-007-03 (idêntica ao Funil).

// ---------- fusão reversível (alias de identidade) ----------
export function aliasDaFusao(origem_global, destino_global, rev, ambiente) {
  if (typeof origem_global !== 'string' || typeof destino_global !== 'string') return null
  const o = origem_global.split(':')
  const d = destino_global.split(':')
  if (o.length !== 4 || d.length !== 4) return null
  if (o[0] !== 'FAB' || d[0] !== 'FAB') return null
  if (o[1] !== d[1] || o[1] !== ambiente) return null
  if (o[2] !== d[2]) return null
  if (origem_global === destino_global) return null
  if (!Number.isInteger(rev) || rev < 1) return null
  return { origem_global, destino_global, rev, status: 'ativo' }
}

export function aliasRevogado(alias, revNovo) {
  if (!alias || alias.status !== 'ativo') return null
  if (!Number.isInteger(revNovo) || revNovo <= alias.rev) return null
  return { ...alias, rev: revNovo, status: 'revogado' }
}

export function identidadeEfetiva(gid, aliases) {
  let atual = gid
  const vistos = new Set()
  while (true) {
    if (vistos.has(atual)) return null
    vistos.add(atual)
    const a = aliases.find((x) => x.origem_global === atual && x.status === 'ativo')
    if (!a) return atual
    atual = a.destino_global
  }
}

export function cadenciasParaPausar(cadencias, gidOrigem, gidDestino) {
  return cadencias.filter((c) => c.lead === gidOrigem || c.lead === gidDestino)
}

export function decidirReconciliacao(evento, estadoAtual, temMapeamento, temReferencias) {
  if (!estadoAtual) {
    if (temMapeamento === false) return { acao: 'pendente', motivo: 'sem mapeamento de ator aprovado' }
    if (temReferencias === false) return { acao: 'pendente', motivo: 'referências ainda não projetadas' }
    return { acao: 'aplicar' }
  }
  if (estadoAtual.hash === evento.payload_hash && estadoAtual.revisao === evento.revisao) {
    return { acao: 'duplicado' }
  }
  if (estadoAtual.hash !== evento.payload_hash && estadoAtual.revisao === evento.revisao) {
    return { acao: 'conflito', motivo: 'mesmo evento_id/revisão com payload diferente' }
  }
  if (evento.revisao < estadoAtual.revisao) return { acao: 'atrasado' }
  if (!temMapeamento) return { acao: 'pendente', motivo: 'sem mapeamento de ator aprovado' }
  if (temReferencias === false) return { acao: 'pendente', motivo: 'referências ainda não projetadas' }
  return { acao: 'aplicar' }
}
