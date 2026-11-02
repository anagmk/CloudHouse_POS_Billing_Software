import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  stockQuantity: {
    type: Number,
    required: true
  },
  sku: {
    type: String,
    required: true,
    unique: true
  },
  gstRate: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
}, 
{ timestamps: true });

const Product = mongoose.model('Product', productSchema);

export default Product;