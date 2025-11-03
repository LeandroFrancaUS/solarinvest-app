import { NextApiRequest, NextApiResponse } from 'next';
import { verifyRequest } from '../../../src/lib/auth/verifyRequest';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Verify request with cookie or bearer token
    const user = await verifyRequest(req);
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    switch (req.method) {
        case 'GET':
            // Logic to get clients
            break;
        case 'POST':
            // Logic to create a new client
            break;
        default:
            res.setHeader('Allow', ['GET', 'POST']);
            res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}