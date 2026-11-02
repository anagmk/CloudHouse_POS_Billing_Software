import express from 'express';
import authRoutes from './auth.routes.js';
import productRoutes from './product.route.js';
import rolePermission from '../middlewares/role.middleware.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const routes = express.Router();

routes.use('/auth', authRoutes);
routes.use('/products',  authMiddleware,rolePermission('admin'), productRoutes);


export default routes;
