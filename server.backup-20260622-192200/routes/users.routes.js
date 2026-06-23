import { Router } from "express";
import {
    authenticate
} from "../controllers/users.controllers.js"
const router = Router();

router.get('/users/:userName/:pass', authenticate);

export default router