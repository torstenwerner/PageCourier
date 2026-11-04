import { healthHeaders } from '../../../lib/server/document-runtime';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	Response.json({ status: 'ok' }, { headers: healthHeaders });
