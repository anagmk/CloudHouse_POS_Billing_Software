import express from 'express';
import authRoutes from './auth.routes.js';

const routes = express.Router();

routes.use('/auth', authRoutes);

export default routes;
