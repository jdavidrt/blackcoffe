import { Router } from "express";
import {
    createProduct,
    getProduct,
    getProducts,
    deleteProduct,
    updateProduct
} from "../controllers/products.controllers.js"
const router = Router();

router.get('/products', getProducts);

router.get('/product/:id', getProduct);


router.post('/product', createProduct);

router.put('/product/:id', updateProduct);

router.delete('/product/:id', deleteProduct);


export default router