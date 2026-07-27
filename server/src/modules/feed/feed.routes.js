import { Router } from 'express';
import asyncRoute from '../../middleware/asyncRoute.js';
import { feed, registry } from './feed.controller.js';

const router = Router();

// Small: just the universities and colleges the home screen needs to draw its
// first two steps. Split out so the picker isn't waiting on every course in
// every plan before it can render anything.
router.get('/registry', asyncRoute(registry));

// The full catalogue, in the shape the app's plan renderer consumes.
router.get('/', asyncRoute(feed));

export default router;
