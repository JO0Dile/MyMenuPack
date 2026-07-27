import { Router } from 'express';
import asyncRoute from '../../middleware/asyncRoute.js';
import * as controller from './major.controller.js';

const router = Router();
router.get('/:id', asyncRoute(controller.get));
router.get('/:id/courses', asyncRoute(controller.courses));
export default router;
