import { Router } from 'express';
import asyncRoute from '../../middleware/asyncRoute.js';
import * as controller from './university.controller.js';

const router = Router();
router.get('/', asyncRoute(controller.list));
router.get('/:slug', asyncRoute(controller.getBySlug));
export default router;
