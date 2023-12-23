import { Router } from "express";
import {
    createClient,
    getClient,
    getClients,
    deleteClient,
    updateClient
} from "../controllers/clients.controllers.js"
const router = Router();

router.get('/clients', getClients);

router.get('/client/:id', getClient);


router.post('/client', createClient);

router.put('/client/:id', updateClient);

router.delete('/client/:id', deleteClient);


export default router