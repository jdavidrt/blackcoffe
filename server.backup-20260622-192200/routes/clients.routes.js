import { Router } from "express";
import {
    createClient,
    getClient,
    getClients,
    deleteClient,
    updateClient,
    getAllClients,
    restoreClient,
    getDeletedClients
} from "../controllers/clients.controllers.js"
const router = Router();

router.get('/clients', getAllClients);

router.get('/clients/deleted/all', getDeletedClients);

router.get('/clients/:mall', getClients);

router.get('/client/:id', getClient);

router.post('/client', createClient);

router.put('/client/:id', updateClient);

router.put('/client/:id/restore', restoreClient);

router.delete('/client/:id', deleteClient);


export default router