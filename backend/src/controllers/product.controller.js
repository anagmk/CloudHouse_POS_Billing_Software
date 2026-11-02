import Product from '../models/product.model.js';
import crypto from 'crypto';

const generateSKU = () => {
    return `SKU-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};
export const createProduct = async (req, res) => {
    try {
        const { name, price, category, stockQuantity, gstRate } = req.body;
        const createdBy = req.user;
        if (!name || !price || !category || !stockQuantity || !gstRate) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingProduct = await Product.findOne({ name });
        if (existingProduct) {
            return res.status(400).json({ message: 'Product with this name already exists' });
        }
        const product = new Product({
            userId: createdBy._id,
            name,
            price,
            category,
            stockQuantity,
            sku: generateSKU(),
            gstRate,
            createdBy
        });
        await product.save();

        res.status(201).json({
            message: 'Product created successfully',
            product: {
                _id: product._id,
                name: product.name,
                price: product.price,
                category: product.category,
                stockQuantity: product.stockQuantity,
                sku: product.sku,
                gstRate: product.gstRate,
                isActive: product.isActive
            }
        });
    }
    catch (error) {
        console.log('Error creating product:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const getAllProducts = async (req, res) => {
    try {
        const {
            search = '',
            page = 1,
            limit = 10
        } = req.query;

        const pageNumber = Math.max(1, Number(page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));

        const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const filter = safeSearch
            ? {
                $or: [
                    { name: { $regex: safeSearch, $options: 'i' } },
                    { description: { $regex: safeSearch, $options: 'i' } },
                    { sku: { $regex: safeSearch, $options: 'i' } }
                ]
            }
            : {};

        const [products, total] = await Promise.all([
            Product.find(filter)
                .skip((pageNumber - 1) * pageSize)
                .limit(pageSize)
                .sort({ createdAt: -1 }),

            Product.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            total,
            page: pageNumber,
            limit: pageSize,
            totalPages: Math.ceil(total / pageSize),
            products
        });
    } catch (error) {
        console.error('Product search error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch products'
        });
    }
};

export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const updateProduct = async (req, res) => {
    try {
        const { name, price, category, stockQuantity, gstRate } = req.body;
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.name = name || product.name;
        product.price = price || product.price;
        product.category = category || product.category;
        product.stockQuantity = stockQuantity || product.stockQuantity;
        product.gstRate = gstRate || product.gstRate;

        await product.save();
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};