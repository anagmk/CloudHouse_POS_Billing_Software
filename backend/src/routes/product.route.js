import {createProduct, getAllProducts, getProductById, updateProduct, deleteProduct} from '../controllers/product.controller.js';
import express from 'express';

const router = express.Router();

router.post('/create', createProduct);
router.get('/all', getAllProducts);
router.get('/:id', getProductById);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;