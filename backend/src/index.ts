import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { createServer } from 'http';
import authRoutes from './routes/auth';
import veiculosRoutes from './routes/veiculos';
import servicosRoutes from './routes/servicos';
import gerenciaRoutes from './routes/gerencia';
import garagensRoutes from './routes/garagens';
import usuariosRoutes from './routes/usuarios';
import uploadRoutes from './routes/upload';
import { initWebSocket } from './lib/websocket';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

const frontendOrigins = process.env.FRONTEND_URL?.split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: frontendOrigins?.length ? frontendOrigins : true,
    credentials: true,
  }),
);
app.use(express.json());

const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/veiculos', veiculosRoutes);
app.use('/api/servicos', servicosRoutes);
app.use('/api/gerencia', gerenciaRoutes);
app.use('/api/garagens', garagensRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/upload', uploadRoutes);

initWebSocket(server);

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
