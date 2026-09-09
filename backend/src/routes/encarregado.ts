import { NextFunction, Response, Router } from 'express';
import { Role, StatusServico } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { auditLog } from '../middleware/audit';
import { broadcast } from '../lib/websocket';
import { encerrarPausaServico, minutosTrabalhadosServico } from '../lib/tempoServico';
import { isEncarregado } from '../lib/encarregado';

const router = Router();
const STATUS_ENCERRADO = [StatusServico.FINALIZADO, StatusServico.CONCLUIDO];

const resumo = { select: { id: true, nome: true, matricula: true, setor: true } } as const;
const include = {
  veiculo: { include: { garagem: true } },
  ordemServico: { include: { veiculo: true } },
  profissional: resumo,
  finalizadoPor: resumo,
  participantes: { include: { profissional: resumo }, orderBy: { horaAssumido: 'asc' as const } },
  insumos: { include: { solicitadoPor: resumo } },
  checklistItens: { orderBy: [{ setor: 'asc' as const }, { ordem: 'asc' as const }] },
};

function idParam(v: string | string[]) { return Array.isArray(v) ? v[0] : v; }

router.use(authMiddleware);
router.use(async (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (req.user?.role !== Role.PROFISSIONAL) return next();
  const u = await prisma.usuario.findUnique({ where: { id: req.user.id }, select: { especialidade: true } });
  if (!isEncarregado(u)) return next();
  (req as AuthRequest & { encarregado?: boolean }).encarregado = true;
  next();
});

function somenteEncarregado(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!(req as AuthRequest & { encarregado?: boolean }).encarregado) return next('route');
  next();
}

function espelhar(s: any, userId: string) {
  const p = s.participantes?.find((x: any) => x.profissionalId === userId && !x.horaTermino);
  return p ? { ...s, profissionalId: p.profissionalId, profissional: p.profissional, horaAssumido: p.horaAssumido, horaInicio: p.horaInicio, pausadoEm: p.pausadoEm, minutosPausadosAcum: p.minutosPausadosAcum } : s;
}

router.get('/meus', somenteEncarregado, async (req: AuthRequest, res: Response) => {
  const u = await prisma.usuario.findUnique({ where: { id: req.user!.id }, select: { garagemId: true } });
  const lista = await prisma.servico.findMany({
    where: {
      status: { notIn: STATUS_ENCERRADO },
      participantes: { none: { profissionalId: req.user!.id } },
      ...(u?.garagemId ? { veiculo: { garagemId: u.garagemId } } : {}),
    }, include, orderBy: [{ veiculo: { numero: 'asc' } }, { createdAt: 'asc' }],
  });
  res.json(lista);
});

router.get('/em-execucao', somenteEncarregado, async (req: AuthRequest, res: Response) => {
  const lista = await prisma.servico.findMany({
    where: { status: { notIn: STATUS_ENCERRADO }, participantes: { some: { profissionalId: req.user!.id, horaTermino: null } } },
    include, orderBy: { createdAt: 'asc' },
  });
  res.json(lista.map((s) => espelhar(s, req.user!.id)));
});

router.post('/:id/assumir', somenteEncarregado, async (req: AuthRequest, res: Response) => {
  const servicoId = idParam(req.params.id);
  const servico = await prisma.servico.findUnique({ where: { id: servicoId }, include: { veiculo: true } });
  if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });
  if (STATUS_ENCERRADO.includes(servico.status)) return res.status(400).json({ error: 'Serviço já encerrado' });
  const u = await prisma.usuario.findUnique({ where: { id: req.user!.id }, select: { garagemId: true } });
  if (u?.garagemId && servico.veiculo.garagemId !== u.garagemId) return res.status(403).json({ error: 'Veículo pertence a outra garagem' });
  const existente = await prisma.servicoParticipante.findUnique({ where: { servicoId_profissionalId: { servicoId, profissionalId: req.user!.id } } });
  if (existente) return res.status(409).json({ error: existente.horaTermino ? 'Você já concluiu sua participação neste serviço' : 'Você já está neste serviço' });
  await prisma.servicoParticipante.create({ data: { servicoId, profissionalId: req.user!.id, horaAssumido: new Date(), horaInicio: new Date() } });
  const updated = await prisma.servico.findUnique({ where: { id: servicoId }, include });
  await auditLog(req, 'ASSUMIR', 'Servico', servicoId, { modo: 'encarregado-paralelo', profissionalPrincipalMantido: servico.profissionalId });
  broadcast('quadro:update', null);
  res.json(espelhar(updated!, req.user!.id));
});

router.post('/:id/liberar', somenteEncarregado, async (req: AuthRequest, res: Response) => {
  const servicoId = idParam(req.params.id);
  const p = await prisma.servicoParticipante.findFirst({ where: { servicoId, profissionalId: req.user!.id, horaTermino: null } });
  if (!p) return res.status(403).json({ error: 'Serviço não está em sua execução' });
  await prisma.servicoParticipante.delete({ where: { id: p.id } });
  const updated = await prisma.servico.findUnique({ where: { id: servicoId }, include });
  await auditLog(req, 'LIBERAR', 'Servico', servicoId, { modo: 'encarregado-paralelo' }); broadcast('quadro:update', null); res.json(updated);
});

router.post('/:id/pausar', somenteEncarregado, async (req: AuthRequest, res: Response) => {
  const servicoId=idParam(req.params.id); const p=await prisma.servicoParticipante.findFirst({where:{servicoId,profissionalId:req.user!.id,horaTermino:null}});
  if(!p) return res.status(403).json({error:'Serviço não está em sua execução'}); if(p.pausadoEm) return res.status(400).json({error:'Serviço já está pausado'});
  await prisma.servicoParticipante.update({where:{id:p.id},data:{pausadoEm:new Date()}}); const s=await prisma.servico.findUnique({where:{id:servicoId},include}); broadcast('quadro:update',null); res.json(espelhar(s!,req.user!.id));
});

router.post('/:id/despausar', somenteEncarregado, async (req: AuthRequest, res: Response) => {
  const servicoId=idParam(req.params.id); const p=await prisma.servicoParticipante.findFirst({where:{servicoId,profissionalId:req.user!.id,horaTermino:null}});
  if(!p) return res.status(403).json({error:'Serviço não está em sua execução'}); if(!p.pausadoEm) return res.status(400).json({error:'Serviço não está pausado'});
  await prisma.servicoParticipante.update({where:{id:p.id},data:encerrarPausaServico(p,new Date())}); const s=await prisma.servico.findUnique({where:{id:servicoId},include}); broadcast('quadro:update',null); res.json(espelhar(s!,req.user!.id));
});

router.post('/:id/insumos', somenteEncarregado, async (req: AuthRequest, res: Response) => {
  const servicoId=idParam(req.params.id); const p=await prisma.servicoParticipante.findFirst({where:{servicoId,profissionalId:req.user!.id,horaTermino:null}});
  if(!p) return res.status(403).json({error:'Serviço não está em sua execução'}); if(p.pausadoEm) return res.status(400).json({error:'Retome o serviço antes de solicitar insumo'});
  const descricao=String(req.body.descricao??'').trim(); if(!descricao) return res.status(400).json({error:'Descrição obrigatória'}); const quantidade=Math.max(1,Number(req.body.quantidade)||1);
  const insumo=await prisma.solicitacaoInsumo.create({data:{servicoId,descricao,quantidade,aguardarPeca:Boolean(req.body.alterarStatus),posicao:req.body.posicao||null,solicitadoPorId:req.user!.id},include:{solicitadoPor:resumo}});
  await auditLog(req,'SOLICITAR_INSUMO','Servico',servicoId,{modo:'encarregado-paralelo',descricao}); broadcast('quadro:update',null); res.status(201).json(insumo);
});

router.post('/:id/finalizar', somenteEncarregado, async (req: AuthRequest, res: Response) => {
  const servicoId=idParam(req.params.id); const correcao=String(req.body.correcao??'').trim().toUpperCase(); if(!correcao) return res.status(400).json({error:'Informe a correção executada'});
  const p=await prisma.servicoParticipante.findFirst({where:{servicoId,profissionalId:req.user!.id,horaTermino:null}}); if(!p) return res.status(403).json({error:'Serviço não está em sua execução'});
  const agora=new Date(); const fim=encerrarPausaServico(p,agora); const tempo=minutosTrabalhadosServico({horaInicio:p.horaInicio,pausadoEm:null,minutosPausadosAcum:fim.minutosPausadosAcum},agora);
  await prisma.servicoParticipante.update({where:{id:p.id},data:{horaTermino:agora,pausadoEm:null,minutosPausadosAcum:fim.minutosPausadosAcum,correcao,tempoTotalMin:tempo}});
  const nome=(await prisma.usuario.findUnique({where:{id:req.user!.id},select:{nome:true}}))?.nome??req.user!.matricula; const s0=await prisma.servico.findUnique({where:{id:servicoId},select:{correcao:true}});
  await prisma.servico.update({where:{id:servicoId},data:{correcao:s0?.correcao?`${s0.correcao}\n${correcao} - ${nome} (ENCARREGADO)`: `${correcao} - ${nome} (ENCARREGADO)`}});
  const s=await prisma.servico.findUnique({where:{id:servicoId},include}); await auditLog(req,'FINALIZAR','Servico',servicoId,{modo:'encarregado-paralelo',tempoTotalMin:tempo}); broadcast('quadro:update',null); res.json(s);
});

export default router;
