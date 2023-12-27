import { Router } from "express";
import {
    createClient,
    getClient,
    getClients,
    deleteClient,
    updateClient,
    getAllClients
} from "../controllers/clients.controllers.js"
const router = Router();

router.get('/clients', getAllClients);

router.get('/clients/:mall', getClients);

router.get('/client/:id', updateClient);

router.post('/client', createClient);

router.put('/client/:id', updateClient);

router.delete('/client/:id', deleteClient);


export default router