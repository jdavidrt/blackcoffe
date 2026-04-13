import { Router } from "express";
import { executeReadQuery } from "../controllers/query.controllers.js"

const router = Router();

router.post('/query', executeReadQuery);

export default router
