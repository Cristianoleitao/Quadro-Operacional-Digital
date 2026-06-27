import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { AuditoriaResponse, DashboardGerencia } from './api';
import type { HistoricoInsumo, Servico } from '../types';
import { STATUS_LABELS } from '../types';
import { numeroOsExibicao, textoAguardandoPecaPendente, veiculoNumero } from './servico';
import {
  linhasInsumoHistorico,
  resumoInsumosServico,
  rotuloGaragemServico,
  textoCorrecaoResumo,
} from './historicoGerencia';

export interface LinhaHistoricoGerencia {
  data: string;
  garagem: string;
  veiculo: string;
  os: string;
  setor: string;
  servico: string;
  status: string;
  profissional: string;
  tempoMin: string;
  insumos: string;
  pecaPendente: string;
  correcao: string;
}

export interface MetaExportacaoGerencia {
  titulo: string;
  garagem?: string;
  periodoDias: number;
  periodoTexto?: string;
  geradoEm: string;
  usuario?: string;
}

export function linhasHistoricoGerencia(servicos: Servico[]): LinhaHistoricoGerencia[] {
  return servicos.map((s) => ({
    data: new Date(s.createdAt).toLocaleString('pt-BR'),
    garagem: rotuloGaragemServico(s),
    veiculo: veiculoNumero(s),
    os: numeroOsExibicao(s),
    setor: s.setor,
    servico: s.descricao,
    status: STATUS_LABELS[s.status] ?? s.status,
    profissional: s.profissional?.nome ?? '—',
    tempoMin: s.tempoTotalMin != null ? String(s.tempoTotalMin) : '—',
    insumos: resumoInsumosServico(s),
    pecaPendente: textoAguardandoPecaPendente(s) || '—',
    correcao: textoCorrecaoResumo(s),
  }));
}

function nomeArquivo(prefixo: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${prefixo}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

export function exportarHistoricoExcel(
  dashboard: DashboardGerencia,
  historico: Servico[],
  insumos: HistoricoInsumo[],
  auditoria: AuditoriaResponse['registros'],
  meta: MetaExportacaoGerencia,
): void {
  const linhas = linhasHistoricoGerencia(historico);
  const linhasEstoque = linhasInsumoHistorico(insumos);
  const wb = XLSX.utils.book_new();

  const resumo = [
    ['Painel Gerencial — Quadro Operacional Digital'],
    ['Gerado em', meta.geradoEm],
    ['Usuário', meta.usuario ?? '—'],
    ['Garagem', meta.garagem ?? 'Todas'],
    ['Período', meta.periodoTexto ?? `Últimos ${meta.periodoDias} dias`],
    [],
    ['Indicador', 'Valor'],
    ['Veículos no quadro', dashboard.resumo.veiculosNoQuadro],
    ['Serviços abertos', dashboard.resumo.servicosAbertos],
    ['Criados no período', dashboard.resumo.servicosCriadosPeriodo],
    ['Encerrados no período', dashboard.resumo.servicosEncerradosPeriodo],
    ['Tempo médio (min)', dashboard.resumo.tempoMedioMin],
    ['Peças solicitadas', dashboard.resumo.pecasSolicitadas],
    ['Peças atendidas', dashboard.resumo.pecasAtendidas],
    [],
    ['Eventos por ação', 'Total'],
    ...dashboard.eventosPorAcao.map((e) => [e.rotulo, e.total]),
    [],
    ['Exclusões aplicadas nas métricas', dashboard.exclusoesAplicadas.join(', ')],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo');

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ info: 'Sem serviços no período' }]),
    'Histórico',
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      linhasEstoque.length
        ? linhasEstoque
        : [{ info: 'Sem solicitações de estoque/insumos no período' }],
    ),
    'Estoque e insumos',
  );

  const eventos = auditoria.map((r) => ({
    data: new Date(r.createdAt).toLocaleString('pt-BR'),
    usuario: r.usuario?.nome ?? 'Sistema',
    acao: r.acao,
    entidade: r.entidade,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(eventos.length ? eventos : [{ info: 'Sem eventos no período' }]),
    'Auditoria',
  );

  XLSX.writeFile(wb, `${nomeArquivo('gerencia')}.xlsx`);
}

export function exportarHistoricoPdf(
  dashboard: DashboardGerencia,
  historico: Servico[],
  insumos: HistoricoInsumo[],
  meta: MetaExportacaoGerencia,
): void {
  const linhas = linhasHistoricoGerencia(historico);
  const linhasEstoque = linhasInsumoHistorico(insumos);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(14);
  doc.text(meta.titulo, 14, 14);
  doc.setFontSize(9);
  doc.text(`Gerado em: ${meta.geradoEm}`, 14, 21);
  if (meta.usuario) doc.text(`Usuário: ${meta.usuario}`, 14, 26);
  if (meta.garagem) doc.text(`Garagem: ${meta.garagem}`, 14, 31);
  doc.text(`Período: ${meta.periodoTexto ?? `últimos ${meta.periodoDias} dias`}`, 14, 36);

  const resumoY = meta.garagem ? 42 : 37;
  doc.text(
    `Quadro: ${dashboard.resumo.veiculosNoQuadro} veíc. | Abertos: ${dashboard.resumo.servicosAbertos} | Encerrados: ${dashboard.resumo.servicosEncerradosPeriodo} | Peças atendidas: ${dashboard.resumo.pecasAtendidas}/${dashboard.resumo.pecasSolicitadas}`,
    14,
    resumoY,
  );

  autoTable(doc, {
    startY: resumoY + 6,
    head: [[
      'Data',
      'Garagem',
      'Veículo',
      'OS',
      'Setor',
      'Serviço',
      'Status',
      'Prof.',
      'Tempo',
      'Insumos',
      'Peça pend.',
    ]],
    body: linhas.map((l) => [
      l.data,
      l.garagem,
      l.veiculo,
      l.os,
      l.setor,
      l.servico,
      l.status,
      l.profissional,
      l.tempoMin,
      l.insumos,
      l.pecaPendente,
    ]),
    styles: { fontSize: 6, cellPadding: 1 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  if (linhasEstoque.length > 0) {
    doc.addPage();
    doc.setFontSize(12);
    doc.text('Estoque e insumos', 14, 14);
    doc.setFontSize(9);
    doc.text(
      `${linhasEstoque.length} solicitação(ões) — peças e insumos operacionais`,
      14,
      21,
    );

    autoTable(doc, {
      startY: 26,
      head: [[
        'Solicitação',
        'Atendimento',
        'Veículo',
        'OS',
        'Setor',
        'Serviço',
        'Item',
        'Tipo',
        'Status',
        'Solicitante',
      ]],
      body: linhasEstoque.map((l) => [
        l.dataSolicitacao,
        l.dataAtendimento,
        l.veiculo,
        l.os,
        l.setorServico,
        l.servico,
        l.insumo,
        l.tipo,
        l.status,
        l.solicitadoPor,
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [120, 53, 15], textColor: 255 },
      alternateRowStyles: { fillColor: [255, 251, 235] },
      margin: { left: 14, right: 14 },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Página ${i} de ${totalPages} — exclusões: ${dashboard.exclusoesAplicadas.join(', ')}`,
      14,
      doc.internal.pageSize.height - 6,
    );
  }

  doc.save(`${nomeArquivo('gerencia')}.pdf`);
}
